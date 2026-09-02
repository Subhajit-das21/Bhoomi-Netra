-- ============================================================
-- BHOOMI-NETRA: Citizen app tables
-- Shelters, risk zones and surveyed walking routes
-- SIH 2026 (26178)
-- ============================================================
--
-- The citizen app needs three things the sensor schema does not carry: where a
-- person can go, which ground is dangerous, and how to walk between the two.
-- They lived as TypeScript fixtures inside the app while the screens were being
-- built. A shelter roster compiled into a binary is a shelter roster that cannot
-- be corrected during a flood, so they move here.
--
-- Geometry contract: `risk_zones.area` is the single source of truth. Clients do
-- not read it directly — PostgREST would hand them WKB hex — they read the
-- `risk_zones_geojson` view, which returns GeoJSON with longitude-first
-- coordinate pairs. That is PostGIS's own order and the order the app's
-- point-in-polygon test already expects.

CREATE TABLE shelters (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  -- Plain-language address. A citizen who loses signal mid-walk still has this,
  -- so it has to stand on its own without a map behind it.
  address          text NOT NULL,
  latitude         float8 NOT NULL,
  longitude        float8 NOT NULL,
  location         extensions.geography(Point, 4326),
  capacity         int4 NOT NULL CHECK (capacity > 0),
  occupancy        int4 NOT NULL DEFAULT 0 CHECK (occupancy >= 0),
  status           text NOT NULL CHECK (status IN ('open', 'full', 'closed')),
  -- Ground floor above local datum. Kolkata is almost flat, so a metre of height
  -- is the difference between a dry shelter and a wet one — this drives the
  -- app's recommendation more than distance does.
  elevation_metres float4 NOT NULL,
  facilities       text[] NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE risk_zones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  hazard_type text NOT NULL CHECK (hazard_type IN ('flood', 'fire')),
  severity    text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  area        extensions.geography(Polygon, 4326) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Surveyed walking directions, one row per leg.
--
-- Deliberately allowed to be absent: a district will have walked and checked
-- routes to the halls it actually evacuates people to, and not to every building
-- on the list. The app must be able to say "I do not have turn-by-turn for this
-- one" rather than serving another shelter's streets under this shelter's name.
CREATE TABLE shelter_routes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shelter_id      uuid NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
  step_order      int4 NOT NULL CHECK (step_order > 0),
  manoeuvre       text NOT NULL CHECK (manoeuvre IN ('start', 'left', 'right', 'straight', 'arrive')),
  -- One instruction, imperative, naming a real street.
  instruction     text NOT NULL,
  distance_metres int4 NOT NULL CHECK (distance_metres > 0),
  -- Set when this leg is the risky part, so the app can warn on the step itself
  -- rather than only at the top of the route.
  caution         text,
  UNIQUE (shelter_id, step_order)
);

CREATE INDEX idx_shelters_status        ON shelters(status);
CREATE INDEX idx_shelters_location      ON shelters USING gist(location);
CREATE INDEX idx_risk_zones_area        ON risk_zones USING gist(area);
CREATE INDEX idx_shelter_routes_shelter ON shelter_routes(shelter_id, step_order);

-- ------------------------------------------------------------
-- Zone geometry for clients
-- ------------------------------------------------------------
-- security_invoker so the caller's RLS applies rather than the view owner's.
-- Without it this view would be a hole straight through row level security.
CREATE VIEW risk_zones_geojson WITH (security_invoker = true) AS
SELECT
  id,
  name,
  hazard_type,
  severity,
  extensions.ST_AsGeoJSON(area)::jsonb AS geojson
FROM risk_zones;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
-- Read-only for everyone, including the anon key the mobile app ships with.
-- No insert or update policy is defined on purpose: a citizen handset must never
-- be able to edit the shelter roster or redraw a hazard zone. Authorities write
-- through the dashboard's authenticated session or the service role.
ALTER TABLE shelters       ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_zones     ENABLE ROW LEVEL SECURITY;
ALTER TABLE shelter_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shelters_select" ON shelters
  FOR SELECT USING (true);

CREATE POLICY "risk_zones_select" ON risk_zones
  FOR SELECT USING (true);

CREATE POLICY "shelter_routes_select" ON shelter_routes
  FOR SELECT USING (true);

-- ============================================================
-- Seed: real places in and around Ward 58, Kolkata
-- ============================================================
--
-- Fixed uuids in the same style as the sensor node seeds, so shelter_routes can
-- reference them and so re-running against a fresh database gives the same ids
-- the app was reviewed against.

