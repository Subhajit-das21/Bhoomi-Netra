# 🛰️ BHOOMI-NETRA — Disaster Monitoring IoT Platform

> **SIH 2026 — Problem Statement 26178**  
> Real-time environmental monitoring with ESP32 sensor nodes, Supabase backend, and a React (Vite) dashboard.

---

## ⚡ FIRST — Enable Supabase Realtime (DON'T SKIP THIS)

> **🚨 If you skip this step, the live dashboard will NOT update in real-time. It will silently fail.**

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **Database → Replication**
3. Find the `readings` table → **toggle Realtime ON**
4. Find the `alerts` table → **toggle Realtime ON**
5. Also enable the **PostGIS** extension: **Database → Extensions → search "postgis" → toggle ON**

---

## 📁 Project Structure

```
bhoomi-netra/
├── supabase/              # Database migrations & config
│   ├── config.toml
│   └── migrations/        # SQL files, run in order (001 → 005)
├── frontend/              # React 19 (Vite) command-centre dashboard
│   ├── src/pages/         # Dashboard, sensor nodes, live map, alerts
│   ├── src/components/    # Reusable panels and widgets
│   └── src/lib/           # Supabase client, weather/fire APIs
├── firmware/              # ESP32 Arduino sketches (hardware team)
└── README.md              # You are here
```

## 🔧 Prerequisites

- **Node.js** v18 or later ([download](https://nodejs.org))
- **npm** v9+ (comes with Node.js)
- **Git**
- A **Supabase** project (free tier is fine — [supabase.com](https://supabase.com))

## 🚀 Quick Start

### 1. Clone & install

```bash
git clone https://github.com/<your-username>/bhoomi-netra.git
cd bhoomi-netra/frontend
npm install
```

### 2. Set up environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> **Where to find these:** Supabase Dashboard → Settings → API  
> The project lead will share the real values with you (they are NOT in git).

### 3. Run the database migrations

Go to your **Supabase Dashboard → SQL Editor** and run each file in `/supabase/migrations/` in order:

1. `001_extensions.sql` — enables PostGIS
2. `002_tables.sql` — creates tables + indexes
3. `003_rls_policies.sql` — sets up row-level security
4. `004_alert_trigger.sql` — auto-alert generation from readings
5. `005_seed_data.sql` — fake sensor nodes + readings for dev

### 4. Start the dashboard

```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — you should see the dark-themed command centre with a sensor map and the live Supabase node telemetry.

## 🌐 ESP32 Firmware API

See [`/firmware/README.md`](firmware/README.md) for the full REST API contract.

**Quick version:**

```bash
curl -X POST 'https://xxxxx.supabase.co/rest/v1/readings' \
  -H 'apikey: YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"node_id": "a1b2c3d4-0001-4000-8000-000000000001", "temperature": 35.5, "humidity": 72.0, "flame_detected": false, "smoke_level": 150, "water_level": 800, "rain_level": 60}'
```

## 🧑💻 Team

Built for Smart India Hackathon 2026.  
Problem Statement: **SIH26178** — Disaster Monitoring & Early Warning System.
