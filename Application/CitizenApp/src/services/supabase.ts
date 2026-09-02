/**
 * PostgREST client for the citizen app.
 *
 * Hand-rolled over `fetch` rather than @supabase/supabase-js. The SDK is not
 * installed and the npm registry is unreachable from this environment, so the
 * choice was between blocking the whole integration and writing the ~80 lines of
 * PostgREST that this app actually needs. This app only reads — four SELECTs, no
 * auth, no realtime, no storage — which is the slice of the SDK that is thin
 * enough to own. If the SDK becomes installable, `selectRows` is the single seam
 * to replace.
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
 * 006_citizen_tables.sql grants the anon role SELECT and nothing else, so the
 * worst an extracted key buys is a copy of the public shelter roster. No service
 * role key belongs in this file or in any EXPO_PUBLIC_ variable.
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
  if (!isSupabaseConfigured) {
    throw new SupabaseError(
      'config',
      'EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is missing',
    );
  }

  const url = `${SUPABASE_URL}/rest/v1/${resource}?${query}`;

  // AbortController rather than AbortSignal.timeout(): Hermes does not ship the
  // static helper, and a released build failing on a missing global is a far
  // worse outcome than four extra lines here.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json',
      },
    });
  } catch (error) {
    // fetch rejects for both a dropped connection and our own abort, and the
    // two mean different things to the reader: one is "you have no signal", the
    // other is "the network is there but crawling".
    const aborted = error instanceof Error && error.name === 'AbortError';
    throw new SupabaseError(
      aborted ? 'timeout' : 'offline',
      aborted ? `${resource} timed out after ${TIMEOUT_MS} ms` : `${resource} could not be reached`,
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
      `${resource} returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      response.status,
    );
  }

  const body: unknown = await response.json().catch(() => null);
  if (!Array.isArray(body)) {
    // A non-array from a table GET means we are not talking to PostgREST —
    // typically a captive portal or a proxy returning an HTML login page with a
    // 200. Treated as a server fault rather than parsed hopefully.
    throw new SupabaseError('server', `${resource} did not return a JSON array`);
  }

  return body as T[];
}
