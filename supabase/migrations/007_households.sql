-- ============================================================
-- BHOOMI-NETRA: Households
-- Who is in the house, so the app can stop guessing
-- SIH 2026 (26178)
-- ============================================================
--
-- Every table before this one describes ground: where the water is, where the
-- shelters are, how to walk between them. None of them knows anything about the
-- person holding the phone. That is why `recommendedShelter` will currently send
-- a family of seven to a hall with four places left, and why SOS can only say
-- "someone needs help" instead of "seven people, two over eighty, one who cannot
-- leave the house unaided".
--
-- One row per handset. No account, no password, no phone number — a safety app
-- that demands a signup before it will show you a flood warning is a safety app
-- people delete. Consent is the row's existence, stamped in `consented_at`
-- because India's DPDP Act 2023 makes when-and-whether auditable, not assumed.
--
-- ------------------------------------------------------------
-- This table changes the threat model
-- ------------------------------------------------------------
-- 006 could hand the anon role a plain `USING (true)` read policy and lose
-- nothing: a shelter roster and a hazard polygon are facts a district *wants* on
-- every phone. This table is the opposite. It holds names, street addresses,
-- household sizes and counts of the elderly, the pregnant and the disabled at
-- those addresses. That is a population register.
--
-- The anon key ships in plain text inside the APK, so `FOR SELECT USING (true)`
-- here would publish that register to anyone who downloads the app. There is
-- therefore no anon policy on this table at all, and no view over it. Every
-- citizen-side read and write goes through the three functions at the bottom,
-- each of which takes one device id and can touch at most one row.
--
-- What that buys: possession of the anon key does not let you enumerate
-- households, dump the table, or read a row whose device id you do not already
-- have.
--
-- What it does not buy: rate limiting. A policy cannot count requests, so the
-- write path is spammable and the restore path is probeable. A device id is a
-- 64-bit app-scoped value, which makes probing impractical rather than
-- impossible. The real fix is to put these three calls behind an Edge Function
-- that can throttle by IP. Written down here rather than left as a surprise.

CREATE TABLE households (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The only credential this table has. Android's per-app scoped ID: stable
  -- across reinstall, which is what makes profile recovery possible, and not
  -- correlatable with anything another app on the phone can see. The length
  -- floor exists so a caller cannot probe the restore function with '1'.
  device_id    text NOT NULL UNIQUE CHECK (length(device_id) >= 16),
  consented_at timestamptz NOT NULL DEFAULT now(),

  -- Set before any other copy is shown, so the questions below can be asked in
  -- the language they will be answered in.
  language     text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'bn', 'hi')),

  -- Every one of these is nullable on purpose. The onboarding flow is skippable
  -- step by step, and a household that gave us its ward but not its address is
  -- more useful to a rescue team than a household that abandoned the form.
  contact_name text,
  ward         text,
  -- Where a boat goes. Plain language, not a geocode: during the 2020 Amphan
  -- response the addresses that worked were the ones a local could act on.
  address      text,

  -- Capacity matching. Defaults to one rather than zero: a row exists because
  -- somebody made it, so there is at least one person.
  people       int NOT NULL DEFAULT 1 CHECK (people BETWEEN 1 AND 60),
  -- Tenure tells the district who has somewhere to return to once water drops.
  tenure       text CHECK (tenure IN ('own', 'rent', 'other')),

  -- The assisted-evacuation list, one column at a time. These deliberately do
  -- not sum to `people` and are not checked against each other: an eighty-year-old
  -- who cannot swim belongs in two of them, and a constraint that forbade that
  -- would quietly force somebody to under-report.
  elderly          int NOT NULL DEFAULT 0 CHECK (elderly >= 0),          -- 60 and over
  infants          int NOT NULL DEFAULT 0 CHECK (infants >= 0),          -- under two: carried, not walked
  pregnant         int NOT NULL DEFAULT 0 CHECK (pregnant >= 0),
  needs_assistance int NOT NULL DEFAULT 0 CHECK (needs_assistance >= 0), -- cannot leave unaided
  -- Changes the *advice*, not just the ranking: you never tell a non-swimmer to
  -- wade a flooded lane, however short the route.
  non_swimmers     int NOT NULL DEFAULT 0 CHECK (non_swimmers >= 0),

  -- Free text, null when there are none. A documented cause of flood deaths in
  -- rural Bengal is people refusing to evacuate without their animals, so this
  -- is a planning fact and not a curiosity.
  livestock    text,

  -- Roll-call. Set by mark_household_safe, cleared by the same function, so the
  -- district can tell "self-evacuated, do not search" from "not heard from".
  safe_at        timestamptz,
  safe_latitude  float8,
  safe_longitude float8,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT households_counts_fit CHECK (
    elderly          <= people AND
    infants          <= people AND
    pregnant         <= people AND
    needs_assistance <= people AND
    non_swimmers     <= people
  )
);

-- The question a control room actually asks: who in this ward have we not heard
-- from? Partial, so the index only carries the rows still outstanding.
CREATE INDEX idx_households_pending ON households(ward) WHERE safe_at IS NULL;

