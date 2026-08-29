-- ============================================================
-- Row Level Security — Hackathon Mode
-- Public read/insert for telemetry, restricted admin for nodes
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE sensor_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE readings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts        ENABLE ROW LEVEL SECURITY;

-- sensor_nodes: anyone can read, only authenticated users can insert
CREATE POLICY "sensor_nodes_select" ON sensor_nodes
  FOR SELECT USING (true);

CREATE POLICY "sensor_nodes_insert" ON sensor_nodes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- readings: public insert + select (ESP32 posts with anon key)
CREATE POLICY "readings_select" ON readings
  FOR SELECT USING (true);

CREATE POLICY "readings_insert" ON readings
  FOR INSERT WITH CHECK (true);

-- alerts: public insert + select (trigger inserts, dashboard reads)
CREATE POLICY "alerts_select" ON alerts
  FOR SELECT USING (true);

CREATE POLICY "alerts_insert" ON alerts
  FOR INSERT WITH CHECK (true);
