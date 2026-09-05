import { createFileRoute } from "@tanstack/react-router";
import { Waves, Flame, Radio, Map, Bell, Shield, Apple, Play, LayoutDashboard, FileText, X, Cpu } from "lucide-react";
import phoneApp from "@/assets/phone-app.jpg";
import phoneDashboard from "@/assets/phone-dashboard.jpg";
import hardwareNode from "@/assets/hardware-node.png";
import hardwareBlueprint from "@/assets/hardware-blueprint.jpg";
import logoUrl from "@/assets/bhoomi-logo.webp";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogClose } from "@/components/ui/dialog";

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
      { rel: "preload", href: "/hf_20260801_001207_ec20d138-aa45-4b2b-ab8c-bdc71607f240.mp4", as: "video", type: "video/mp4" },
    ],
  }),
  component: Index,
});

const VIDEO_URL = "/hf_20260801_001207_ec20d138-aa45-4b2b-ab8c-bdc71607f240.mp4";

// The signed release APK, served straight out of public/. Built with
// `assembleRelease` in Application/CitizenApp/android and copied here.
const APK_HREF = "/bhoomi-netra-citizen.apk";

function Logo() {
  return (
    <div className="absolute left-1/2 top-8 z-10 -translate-x-1/2 sm:top-12 origin-top flex flex-col items-center gap-2">
      <a
        href="#top"
        aria-label="BHOOMI-Netra"
      >
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
            style={{ fontFamily: "var(--font-mono-display)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.06em" }}
          >
            BHOOMI&#8209;NETRA
          </span>
        </div>
      </a>
      <p
        className="text-white/50 uppercase"
        style={{ fontFamily: "var(--font-mono-display)", fontSize: 12, letterSpacing: "0.35em", fontWeight: 600 }}
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
          <div className="mt-10 h-px w-full max-w-[620px] bg-white/60 sm:mt-14" aria-hidden="true" />

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
            A smart sensor network that doesn't just detect floods &amp; forest
            fires — it predicts how they'll spread. So people get out of the
            way before it's too late.
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
            {/* The Android build is distributed as an APK from this site rather
                than a store listing, so this is a direct file download. */}
            <a
              href={APK_HREF}
              download
              title="Download the citizen app (Android APK)"
              className="flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-5 py-3 text-white backdrop-blur-md transition-all hover:bg-black/80 hover:border-white/50 shadow-lg"
              style={{ fontFamily: "var(--font-mono-display)", fontWeight: 600, fontSize: 14 }}
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              Android
            </a>
            <a
              href="http://localhost:5173/"
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
                  <span className="text-white/80 text-sm tracking-wider uppercase font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-mono-display)" }}>
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
            style={{ fontFamily: "var(--font-mono-display)", fontSize: 11, letterSpacing: "0.3em", fontWeight: 600 }}
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
              <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-mono-display)", letterSpacing: "-0.5px" }}>
                Citizen App
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Instant alerts, nearest safe shelter with directions, and an SOS
                button — with SMS fallback when there's no internet.
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
              <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-mono-display)", letterSpacing: "-0.5px" }}>
                Authority Dashboard
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Live map of every sensor plus a real simulation of how floods
                and fires spread across terrain — with population impact.
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
            style={{ fontFamily: "var(--font-mono-display)", fontSize: "clamp(28px, 5vw, 44px)", letterSpacing: "-0.05em" }}
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
                <h3 className="mt-4 font-semibold" style={{ fontFamily: "var(--font-mono-display)", letterSpacing: "-0.5px" }}>
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
          <div className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-white/50 text-sm"
            style={{ fontFamily: "var(--font-mono-display)", fontWeight: 600 }}>
            <span className="flex items-center gap-2"><Waves className="h-4 w-4" aria-hidden="true" /> Rising water</span>
            <span className="flex items-center gap-2"><Flame className="h-4 w-4" aria-hidden="true" /> Flames &amp; smoke</span>
            <span className="flex items-center gap-2"><Radio className="h-4 w-4" aria-hidden="true" /> WiFi · 4G · LoRa</span>
            <span className="flex items-center gap-2"><Shield className="h-4 w-4" aria-hidden="true" /> Solar powered</span>
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand/30 bg-brand/10 text-brand text-[11px] font-semibold tracking-widest uppercase mb-6 shadow-[0_0_15px_rgba(var(--brand-rgb),0.2)]" style={{ fontFamily: "var(--font-mono-display)" }}>
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
                WebkitTextFillColor: "transparent"
              }}
            >
              The Edge AI Node
            </h2>
            <p className="mt-5 max-w-2xl text-white/60 text-base leading-relaxed">
              Meet the rugged heart of BHOOMI-Netra. A solar-powered, AI-driven sensor node that doesn't just collect data — it analyzes it locally on an ESP32 chip. With adaptive double-radio fallback (LoRa + GSM), it never goes silent, even when the cell towers fall.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 items-stretch relative">
            {/* Card 1: The Render */}
            <div className="group relative flex flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md transition-all duration-500 hover:border-white/20 hover:bg-white/[0.08] hover:shadow-[0_0_40px_rgba(255,255,255,0.05)]">
              <div className="relative p-0 flex-1 flex flex-col justify-center items-center h-[340px] bg-gradient-to-br from-zinc-200 to-zinc-400 overflow-hidden">
                {/* A subtle inner light burst to make the device pop and blend the white image background */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.9)_0%,transparent_70%)]" />
                <img
                  src={hardwareNode}
                  alt="BHOOMI-Netra IoT Node Render"
                  className="relative z-10 w-full h-full object-cover mix-blend-multiply transition-transform duration-700 ease-out group-hover:scale-110"
                  loading="lazy"
                />
              </div>
              <div className="relative z-20 border-t border-white/10 bg-black/60 backdrop-blur-xl p-8 transition-colors duration-500 group-hover:bg-black/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-white shadow-lg">
                    <Shield className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-semibold text-white/90" style={{ fontFamily: "var(--font-mono-display)", letterSpacing: "-0.5px" }}>
                    Weatherproof & Autonomous
                  </h3>
                </div>
                <p className="text-sm text-white/50 leading-relaxed">
                  IP65 rated enclosure packed with a 5W solar panel and a massive 10,000mAh battery. Engineered for endless, zero-maintenance operation entirely off the grid.
                </p>
              </div>
            </div>

            {/* Card 2: The Blueprint */}
            <div className="group relative flex flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md transition-all duration-500 hover:border-white/20 hover:bg-white/[0.08] hover:shadow-[0_0_40px_rgba(59,130,246,0.1)]">
              <div className="relative p-0 flex-1 flex flex-col justify-center items-center h-[340px] bg-[#020817] overflow-hidden">
                {/* subtle blue glow */}
                <div className="absolute inset-0 bg-blue-500/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <img
                  src={hardwareBlueprint}
                  alt="BHOOMI-Netra IoT Node Blueprint"
                  className="relative z-10 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110 opacity-90 mix-blend-screen"
                  loading="lazy"
                />
              </div>
              <div className="relative z-20 border-t border-white/10 bg-black/60 backdrop-blur-xl p-8 transition-colors duration-500 group-hover:bg-black/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-950 border border-blue-900 text-blue-400 shadow-lg shadow-blue-900/20">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-semibold text-white/90" style={{ fontFamily: "var(--font-mono-display)", letterSpacing: "-0.5px" }}>
                    Edge AI Architecture
                  </h3>
                </div>
                <p className="text-sm text-white/50 leading-relaxed">
                  Powered by a dual-core ESP32-WROOM MCU. It runs local ML models to validate anomalies instantly, effectively eliminating false alarms before they reach the cloud.
                </p>
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
            BHOOMI-Netra is built for SIH. Download the citizen app to receive
            flood and forest-fire alerts for your area.
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
              href="#top"
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
          style={{ fontFamily: "var(--font-mono-display)", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em" }}
        >
          <span>BHOOMI-NETRA · SIH 2026</span>
          <span>Detect. Predict. Evacuate.</span>
        </div>
      </footer>
    </main>
  );
}