-- ------------------------------------------------------------
-- Row Level Security: sealed, then three doors
-- ------------------------------------------------------------
-- RLS on with no anon policy means PostgREST hands the anon role an empty array
-- for GET /households and refuses every write. The table privileges are revoked
-- as well, so the seal does not depend on RLS alone staying switched on.
--
-- Not FORCE ROW LEVEL SECURITY: that would apply policies to the table owner too,
-- and the owner is exactly what the SECURITY DEFINER functions run as.
ALTER TABLE households ENABLE ROW LEVEL SECURITY;

-- Supabase's default privileges hand anon and authenticated ALL on every new
-- table in `public`. Take it back and grant exactly one verb to exactly one role,
-- so the seal is written down here rather than inherited from a project setting
-- somebody could change.
REVOKE ALL ON TABLE households FROM anon, authenticated;
GRANT SELECT ON TABLE households TO authenticated;

-- The district's own staff need this list — an assisted-evacuation register no
-- responder can read is a register that saves nobody.
--
-- CAUTION before you rely on this: `authenticated` means "holds a valid session
-- in this Supabase project". If public email signup is enabled, anyone who
-- registers becomes `authenticated` and this policy publishes the register. Turn
-- public signup off, or replace `true` below with a check against a staff role,
-- before this table holds a real citizen's address.
CREATE POLICY "households_select_staff" ON households
  FOR SELECT TO authenticated USING (true);

-- ------------------------------------------------------------
-- Restore: the reinstall path
-- ------------------------------------------------------------
-- Returns at most one row, and deliberately returns neither `id` nor `device_id`
-- — the caller supplied the device id and the row id is of no use to a handset,
-- so a probe that guesses a device id learns nothing extra.
--
-- `updated_at` comes back so the app can stamp the "we still have your details"
-- prompt with a date. An eight-month-old profile should look eight months old.
CREATE OR REPLACE FUNCTION public.restore_household(p_device_id text)
RETURNS TABLE (
  language         text,
  contact_name     text,
  ward             text,
  address          text,
  people           int,
  tenure           text,
  elderly          int,
  infants          int,
  pregnant         int,
  needs_assistance int,
  non_swimmers     int,
  livestock        text,
  safe_at          timestamptz,
  updated_at       timestamptz
)
LANGUAGE sql
-- Left VOLATILE, which is the default, even though this only reads. PostgREST
-- exposes a STABLE function over GET as well as POST, and a GET would put the
-- device id in the query string — into access logs, into any cache in front of
-- the API. VOLATILE forces POST, so the id stays in the request body.
SECURITY DEFINER
-- Empty search_path, and every table reference below schema-qualified. Without
-- this, a SECURITY DEFINER function can be tricked into resolving `households` to
-- an attacker-created table in a schema they control, and it runs as the owner.
SET search_path = ''
AS $$
  SELECT h.language, h.contact_name, h.ward, h.address,
         h.people, h.tenure,
         h.elderly, h.infants, h.pregnant, h.needs_assistance, h.non_swimmers,
         h.livestock, h.safe_at, h.updated_at
    FROM public.households AS h
   WHERE h.device_id = p_device_id
     AND length(p_device_id) >= 16
   LIMIT 1;
$$;

