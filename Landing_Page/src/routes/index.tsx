import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Apple,
  Bell,
  Clock,
  Cpu,
  FileText,
  Flame,
  IndianRupee,
  Landmark,
  LayoutDashboard,
  Map,
  Play,
  Radio,
  Shield,
  TrendingDown,
  Waves,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import phoneApp from "@/assets/phone-app.jpg";
import phoneDashboard from "@/assets/phone-dashboard.jpg";
import hardwareNodeIso from "@/assets/hardware-node-iso.png";
import hardwareBlueprint from "@/assets/hardware-blueprint.jpg";
import logoUrl from "@/assets/bhoomi-logo.webp";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BHOOMI-Netra — Disaster Early Warning for India" },
      {
        name: "description",
        content:
          "BHOOMI-Netra is a smart sensor network for floods and forest fires that doesn't just detect disasters — it predicts how they'll spread, so people can get out of the way before it's too late.",
      },
      { property: "og:title", content: "BHOOMI-Netra — Disaster Early Warning for India" },
      {
        property: "og:description",
        content:
          "Solar-powered field sensors, terrain-based spread simulation, and instant citizen alerts for floods and forest fires across India.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "preload",
        href: "/hf_20260801_001207_ec20d138-aa45-4b2b-ab8c-bdc71607f240.mp4",
        as: "video",
        type: "video/mp4",
      },
    ],
  }),
  component: Index,
});

const VIDEO_URL = "/hf_20260801_001207_ec20d138-aa45-4b2b-ab8c-bdc71607f240.mp4";

// The signed release APK, served as a GitHub Release asset rather than from
// public/ — an 84 MiB file cannot ship in the Cloudflare Pages bundle, which
// caps each asset at 25 MiB. `releases/latest` resolves to whichever release is
// newest, so every build keeps the same asset name and this URL never changes.
const APK_HREF =
  "https://github.com/Subhajit-das21/Bhoomi-Netra/releases/latest/download/bhoomi-netra-citizen.apk";

// The operations dashboard, a separate Vite SPA in frontend/, deployed as its
// own worker. This was http://localhost:5173/, which only ever resolved on the
// dev machine.
const DASHBOARD_HREF = "https://sih-dash.subhajitdas.in";

function Logo() {
  return (
    <div className="absolute left-1/2 top-8 z-10 -translate-x-1/2 sm:top-12 origin-top flex flex-col items-center gap-2">
      <a href="#top" aria-label="BHOOMI-Netra">
        <div className="flex h-10 items-center gap-3.5" style={{ width: "fit-content" }}>
          <img
            src={logoUrl}
            alt="BHOOMI-Netra emblem — Early Warning, Earth-Wide"
            width={80}
            height={80}
            className="h-10 w-10 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.5)] ring-1 ring-white/25"
          />
          <span
            className="text-white tracking-tight leading-none select-none"
            style={{
              fontFamily: "var(--font-mono-display)",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.06em",
            }}
          >
            BHOOMI&#8209;NETRA
          </span>
        </div>
      </a>
      <p
        className="text-white/50 uppercase"
        style={{
          fontFamily: "var(--font-mono-display)",
          fontSize: 12,
          letterSpacing: "0.35em",
          fontWeight: 600,
        }}
      >
        Early Warning · India
      </p>
    </div>
  );
}

function BackgroundVideo() {
  return (
    <video
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
      src={VIDEO_URL}
      className="absolute inset-0 h-full w-full object-cover opacity-100"
    />
  );
}

// ── "Cost of a late warning" data ───────────────────────────────────
// Damage falls as warning lead time grows. The curve below is an illustrative
// model of that relationship for the landing page; the one hard anchor is the
// widely cited finding that a 24-hour warning of an impending hazard can cut
// the ensuing damage by ~30% (Global Commission on Adaptation, 2019).
const WARNING_DATA = [
  { hours: 0, damage: 100 },
  { hours: 3, damage: 92 },
  { hours: 6, damage: 85 },
  { hours: 12, damage: 77 },
  { hours: 24, damage: 70 }, // ← −30% anchor (GCA 2019)
  { hours: 48, damage: 60 },
  { hours: 72, damage: 52 },
];

function WarningTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const saved = 100 - row.damage;
  return (
    <div className="rounded-lg border border-white/10 bg-black/95 px-3 py-2 text-[11px] shadow-xl">
      <div className="font-medium text-white/85" style={{ fontFamily: "var(--font-mono-display)" }}>
        {row.hours === 0 ? "No warning" : `~${row.hours} h warning`}
      </div>
      <div className="mt-0.5 flex justify-between gap-4 text-white/55 tabular-nums">
        <span>Damage</span>
        <span>{row.damage}%</span>
      </div>
      <div className="flex justify-between gap-4 text-emerald-300 tabular-nums">
        <span>Saved</span>
        <span>{saved}%</span>
      </div>
      {row.hours === 24 && (
        <div className="mt-1 border-t border-white/10 pt-1 text-white/40">
          24 h → −30% damage (GCA, 2019)
        </div>
      )}
    </div>
  );
}

/** A small labeled row heading for each data group (India / West Bengal). */
function GroupLabel({ icon: Icon, children }) {
  return (
    <div
      className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/45"
      style={{ fontFamily: "var(--font-mono-display)" }}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
      <span className="h-px flex-1 bg-white/10" aria-hidden="true" />
    </div>
  );
}

/** A single statistic tile: big value, label, optional supporting note/badge. */
function StatTile({ value, label, sub, badge, accent = "text-white", icon: Icon }) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/20">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/55">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        {badge && (
          <span className="rounded-full border border-amber-400/30 bg-amber-500/15 px-2 py-[1px] text-[9px] font-semibold uppercase tracking-wider text-amber-300">
            {badge}
          </span>
        )}
      </div>
      <div
        className={`mt-3 text-3xl font-bold tabular-nums ${accent}`}
        style={{ fontFamily: "var(--font-mono-display)", letterSpacing: "-0.04em" }}
      >
        {value}
      </div>
      <div className="mt-2">
        <div className="text-sm font-medium text-white/80">{label}</div>
        <div className="mt-1 text-[11px] leading-relaxed text-white/40">{sub}</div>
      </div>
    </div>
  );
}

