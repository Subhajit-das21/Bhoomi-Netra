# 🔧 Firmware — ESP32 Sensor Nodes

> **Hardware team's Arduino sketches go here.**

This folder will contain `.ino` files for the ESP32 microcontrollers deployed as BHOOMI-NETRA sensor nodes.

## ESP32 → Supabase REST API Contract

Each node POSTs sensor readings to Supabase's auto-generated REST API:

```
POST https://<your-project-ref>.supabase.co/rest/v1/readings

Headers:
  apikey: <SUPABASE_ANON_KEY>
  Content-Type: application/json
  Prefer: return=minimal

Body:
{
  "node_id": "uuid-of-this-sensor-node",
  "temperature": 32.5,
  "humidity": 78.0,
  "flame_detected": false,
  "smoke_level": 120,
  "water_level": 450,
  "rain_level": 200
}

Response: 201 Created (empty body with Prefer: return=minimal)
```

### Field specs for the firmware team:

| Field           | Type    | Range / Notes                                |
|-----------------|---------|----------------------------------------------|
| `node_id`       | string  | UUID assigned to this physical node          |
| `temperature`   | float   | °C from DHT22 / DS18B20                      |
| `humidity`      | float   | % RH from DHT22                              |
| `flame_detected`| boolean | `true` if IR flame sensor triggered          |
| `smoke_level`   | int     | 0–4095 (12-bit ADC from MQ-2/MQ-135)        |
| `water_level`   | int     | 0–4095 (12-bit ADC from water level sensor)  |
| `rain_level`    | int     | 0–4095 (12-bit ADC from rain sensor)         |

### Auth

The `apikey` header uses the **anon/public** key — safe to hardcode in firmware for this hackathon demo. The Supabase RLS policies allow public INSERT on the `readings` table.

### Alert generation

Alerts are generated **server-side** by a Postgres trigger. The firmware does NOT need to create alerts — just POST readings.