-- ------------------------------------------------------------
-- Save: first run and every edit afterwards
-- ------------------------------------------------------------
-- One function for both, because "create" and "update" are the same act from the
-- handset's point of view and two functions would mean the app has to know which
-- one it is — which, after a reinstall, it does not.
--
-- The conflict target is `device_id`, so this can only ever write the row that
-- belongs to the id it was handed. There is no code path here that reaches
-- another household's row, which is the property that makes the sealed table
-- above safe to open at all.
--
-- Returns `updated_at` so the caller can cache the profile with the same
-- timestamp the server holds, rather than its own clock.
CREATE OR REPLACE FUNCTION public.update_household(
  p_device_id        text,
  p_language         text    DEFAULT 'en',
  p_contact_name     text    DEFAULT NULL,
  p_ward             text    DEFAULT NULL,
  p_address          text    DEFAULT NULL,
  p_people           int     DEFAULT 1,
  p_tenure           text    DEFAULT NULL,
  p_elderly          int     DEFAULT 0,
  p_infants          int     DEFAULT 0,
  p_pregnant         int     DEFAULT 0,
  p_needs_assistance int     DEFAULT 0,
  p_non_swimmers     int     DEFAULT 0,
  p_livestock        text    DEFAULT NULL
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _saved timestamptz;
BEGIN
  IF p_device_id IS NULL OR length(p_device_id) < 16 THEN
    RAISE EXCEPTION 'device id must be at least 16 characters';
  END IF;

  INSERT INTO public.households AS h (
    device_id, language, contact_name, ward, address, people, tenure,
    elderly, infants, pregnant, needs_assistance, non_swimmers, livestock
  ) VALUES (
    p_device_id, p_language, p_contact_name, p_ward, p_address, p_people, p_tenure,
    p_elderly, p_infants, p_pregnant, p_needs_assistance, p_non_swimmers, p_livestock
  )
  ON CONFLICT (device_id) DO UPDATE SET
    language         = EXCLUDED.language,
    contact_name     = EXCLUDED.contact_name,
    ward             = EXCLUDED.ward,
    address          = EXCLUDED.address,
    people           = EXCLUDED.people,
    tenure           = EXCLUDED.tenure,
    elderly          = EXCLUDED.elderly,
    infants          = EXCLUDED.infants,
    pregnant         = EXCLUDED.pregnant,
    needs_assistance = EXCLUDED.needs_assistance,
    non_swimmers     = EXCLUDED.non_swimmers,
    livestock        = EXCLUDED.livestock,
    updated_at       = now()
  -- Not touched on update: consented_at and created_at keep the original stamps,
  -- and safe_at is not this function's business. Editing your address must never
  -- silently retract a "we are safe".
  RETURNING h.updated_at INTO _saved;

  RETURN _saved;
END;
$$;

-- ------------------------------------------------------------
-- Roll-call
-- ------------------------------------------------------------
-- The inverse of SOS, and the highest-value thing in this migration: rescue teams
-- repeatedly search houses that had already walked out on their own. One tap here
-- takes a household off the search list.
--
-- It requires an existing profile rather than creating one, because a "we are
-- safe" ping with no address tells a control room nothing it can act on — it just
-- adds a row to a list of unknowns. The app has to say so instead of pretending
-- the tap landed.
--
-- Reversible on purpose. Water rises again, and a household that sheltered
-- upstairs at noon can need a boat by evening. Passing p_safe => false clears the
-- flag and the position with it.
CREATE OR REPLACE FUNCTION public.mark_household_safe(
  p_device_id text,
  p_safe      boolean DEFAULT true,
  p_latitude  float8  DEFAULT NULL,
  p_longitude float8  DEFAULT NULL
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _at timestamptz;
BEGIN
  IF p_device_id IS NULL OR length(p_device_id) < 16 THEN
    RAISE EXCEPTION 'device id must be at least 16 characters';
  END IF;

  UPDATE public.households SET
    safe_at        = CASE WHEN p_safe THEN now() END,
    safe_latitude  = CASE WHEN p_safe THEN p_latitude END,
    safe_longitude = CASE WHEN p_safe THEN p_longitude END,
    updated_at     = now()
  WHERE device_id = p_device_id
  RETURNING safe_at INTO _at;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no household on record for this device';
  END IF;

  -- NULL here is unambiguous: NOT FOUND already raised, so a null return means
  -- "no longer marked safe" rather than "we could not find you".
  RETURN _at;
END;
$$;

-- ------------------------------------------------------------
-- Grants
-- ------------------------------------------------------------
-- Postgres grants EXECUTE on a new function to PUBLIC by default, which would
-- hand it to every present and future role. Revoke first, then name the two roles
-- that should have it. The signatures have to be spelled out in full; a bare name
-- will not resolve once a function has defaults.
REVOKE ALL ON FUNCTION public.restore_household(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_household(
  text, text, text, text, text, int, text, int, int, int, int, int, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_household_safe(text, boolean, float8, float8)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.restore_household(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_household(
  text, text, text, text, text, int, text, int, int, int, int, int, text
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_household_safe(text, boolean, float8, float8)
  TO anon, authenticated;

-- ------------------------------------------------------------
-- Retention
-- ------------------------------------------------------------
-- The DPDP Act's storage limitation principle says personal data is kept for as
-- long as the purpose needs it and no longer. The purpose here is evacuation, so a
-- profile that has not been confirmed or edited in two years is not being kept for
-- that purpose — it is a register sitting in a database waiting to leak.
--
-- `updated_at` is therefore the retention clock, which means the app should call
-- update_household when someone reviews their details rather than only when they
-- change them. Reviewing is the consent being renewed.
--
-- Not reachable by anon or authenticated: this is maintenance.
CREATE OR REPLACE FUNCTION public.purge_stale_households(p_older_than interval
  DEFAULT interval '2 years')
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _gone int;
BEGIN
  DELETE FROM public.households
   WHERE updated_at < now() - p_older_than;
  GET DIAGNOSTICS _gone = ROW_COUNT;
  RETURN _gone;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_stale_households(interval) FROM PUBLIC;
-- Named explicitly rather than left to inheritance, so the comment above is true:
-- after the revoke, nothing but the owner could call it otherwise.
GRANT EXECUTE ON FUNCTION public.purge_stale_households(interval) TO service_role;

-- Schedule it once pg_cron is enabled on the project. Left commented rather than
-- run, because a migration that starts deleting citizen records the moment it is
-- applied should be a decision somebody makes on purpose:
--
--   SELECT cron.schedule('purge-stale-households', '0 3 1 * *',
--                        $c$ SELECT public.purge_stale_households(); $c$);

-- ------------------------------------------------------------
-- No seed data
-- ------------------------------------------------------------
-- 005 and 006 seed real places, because a shelter that does not exist is a bug
-- and a demo needs shelters. There is no equivalent here. Inventing four
-- households with names and addresses, even fake ones, would put rows in a
-- population register that no person consented to, and would make the roll-call
-- screen look populated when nobody has actually reported in. The table starts
-- empty and the app's first-run flow is what fills it.
