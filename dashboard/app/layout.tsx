import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BHOOMI-NETRA — Disaster Monitoring Dashboard",
  description:
    "Real-time environmental monitoring and disaster early warning system. SIH 2026.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* MapLibre GL CSS — loaded via CDN because Turbopack chokes on the npm CSS */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css"
        />
      </head>
      <body className="bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
