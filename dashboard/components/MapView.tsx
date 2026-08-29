"use client";

import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  Marker,
  Popup,
  NavigationControl,
} from "maplibre-gl";
// maplibre-gl CSS loaded via CDN <link> in layout.tsx (Turbopack compat)
import { SensorNode } from "@/lib/supabase";

interface MapViewProps {
  nodes: SensorNode[];
  /** Latest reading per node, keyed by node_id */
  latestReadings: Record<
    string,
    { temperature?: number | null; water_level?: number | null }
  >;
}

// Carto dark basemap — free, no token needed
const MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const NODE_TYPE_COLORS: Record<string, string> = {
  forest: "#10b981", // emerald/green
  urban: "#f97316", // orange
  universal: "#14b8a6", // teal
};

export default function MapView({ nodes, latestReadings }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [88.3639, 22.5726], // Kolkata center
      zoom: 11.5,
      attributionControl: false,
    });

    map.addControl(
      new NavigationControl({ showCompass: false }),
      "top-left"
    );

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when nodes or readings change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    nodes.forEach((node) => {
      const reading = latestReadings[node.id];
      const color = NODE_TYPE_COLORS[node.node_type] ?? "#6b7280";

      // Create a custom marker element
      const el = document.createElement("div");
      el.className = "bhoomi-marker";
      el.style.cssText = `
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: ${color};
        border: 2px solid rgba(255,255,255,0.3);
        box-shadow: 0 0 12px ${color}66;
        cursor: pointer;
        transition: transform 0.2s;
      `;
      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.4)";
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1)";
      });

      // Popup content
      const popupHTML = `
        <div style="font-family: system-ui, sans-serif; color: #e4e4e7; min-width: 180px;">
          <div style="font-weight: 600; font-size: 13px; margin-bottom: 6px; color: ${color};">
            ${node.name}
          </div>
          <div style="font-size: 11px; color: #a1a1aa; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">
            ${node.node_type} · ${node.status}
          </div>
          ${
            reading
              ? `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 12px;">
            <span style="color: #71717a;">Temp</span>
            <span style="color: #f4f4f5; text-align: right;">${reading.temperature ?? "—"}°C</span>
            <span style="color: #71717a;">Water</span>
            <span style="color: #f4f4f5; text-align: right;">${reading.water_level ?? "—"}/4095</span>
          </div>
          `
              : `<div style="font-size: 12px; color: #71717a;">No readings yet</div>`
          }
        </div>
      `;

      const popup = new Popup({
        offset: 14,
        closeButton: false,
        maxWidth: "240px",
      })
        .setHTML(popupHTML)
        .addClassName("bhoomi-popup");

      const marker = new Marker({ element: el })
        .setLngLat([node.longitude, node.latitude])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [nodes, latestReadings]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full"
      style={{ minHeight: "100vh" }}
    />
  );
}
