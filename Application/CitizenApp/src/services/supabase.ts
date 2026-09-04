/**
 * PostgREST client for the citizen app.
 *
 * Hand-rolled over `fetch` rather than @supabase/supabase-js. The SDK is not
 * installed and the npm registry is unreachable from this environment, so the
 * choice was between blocking the whole integration and writing the ~100 lines
 * of PostgREST that this app actually needs: four table reads and three function
 * calls, no auth, no realtime, no storage. That is the slice of the SDK thin
 * enough to own. If the SDK becomes installable, `request` is the single seam to
 * replace.
 *
 * ------------------------------------------------------------------
 * Credentials
 * ------------------------------------------------------------------
 * Read from EXPO_PUBLIC_* as static `process.env.X` property accesses. Per the
 * Expo docs this is load-bearing and not a style preference: "Every environment
 * variable must be statically referenced as a property of process.env using
 * JavaScript's dot notation", and `process.env['X']` or destructuring "is invalid
 * and will not be inlined". Written any other way these are `undefined` in a
 * release build and the app silently has no data.
 *
 * The same docs warn that these values "will be visible in plain-text in your
 * compiled application". That is acceptable here and only here: a Supabase anon
 * key is public by design and row level security is what protects the data.
 * 006_citizen_tables.sql grants the anon role SELECT on shelters, zones and
 * routes — all of them facts a district wants on every phone — so an extracted
 * key buys a copy of the public shelter roster.
 *
 * 007_households.sql is the one that had to be built differently, because a
 * household register is not a fact a district wants published. That table grants
 * anon no table privileges at all; the three functions it may execute each take
 * one device id and can reach at most one row. An extracted key therefore cannot
 * enumerate households. No service role key belongs in this file or in any
 * EXPO_PUBLIC_ variable.
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * False when the app was built without a `.env`. Checked before any request so
 * a missing key produces a clear "this build has no data source" state instead
 * of a 401 dressed up as a network problem.
 */
export const isSupabaseConfigured =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

/**
 * How long to wait before giving up on a request.
 *
 * Eight seconds is a compromise made for the worst realistic case: a congested
 * 2G cell during a flood, where a request may genuinely take five or six seconds
 * to complete. Shorter and we would report "no connection" to people who have
 * one. Much longer and someone stands in rising water watching a screen that
 * has not decided yet — and this app has cached and offline states precisely so
 * it does not have to make them wait.
 */
const TIMEOUT_MS = 8_000;

/**
 * Why a read failed, in the terms the UI needs to distinguish.
 *
 * Only four cases, because the interface only has four honest things to say.
 * `config` is a build mistake, `offline` and `timeout` are the user's network,
 * `server` is ours. The screens phrase these differently: a citizen can retry a
 * network problem and can do nothing at all about the other two, so telling
 * them apart is the difference between useful copy and a shrug.
 */
export type FailureKind = 'config' | 'offline' | 'timeout' | 'server';

export class SupabaseError extends Error {
  readonly kind: FailureKind;
  /** HTTP status when there was one. Diagnostic only — never shown to a citizen. */
  readonly status?: number;

  constructor(kind: FailureKind, message: string, status?: number) {
    super(message);
    this.name = 'SupabaseError';
    this.kind = kind;
    this.status = status;
  }
}

/**
 * One request to PostgREST, parsed, with the failure translation every call
 * needs.
 *
 * Extracted when the household functions arrived. Reads are GETs against a table
 * and household writes are POSTs against `/rpc/`, but the verb is the only thing
 * that differs: both want the same eight-second budget and the same four-way
 * classification of what went wrong. Two copies of that would mean two places to
 * change when the timeout turns out to be wrong on a congested cell, and one of
 * them would be missed.
 *
 * `label` is what appears in the thrown message — the table name, or the
 * function name. Diagnostic only; no screen renders it.
 */
async function request(
  label: string,
  path: string,
  init: { method: 'GET' | 'POST'; body?: string },
): Promise<unknown> {
  if (!isSupabaseConfigured) {
    throw new SupabaseError(
      'config',
      'EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is missing',
    );
  }

  // AbortController rather than AbortSignal.timeout(): Hermes does not ship the
  // static helper, and a released build failing on a missing global is a far
  // worse outcome than four extra lines here.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: init.method,
      body: init.body,
      signal: controller.signal,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch (error) {
    // fetch rejects for both a dropped connection and our own abort, and the
    // two mean different things to the reader: one is "you have no signal", the
    // other is "the network is there but crawling".
    const aborted = error instanceof Error && error.name === 'AbortError';
    throw new SupabaseError(
      aborted ? 'timeout' : 'offline',
      aborted ? `${label} timed out after ${TIMEOUT_MS} ms` : `${label} could not be reached`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    // PostgREST puts a useful reason in the body. Read it for the log line, but
    // never let it reach a screen: "permission denied for table shelters" is a
    // message for us, not for someone deciding whether to leave their house.
    const detail = await response.text().catch(() => '');
    throw new SupabaseError(
      'server',
      `${label} returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      response.status,
    );
  }

  return response.json().catch(() => null);
}

/**
 * GET one table or view through PostgREST.
 *
 * `query` is a raw PostgREST query string — `select=`, `order=`, filters — kept
 * raw on purpose. A query builder here would be a worse version of the SDK's;
 * the four call sites in data/queries.ts are each one readable line, and the
 * PostgREST reference documents them better than a wrapper could.
 *
 * The key travels in headers, never in the query string. That is partly
 * convention and partly so that a URL appearing in an error message, a log line
 * or a crash report cannot carry the credential with it.
 */
export async function selectRows<T>(
  resource: string,
  query: string,
): Promise<T[]> {
  const body = await request(resource, `${resource}?${query}`, { method: 'GET' });

  if (!Array.isArray(body)) {
    // A non-array from a table GET means we are not talking to PostgREST —
    // typically a captive portal or a proxy returning an HTML login page with a
    // 200. Treated as a server fault rather than parsed hopefully.
    throw new SupabaseError('server', `${resource} did not return a JSON array`);
  }

  return body as T[];
}

/**
 * Call a Postgres function.
 *
 * The whole household path goes through here rather than through `selectRows`,
 * and that is the point of 007_households.sql: the table itself is sealed to the
 * anon role, so there is no `GET /households` to make. Every read and write is a
 * function that takes one device id and can reach at most one row.
 *
 * POST, always, even for `restore_household` which only reads. That function is
 * left VOLATILE precisely so PostgREST refuses to expose it over GET, because a
 * GET would put a device id in the query string and from there into access logs
 * and any cache in front of the API. The verb here is a privacy decision, not a
 * REST one.
 *
 * The caller narrows the result. A function returning TABLE gives an array of
 * rows; one returning a scalar gives that scalar bare — `update_household`
 * resolves to a JSON string holding a timestamp — and pretending both are the
 * same shape here would only move the cast somewhere less obvious.
 */
export async function callRpc<T>(
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  return (await request(`rpc/${fn}`, `rpc/${fn}`, {
    method: 'POST',
    body: JSON.stringify(args),
  })) as T;
}
