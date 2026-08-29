-- ============================================================
-- Auto-generate alerts from anomalous sensor readings
-- Dedup: skip if same hazard_type + node_id unresolved within 10 min
-- ============================================================

CREATE OR REPLACE FUNCTION generate_alert_from_reading()
RETURNS TRIGGER AS $$
DECLARE
  _hazard  text;
  _severity text;
  _message text;
  _exists  boolean;
BEGIN
  -- Fire detection: flame sensor triggered AND temperature > 40°C
  IF NEW.flame_detected = true AND NEW.temperature > 40 THEN
    _hazard   := 'fire';
    _severity := 'high';
    _message  := format('🔥 Fire detected at node. Temp: %s°C, flame sensor active.', round(NEW.temperature::numeric, 1));
  -- Flood high: water level > 3000 (of 4095 ADC range)
  ELSIF NEW.water_level > 3000 THEN
    _hazard   := 'flood';
    _severity := 'high';
    _message  := format('🌊 Critical water level: %s/4095 — possible flooding.', NEW.water_level);
  -- Flood medium: water level > 2000
  ELSIF NEW.water_level > 2000 THEN
    _hazard   := 'flood';
    _severity := 'medium';
    _message  := format('💧 Elevated water level: %s/4095 — monitor closely.', NEW.water_level);
  ELSE
    -- No alert condition met
    RETURN NEW;
  END IF;

  -- Dedup: check for unresolved alert of same type+node within last 10 min
  SELECT EXISTS (
    SELECT 1 FROM alerts
    WHERE node_id     = NEW.node_id
      AND hazard_type = _hazard
      AND resolved    = false
      AND created_at  > (now() - interval '10 minutes')
  ) INTO _exists;

  IF NOT _exists THEN
    INSERT INTO alerts (node_id, hazard_type, severity, message)
    VALUES (NEW.node_id, _hazard, _severity, _message);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_reading_alert
  AFTER INSERT ON readings
  FOR EACH ROW
  EXECUTE FUNCTION generate_alert_from_reading();
