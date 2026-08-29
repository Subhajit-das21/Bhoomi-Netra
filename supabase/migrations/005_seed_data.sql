-- ============================================================
-- Seed Data: 6 nodes around Kolkata + 20 historical readings
-- Uses ST_MakePoint(lng, lat)::geography for PostGIS correctness
-- ============================================================

-- 6 sensor nodes spread within ~10km of Kolkata center (22.5726, 88.3639)
INSERT INTO sensor_nodes (id, name, node_type, latitude, longitude, location) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Sundarbans Edge Alpha',   'forest',    22.5120, 88.3290, ST_MakePoint(88.3290, 22.5120)::geography),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Salt Lake Sector V',      'urban',     22.5744, 88.4318, ST_MakePoint(88.4318, 22.5744)::geography),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'Howrah Bridge West',      'urban',     22.5851, 88.3468, ST_MakePoint(88.3468, 22.5851)::geography),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'Rabindra Sarobar Park',   'forest',    22.5110, 88.3590, ST_MakePoint(88.3590, 22.5110)::geography),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'New Town Eco Park',       'universal', 22.6014, 88.4625, ST_MakePoint(88.4625, 22.6014)::geography),
  ('a1b2c3d4-0006-4000-8000-000000000006', 'Jadavpur Campus',         'universal', 22.4966, 88.3712, ST_MakePoint(88.3712, 22.4966)::geography);

-- 20 historical readings spread across the last 24 hours
-- Realistic ranges: temp 25-42°C, humidity 55-95%, smoke 50-800, water 100-3200, rain 0-500
INSERT INTO readings (node_id, temperature, humidity, flame_detected, smoke_level, water_level, rain_level, created_at) VALUES
  -- Sundarbans Edge Alpha (forest node, humid)
  ('a1b2c3d4-0001-4000-8000-000000000001', 31.2, 82.5, false, 95,  380,  45,  now() - interval '23 hours'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 30.8, 85.1, false, 110, 420,  120, now() - interval '18 hours'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 29.5, 88.3, false, 80,  1800, 280, now() - interval '12 hours'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 28.9, 91.0, false, 75,  2100, 350, now() - interval '6 hours'),

  -- Salt Lake Sector V (urban, drier)
  ('a1b2c3d4-0002-4000-8000-000000000002', 34.5, 62.0, false, 180, 150,  10,  now() - interval '22 hours'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 35.1, 58.5, false, 220, 130,  5,   now() - interval '16 hours'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 36.8, 55.0, false, 350, 100,  0,   now() - interval '10 hours'),

  -- Howrah Bridge West (urban, riverside)
  ('a1b2c3d4-0003-4000-8000-000000000003', 32.0, 71.5, false, 200, 900,  30,  now() - interval '21 hours'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 31.5, 74.0, false, 190, 1200, 90,  now() - interval '15 hours'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 30.2, 79.5, false, 160, 2500, 220, now() - interval '8 hours'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 29.8, 82.0, false, 140, 3100, 310, now() - interval '2 hours'),

  -- Rabindra Sarobar Park (forest, near lake)
  ('a1b2c3d4-0004-4000-8000-000000000004', 30.5, 76.0, false, 85,  600,  55,  now() - interval '20 hours'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 29.8, 80.5, false, 90,  750,  100, now() - interval '14 hours'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 42.1, 65.0, true,  620, 400,  20,  now() - interval '5 hours'),

  -- New Town Eco Park (universal)
  ('a1b2c3d4-0005-4000-8000-000000000005', 33.0, 68.0, false, 150, 500,  40,  now() - interval '19 hours'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 32.5, 70.5, false, 170, 550,  60,  now() - interval '13 hours'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 31.0, 75.0, false, 130, 800,  150, now() - interval '7 hours'),

  -- Jadavpur Campus (universal)
  ('a1b2c3d4-0006-4000-8000-000000000006', 33.5, 66.5, false, 250, 300,  15,  now() - interval '17 hours'),
  ('a1b2c3d4-0006-4000-8000-000000000006', 34.2, 63.0, false, 280, 280,  10,  now() - interval '11 hours'),
  ('a1b2c3d4-0006-4000-8000-000000000006', 35.0, 60.0, false, 310, 250,  5,   now() - interval '4 hours');

-- Seed alerts: the trigger would have fired for some of these readings
-- Howrah Bridge reading at -2h had water_level 3100 -> flood/high
-- Rabindra Sarobar reading at -5h had flame+temp>40 -> fire/high
-- Sundarbans reading at -6h had water_level 2100 -> flood/medium
INSERT INTO alerts (node_id, hazard_type, severity, message, resolved, created_at) VALUES
  ('a1b2c3d4-0003-4000-8000-000000000003', 'flood', 'high',   '🌊 Critical water level: 3100/4095 — possible flooding.', false, now() - interval '2 hours'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'fire',  'high',   '🔥 Fire detected at node. Temp: 42.1°C, flame sensor active.', false, now() - interval '5 hours'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'flood', 'medium', '💧 Elevated water level: 2100/4095 — monitor closely.', false, now() - interval '6 hours');