function Index() {
  return (
    <main className="relative min-h-svh w-full overflow-x-hidden bg-black text-white">
      {/* HERO — full viewport */}
      <section id="top" className="relative flex min-h-svh w-full flex-col overflow-hidden">
        <BackgroundVideo />
        <Logo />

        {/* Hero content — single flex column */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-end px-5 pb-12 pt-32 text-center sm:pb-14 sm:pt-36">
          {/* Headline — pushed to vertical center via auto margins */}
          <div className="my-auto flex items-center">
            <h1
              className="leading-[0.95] max-w-[900px]"
              style={{
                fontFamily: "var(--font-mono-display)",
                fontWeight: 600,
                fontSize: "clamp(56px, 12vw, 128px)",
                letterSpacing: "-0.07em",
                backgroundImage:
                  "linear-gradient(247.33deg, rgb(255,255,255) 2.53%, rgba(255,255,255,0.4) 93.61%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
                paddingBottom: "0.12em",
              }}
            >
              See disaster
              <br />
              before it strikes.
            </h1>
          </div>

          {/* Divider line */}
          <div
            className="mt-10 h-px w-full max-w-[620px] bg-white/60 sm:mt-14"
            aria-hidden="true"
          />

          {/* Subtitle */}
          <p
            className="mt-10 sm:mt-14 max-w-[50ch] text-white"
            style={{
              fontFamily: "var(--font-mono-display)",
              fontWeight: 600,
              fontSize: "clamp(15px, 4.5vw, 20px)",
              lineHeight: 1.35,
              letterSpacing: "-1.3px",
            }}
          >
            A smart sensor network that doesn't just detect floods &amp; forest fires — it predicts
            how they'll spread. So people get out of the way before it's too late.
          </p>

          {/* Download CTAs */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:mt-8">
            <a
              href="#download"
              className="flex items-center gap-2 rounded-full bg-white px-5 py-3 text-black shadow-xl transition-all hover:scale-105"
              style={{ fontFamily: "var(--font-mono-display)", fontWeight: 600, fontSize: 14 }}
            >
              <Apple className="h-4 w-4" aria-hidden="true" />
              iOS
            </a>
            {/* The Android build is distributed as an APK rather than a store
                listing. No `download` attribute: browsers ignore it cross-origin,
                and GitHub already serves the asset as an attachment. */}
            <a
              href={APK_HREF}
              title="Download the citizen app (Android APK)"
              className="flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-5 py-3 text-white backdrop-blur-md transition-all hover:bg-black/80 hover:border-white/50 shadow-lg"
              style={{ fontFamily: "var(--font-mono-display)", fontWeight: 600, fontSize: 14 }}
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              Android
            </a>
            <a
              href={DASHBOARD_HREF}
              className="flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-5 py-3 text-white backdrop-blur-md transition-all hover:bg-black/80 hover:border-white/50 shadow-lg"
              style={{ fontFamily: "var(--font-mono-display)", fontWeight: 600, fontSize: 14 }}
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              Dashboard
            </a>
            <Dialog>
              <DialogTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-full border border-brand/50 bg-black/60 px-5 py-3 text-brand backdrop-blur-md transition-all hover:bg-brand/20 hover:border-brand shadow-lg cursor-pointer"
                  style={{ fontFamily: "var(--font-mono-display)", fontWeight: 600, fontSize: 14 }}
                >
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  Pitch Deck
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl h-[85vh] w-[95vw] p-0 border border-white/20 bg-white/5 backdrop-blur-2xl overflow-hidden rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col gap-0 [&>button:last-child]:hidden">
                <DialogTitle className="sr-only">BHOOMI-Netra Pitch Deck</DialogTitle>

                <div className="h-14 w-full bg-transparent flex items-center justify-between px-5 border-b border-white/10 shrink-0 relative z-10">
                  <span
                    className="text-white/80 text-sm tracking-wider uppercase font-semibold flex items-center gap-2"
                    style={{ fontFamily: "var(--font-mono-display)" }}
                  >
                    <FileText className="h-4 w-4 text-brand" />
                    BHOOMI-Netra Pitch Deck
                  </span>

                  <DialogClose asChild>
                    <button className="h-8 w-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 hover:scale-105 transition-all outline-none focus:ring-2 focus:ring-white/50 cursor-pointer">
                      <X className="h-4 w-4" />
                      <span className="sr-only">Close Preview</span>
                    </button>
                  </DialogClose>
                </div>

                <div className="flex-1 w-full relative p-3 sm:p-6 bg-transparent overflow-hidden">
                  <div className="w-full h-full rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-white">
                    <iframe
                      src="/BHOOMI-NETRA-SIH.pdf#toolbar=0&navpanes=0&view=FitH"
                      className="w-full h-full border-0"
                      title="BHOOMI-Netra Pitch Deck PDF Preview"
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Scroll hint */}
          <p
            className="text-white/50 mt-4"
            style={{
              fontFamily: "var(--font-mono-display)",
              fontSize: 11,
              letterSpacing: "0.3em",
              fontWeight: 600,
            }}
          >
            HOW IT WORKS ↓
          </p>
        </div>
      </section>

      {/* PHONE MOCKUPS */}
      <section className="relative z-10 border-t border-white/10 bg-black">
        <div className="mx-auto grid max-w-5xl gap-12 px-5 py-20 sm:grid-cols-2 sm:py-28">
          <div className="flex flex-col items-center gap-6">
            <img
              src={phoneApp}
              alt="BHOOMI-Netra citizen app showing flood warning alert and SOS button"
              width={768}
              height={1344}
              loading="lazy"
              className="w-full max-w-[300px] rounded-2xl border border-white/10"
            />
            <div className="text-center">
              <h2
                className="text-xl font-semibold"
                style={{ fontFamily: "var(--font-mono-display)", letterSpacing: "-0.5px" }}
              >
                Citizen App
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Instant alerts, nearest safe shelter with directions, and an SOS button — with SMS
                fallback when there's no internet.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-6">
            <img
              src={phoneDashboard}
              alt="BHOOMI-Netra authority dashboard with terrain-based flood spread simulation"
              width={768}
              height={1344}
              loading="lazy"
              className="w-full max-w-[300px] rounded-2xl border border-white/10"
            />
            <div className="text-center">
              <h2
                className="text-xl font-semibold"
                style={{ fontFamily: "var(--font-mono-display)", letterSpacing: "-0.5px" }}
              >
                Authority Dashboard
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Live map of every sensor plus a real simulation of how floods and fires spread
                across terrain — with population impact.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* THREE PILLARS */}
      <section className="relative z-10 border-t border-white/10 bg-black">
        <div className="mx-auto max-w-5xl px-5 py-20 sm:py-28">
          <h2
            className="text-center font-semibold leading-tight"
            style={{
              fontFamily: "var(--font-mono-display)",
              fontSize: "clamp(28px, 5vw, 44px)",
              letterSpacing: "-0.05em",
            }}
          >
            Three parts. One early-warning net.
          </h2>
          <div className="mt-14 grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: Radio,
                title: "The Sensor Device",
                body: "A small solar-powered box — water level, rain, flame, smoke, temperature — that works anywhere. It auto-switches between WiFi, mobile network, and LoRa long-range radio, so even a zero-signal forest stays connected.",
                tag: "Works everywhere",
              },
              {
                icon: Map,
                title: "Spread Simulation",
                body: "Not a guess — an actual model. Officials see how a flood or fire will move across real elevation and weather data, and exactly how many people or how much forest lies in its path.",
                tag: "Predict, don't react",
              },
              {
                icon: Bell,
                title: "Citizen Alerts",
                body: "People in the danger zone get notified instantly, see the nearest safe shelter with directions, and can hit SOS — even over SMS when the internet is gone.",
                tag: "Every second counts",
              },
            ].map(({ icon: Icon, title, body, tag }) => (
              <div key={title} className="rounded-xl border border-white/10 p-6">
                <Icon className="h-7 w-7 text-brand" aria-hidden="true" />
                <h3
                  className="mt-4 font-semibold"
                  style={{ fontFamily: "var(--font-mono-display)", letterSpacing: "-0.5px" }}
                >
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{body}</p>
                <p
                  className="mt-4 text-[11px] uppercase text-white/40"
                  style={{ fontFamily: "var(--font-mono-display)", letterSpacing: "0.25em" }}
                >
                  {tag}
                </p>
              </div>
            ))}
          </div>

          {/* Detection strip */}
          <div
            className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-white/50 text-sm"
            style={{ fontFamily: "var(--font-mono-display)", fontWeight: 600 }}
          >
            <span className="flex items-center gap-2">
              <Waves className="h-4 w-4" aria-hidden="true" /> Rising water
            </span>
            <span className="flex items-center gap-2">
              <Flame className="h-4 w-4" aria-hidden="true" /> Flames &amp; smoke
            </span>
            <span className="flex items-center gap-2">
              <Radio className="h-4 w-4" aria-hidden="true" /> WiFi · 4G · LoRa
            </span>
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4" aria-hidden="true" /> Solar powered
            </span>
          </div>
        </div>
      </section>

      {/* HARDWARE PREVIEW */}
      <section className="relative z-10 border-t border-white/10 bg-black overflow-hidden">
        {/* Ambient glows to match the tech vibe */}
        <div className="absolute top-1/2 left-[10%] -translate-y-1/2 w-[500px] h-[500px] bg-brand/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/2 right-[10%] -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Tech grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

        <div className="relative mx-auto max-w-6xl px-5 py-24 sm:py-32">
          <div className="flex flex-col items-center mb-20 text-center">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand/30 bg-brand/10 text-brand text-[11px] font-semibold tracking-widest uppercase mb-6 shadow-[0_0_15px_rgba(var(--brand-rgb),0.2)]"
              style={{ fontFamily: "var(--font-mono-display)" }}
            >
              <Cpu className="w-3.5 h-3.5" /> Hardware Architecture
            </div>
            <h2
              className="font-semibold leading-tight"
              style={{
                fontFamily: "var(--font-mono-display)",
                fontSize: "clamp(32px, 5vw, 48px)",
                letterSpacing: "-0.05em",
                background: "linear-gradient(180deg, #FFFFFF 0%, #A1A1AA 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              The Edge AI Node
            </h2>
            <p className="mt-5 max-w-2xl text-white/60 text-base leading-relaxed">
              Meet the rugged heart of BHOOMI-Netra. A solar-powered, AI-driven sensor node that
              doesn't just collect data — it analyzes it locally on an ESP32 chip. With adaptive
              double-radio fallback (LoRa + GSM), it never goes silent, even when the cell towers
              fall.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 items-stretch relative">
            {/* Card 1: The Node — isolated render */}
            <div className="group relative flex flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#0c0c0c] backdrop-blur-md transition-all duration-500 hover:border-brand/40 hover:shadow-[0_0_60px_rgba(245,158,11,0.10)]">
              <div className="relative h-[380px] flex-1 overflow-hidden bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.16)_0%,rgba(245,158,11,0.14)_30%,transparent_70%)]">
                {/* warm studio glow so the black enclosure reads against the dark card */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.22)_0%,rgba(245,158,11,0.18)_26%,transparent_68%)]" />
                {/* faint blueprint grid */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:28px_28px]" />
                {/* soft floor shadow for a studio feel */}
                <div className="absolute bottom-0 left-1/2 h-10 w-3/4 -translate-x-1/2 rounded-[50%] bg-black/50 blur-xl" />
                <img
                  src={hardwareNodeIso}
                  alt="BHOOMI-Netra IoT Node, isolated on transparent background"
                  className="relative z-10 mx-auto h-full w-auto max-w-full object-contain p-6 drop-shadow-[0_30px_45px_rgba(0,0,0,0.65)] transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  loading="lazy"
                />
                {/* rail of spec chips */}
                <div className="absolute bottom-3 left-0 z-20 flex w-full items-center justify-center gap-2 px-4">
                  {["IP65", "5W solar", "10,000 mAh", "LoRa + GSM"].map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[10px] font-medium text-white/65 backdrop-blur-sm"
                      style={{ fontFamily: "var(--font-mono-display)" }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div className="relative z-20 border-t border-white/10 bg-black/60 p-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/15 border border-brand/30 text-brand shadow-lg">
                    <Shield className="w-5 h-5" />
                  </div>
                  <h3
                    className="text-xl font-semibold text-white/90"
                    style={{ fontFamily: "var(--font-mono-display)", letterSpacing: "-0.5px" }}
                  >
                    Weatherproof & Autonomous
                  </h3>
                </div>
                <p className="mt-3 text-sm text-white/50 leading-relaxed">
                  IP65 rated enclosure packed with a 5W solar panel and a massive 10,000mAh battery.
                  Engineered for endless, zero-maintenance operation entirely off the grid.
                </p>
              </div>
            </div>

            {/* Card 2: The Blueprint */}
            <div className="group relative flex flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#020817] backdrop-blur-md transition-all duration-500 hover:border-blue-400/40 hover:shadow-[0_0_60px_rgba(59,130,246,0.15)]">
              <div className="relative h-[380px] flex-1 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_45%,rgba(59,130,246,0.18)_0%,transparent_66%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:28px_28px]" />
                <img
                  src={hardwareBlueprint}
                  alt="BHOOMI-Netra IoT Node engineering blueprint"
                  className="relative z-10 mx-auto h-full w-auto max-w-full object-contain p-4 opacity-95 mix-blend-screen transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  loading="lazy"
                />
                <div className="absolute bottom-3 left-0 z-20 flex w-full items-center justify-center gap-2 px-4">
                  {["ESP32-WROOM", "LoRa", "SIM800L"].map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-blue-300/20 bg-black/55 px-2.5 py-1 text-[10px] font-medium text-blue-200/70 backdrop-blur-sm"
                      style={{ fontFamily: "var(--font-mono-display)" }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div className="relative z-20 border-t border-white/10 bg-black/60 p-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-950 border border-blue-900 text-blue-400 shadow-lg shadow-blue-900/20">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <h3
                    className="text-xl font-semibold text-white/90"
                    style={{ fontFamily: "var(--font-mono-display)", letterSpacing: "-0.5px" }}
                  >
                    Edge AI Architecture
                  </h3>
                </div>
                <p className="mt-3 text-sm text-white/50 leading-relaxed">
                  Powered by a dual-core ESP32-WROOM MCU. It runs local ML models to validate
                  anomalies instantly, effectively eliminating false alarms before they reach the
                  cloud.
                </p>
              </div>
            </div>
          </div>

          {/* ── The cost of a late warning — real figures ── */}
          <div className="mt-20">
            <div className="flex flex-col items-center text-center">
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-300 text-[11px] font-semibold tracking-widest uppercase mb-6"
                style={{ fontFamily: "var(--font-mono-display)" }}
              >
                <AlertTriangle className="w-3.5 h-3.5" /> The cost of a late warning
              </div>
              <h3
                className="font-semibold leading-tight"
                style={{
                  fontFamily: "var(--font-mono-display)",
                  fontSize: "clamp(26px, 4vw, 40px)",
                  letterSpacing: "-0.05em",
                  background: "linear-gradient(180deg, #FFFFFF 0%, #A1A1AA 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                What a few hours of warning are worth
              </h3>
              <p className="mt-4 max-w-2xl text-white/55 text-sm leading-relaxed">
                Every minute the alert takes to reach people costs lives, homes and farmland. These
                are the numbers that make a sensor network a public good rather than a gadget — and
                the reason BHOOMI-Netra moves the alert the instant it is measured.
              </p>
            </div>

            <div className="mt-10 space-y-10">
              {/* Mechanism — universal */}
              <div>
                <GroupLabel icon={Clock}>How early warning works · universal</GroupLabel>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <StatTile
                    value="−30%"
                    label="Damage cut"
                    sub="when a warning arrives 24 hours ahead — the arithmetic of a single extra day. (GCA, 2019)"
                    accent="text-emerald-300"
                    icon={TrendingDown}
                  />
                  <StatTile
                    value="24 h"
                    label="The lead time that matters"
                    sub="A day of lead is the difference between sheltering and being caught. (GCA, 2019)"
                    icon={Clock}
                  />
                </div>
              </div>

              {/* India */}
              <div>
                <GroupLabel icon={Map}>India</GroupLabel>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <StatTile
                    value="₹25,805 Cr"
                    label="Avg annual flood damage"
                    sub="All-India, 2011–2021 average"
                    icon={IndianRupee}
                  />
                  <StatTile
                    value="16.8M ha"
                    label="Flooded in 2021"
                    sub="Second-highest on record"
                    icon={Map}
                  />
                  <StatTile
                    value="1.15 lakh"
                    label="Lives lost to floods"
                    sub="India, 1953–2021"
                    icon={Waves}
                  />
                  <StatTile
                    value="40M ha"
                    label="Flood-prone land"
                    sub="of India's 330M ha landmass"
                    icon={AlertTriangle}
                  />
                </div>
              </div>

              {/* West Bengal */}
              <div>
                <GroupLabel icon={Landmark}>West Bengal</GroupLabel>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <StatTile
                    value="₹79,086 Cr"
                    label="Avg annual flood damage"
                    sub="Since 2010 — the costliest of any state"
                    badge="highest in India"
                    accent="text-emerald-300"
                    icon={IndianRupee}
                  />
                  <StatTile
                    value="42.5%"
                    label="Of the state is flood-prone"
                    sub="38,168 sq km across 198 blocks"
                    icon={Map}
                  />
                  <StatTile
                    value="11,198"
                    label="Flood deaths since 1953"
                    sub="4th-highest state toll in India"
                    icon={Waves}
                  />
                  <StatTile
                    value="₹14,000 Cr"
                    label="2017 floods · single event"
                    sub="At least 152 lives lost that season — not an annual average"
                    badge="single event"
                    icon={AlertTriangle}
                  />
                </div>
              </div>

              {/* Chart — illustrative model, anchored to the real 24 h / −30% figure */}
              <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-white/80">
                    <TrendingDown className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                    <span
                      className="text-sm font-medium"
                      style={{ fontFamily: "var(--font-mono-display)" }}
                    >
                      Damage falls as warning lead time grows
                    </span>
                  </div>
                  <span
                    className="text-[10px] text-white/35 uppercase tracking-widest"
                    style={{ fontFamily: "var(--font-mono-display)" }}
                  >
                    illustrative model
                  </span>
                </div>
                <div className="mt-4 h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={WARNING_DATA}
                      margin={{ top: 10, right: 10, bottom: 0, left: -18 }}
                    >
                      <defs>
                        <linearGradient id="warnFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis
                        dataKey="hours"
                        tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => (v === 0 ? "0h" : `${v}h`)}
                      />
                      <YAxis
                        tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${v}%`}
                        domain={[40, 100]}
                      />
                      <ReTooltip
                        content={<WarningTip />}
                        cursor={{ stroke: "rgba(255,255,255,0.2)", strokeDasharray: "3 3" }}
                      />
                      <ReferenceLine
                        x={24}
                        stroke="#f59e0b"
                        strokeOpacity={0.5}
                        strokeDasharray="4 4"
                      />
                      <Area
                        type="monotone"
                        dataKey="damage"
                        stroke="#f59e0b"
                        strokeWidth={2.4}
                        fill="url(#warnFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex items-start gap-2 text-[11px] text-white/40">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    The curve is an illustration of the relationship; the 24-hour point (−30%
                    damage) is from the Global Commission on Adaptation&#39;s
                    <em> Adapt Now</em> report (2019). Longer lead, lower loss.
                  </span>
                </div>
              </div>

              {/* Sources */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div
                    className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-white/55"
                    style={{ fontFamily: "var(--font-mono-display)" }}
                  >
                    India figures
                  </div>
                  <p className="text-[11px] leading-relaxed text-white/40">
                    Rashtriya Barh Ayog (RBA) / Central Water Commission data, via Factly.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div
                    className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-white/55"
                    style={{ fontFamily: "var(--font-mono-display)" }}
                  >
                    West Bengal figures
                  </div>
                  <p className="text-[11px] leading-relaxed text-white/40">
                    WB Irrigation &amp; Waterways Department; Factly / CWC data; Wikipedia (2017
                    West Bengal floods).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DOWNLOAD */}
      <section id="download" className="relative z-10 border-t border-white/10 bg-black">
        <div className="mx-auto max-w-3xl px-5 py-24 text-center sm:py-32">
          <h2
            className="font-semibold leading-[1.1]"
            style={{
              fontFamily: "var(--font-mono-display)",
              fontSize: "clamp(32px, 6vw, 56px)",
              letterSpacing: "-0.06em",
              backgroundImage:
                "linear-gradient(247.33deg, rgb(255,255,255) 2.53%, rgba(255,255,255,0.4) 93.61%)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              paddingBottom: "0.12em",
            }}
          >
            Get out of the way — before it's too late.
          </h2>
          <p className="mx-auto mt-6 max-w-[50ch] text-white/60 text-sm leading-relaxed">
            BHOOMI-Netra is built for SIH. Download the citizen app to receive flood and forest-fire
            alerts for your area.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#top"
              className="flex items-center gap-3 rounded-full bg-white px-8 py-4 text-black transition-colors hover:bg-white/85"
              style={{ fontFamily: "var(--font-mono-display)", fontWeight: 600 }}
            >
              <Apple className="h-5 w-5" aria-hidden="true" /> App Store
            </a>
            <a
              href={APK_HREF}
              title="Download the citizen app (Android APK)"
              className="flex items-center gap-3 rounded-full border border-white/40 px-8 py-4 text-white transition-colors hover:border-white hover:bg-white/10"
              style={{ fontFamily: "var(--font-mono-display)", fontWeight: 600 }}
            >
              <Play className="h-5 w-5" aria-hidden="true" /> Google Play
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/10 bg-black">
        <div
          className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-5 py-8 text-white/40 sm:flex-row"
          style={{
            fontFamily: "var(--font-mono-display)",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.08em",
          }}
        >
          <span>BHOOMI-NETRA · SIH 2026</span>
          <span>Detect. Predict. Evacuate.</span>
        </div>
      </footer>
    </main>
  );
}