INSERT INTO shelters (id, name, address, latitude, longitude, location, capacity, occupancy, status, elevation_metres, facilities) VALUES
  ('b1c2d3e4-0001-4000-8000-000000000001',
   'Deshapriya Park Community Hall',
   'Deshapriya Park East, off Rash Behari Avenue',
   22.5175, 88.3585, extensions.ST_MakePoint(88.3585, 22.5175)::extensions.geography,
   400, 186, 'open', 7.5,
   ARRAY['Drinking water', 'Toilets', 'Medical desk', 'Phone charging']),

  ('b1c2d3e4-0002-4000-8000-000000000002',
   'Lake Gardens Govt. High School',
   'Lake Gardens, near the railway crossing',
   22.5060, 88.3560, extensions.ST_MakePoint(88.3560, 22.5060)::extensions.geography,
   250, 244, 'full', 6.5,
   ARRAY['Drinking water', 'Toilets']),

  ('b1c2d3e4-0003-4000-8000-000000000003',
   'Netaji Indoor Stadium',
   'Eden Gardens, Strand Road',
   22.5636, 88.3395, extensions.ST_MakePoint(88.3395, 22.5636)::extensions.geography,
   2000, 410, 'open', 6.0,
   ARRAY['Drinking water', 'Toilets', 'Medical desk', 'Cooked meals', 'Family rooms']),

  ('b1c2d3e4-0004-4000-8000-000000000004',
   'Jadavpur Vidyapith',
   'Bijoygarh, off Raja S C Mallick Road',
   22.4990, 88.3695, extensions.ST_MakePoint(88.3695, 22.4990)::extensions.geography,
   300, 92, 'open', 8.2,
   ARRAY['Drinking water', 'Toilets', 'Cooked meals']);

-- Three coarse zones, not a dense grid. The authority dashboard is where a
-- fine-grained heatmap belongs; a citizen needs to know "am I in it or not".
-- Rings are closed (first point repeated) as POLYGON requires, longitude first.
INSERT INTO risk_zones (id, name, hazard_type, severity, area) VALUES
  ('c1d2e3f4-0001-4000-8000-000000000001',
   'Ward 58 low-lying lanes', 'flood', 'critical',
   extensions.ST_GeogFromText('SRID=4326;POLYGON((88.3555 22.5105, 88.3665 22.5115, 88.3675 22.5185, 88.3565 22.5175, 88.3555 22.5105))')),

  ('c1d2e3f4-0002-4000-8000-000000000002',
   'Hooghly east bank', 'flood', 'high',
   extensions.ST_GeogFromText('SRID=4326;POLYGON((88.3405 22.5745, 88.3515 22.5765, 88.3535 22.5925, 88.3425 22.5905, 88.3405 22.5745))')),

  ('c1d2e3f4-0003-4000-8000-000000000003',
   'Rabindra Sarobar dry scrub', 'fire', 'high',
   extensions.ST_GeogFromText('SRID=4326;POLYGON((88.3545 22.5075, 88.3625 22.5065, 88.3635 22.5135, 88.3555 22.5145, 88.3545 22.5075))'));

-- Walking routes for the two shelters reachable on foot from Ward 58.
-- Lake Gardens (full) and Netaji Indoor (5.9 km) deliberately have none, which is
-- what exercises the app's direction-only fallback.
--
-- Leg distances sum to more than the straight-line distance, because streets do.
INSERT INTO shelter_routes (shelter_id, step_order, manoeuvre, instruction, distance_metres, caution) VALUES
  ('b1c2d3e4-0001-4000-8000-000000000001', 1, 'start',  'Head north on Sadananda Road, away from the canal', 120, NULL),
  ('b1c2d3e4-0001-4000-8000-000000000001', 2, 'right',  'Turn right onto Rash Behari Avenue', 260, 'Water was knee-deep near the tram tracks 20 minutes ago'),
  ('b1c2d3e4-0001-4000-8000-000000000001', 3, 'left',   'Turn left onto Deshapriya Park East', 90, NULL),
  ('b1c2d3e4-0001-4000-8000-000000000001', 4, 'arrive', 'Shelter entrance is on your right, past the park gate', 40, NULL),

  -- The underpass caution is the most important line in this file. Kolkata's rail
  -- underpasses fill first and drain last, and an underpass is where a walk in a
  -- flood becomes a drowning. The route still goes that way because it is the only
  -- continuous corridor south, so the step says plainly what to do instead of it.
  ('b1c2d3e4-0004-4000-8000-000000000004', 1, 'start',  'Head south on Sadananda Road towards Tollygunge', 200, NULL),
  ('b1c2d3e4-0004-4000-8000-000000000004', 2, 'left',   'Turn left onto Prince Anwar Shah Road', 700, 'Do not enter the rail underpass if water is standing in it. Use the footbridge above it instead.'),
  ('b1c2d3e4-0004-4000-8000-000000000004', 3, 'right',  'Turn right onto Raja S C Mallick Road', 900, 'Stay on the raised footpath — the road edge holds water here'),
  ('b1c2d3e4-0004-4000-8000-000000000004', 4, 'left',   'Turn left into Bijoygarh, past the market', 420, NULL),
  ('b1c2d3e4-0004-4000-8000-000000000004', 5, 'arrive', 'Jadavpur Vidyapith gate is ahead on your left', 90, NULL);

