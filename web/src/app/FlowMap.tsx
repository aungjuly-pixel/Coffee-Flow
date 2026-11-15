"use client";

import React, { useEffect, useState, useMemo } from "react";
import { geoEquirectangular, geoPath } from "d3-geo";
import * as topojson from "topojson-client";

interface Port {
  id: string;
  name: string;
  country: string;
  coordinates: [number, number]; // [longitude, latitude]
  type: "origin" | "destination";
  labelOffsetX: number;
  labelOffsetY: number;
}

interface Lane {
  id: string;
  origin: string;
  dest: string;
  category: "brazil" | "vietnam";
  duration: string;
  vessels: number;
}

// 1. Exact Geographic Coordinates [Longitude, Latitude]
const PORTS: Record<string, Port> = {
  santos: {
    id: "santos",
    name: "Santos",
    country: "Brazil",
    coordinates: [-46.33, -23.96],
    type: "origin",
    labelOffsetX: 8,
    labelOffsetY: 3,
  },
  paranagua: {
    id: "paranagua",
    name: "Paranaguá",
    country: "Brazil",
    coordinates: [-48.51, -25.52],
    type: "origin",
    labelOffsetX: 8,
    labelOffsetY: 12,
  },
  newyork: {
    id: "newyork",
    name: "New York",
    country: "USA",
    coordinates: [-74.00, 40.71],
    type: "destination",
    labelOffsetX: -58,
    labelOffsetY: -2,
  },
  antwerp: {
    id: "antwerp",
    name: "Antwerp",
    country: "Belgium",
    coordinates: [4.40, 51.22],
    type: "destination",
    labelOffsetX: -52,
    labelOffsetY: 6,
  },
  hamburg: {
    id: "hamburg",
    name: "Hamburg",
    country: "Germany",
    coordinates: [9.99, 53.55],
    type: "destination",
    labelOffsetX: 8,
    labelOffsetY: -5,
  },
  haiphong: {
    id: "haiphong",
    name: "Haiphong",
    country: "Vietnam",
    coordinates: [106.68, 20.84],
    type: "origin",
    labelOffsetX: 8,
    labelOffsetY: 4,
  },
};

const LANES: Lane[] = [
  {
    id: "sa-ant",
    origin: "santos",
    dest: "antwerp",
    category: "brazil",
    duration: "14.2d",
    vessels: 18,
  },
  {
    id: "sa-ny",
    origin: "santos",
    dest: "newyork",
    category: "brazil",
    duration: "11.5d",
    vessels: 14,
  },
  {
    id: "hai-ham",
    origin: "haiphong",
    dest: "hamburg",
    category: "vietnam",
    duration: "24.8d",
    vessels: 10,
  },
];

export default function FlowMap() {
  const [filter, setFilter] = useState<"all" | "brazil" | "vietnam">("all");
  const [hoveredPort, setHoveredPort] = useState<string | null>(null);
  const [geoData, setGeoData] = useState<{
    land: string | null;
    borders: string | null;
  }>({ land: null, borders: null });

  const width = 1000;
  const height = 520;

  // Reframed projection: scales and shifts the entire globe to the left 68% of the canvas
  const projection = useMemo(() => {
    return geoEquirectangular()
      .scale(126)
      .translate([350, 260]);
  }, []);

  const pathGenerator = useMemo(() => {
    return geoPath().projection(projection);
  }, [projection]);

  useEffect(() => {
    fetch("/countries-110m.json")
      .then((res) => res.json())
      .then((topology) => {
        const landGeo = topojson.feature(topology, topology.objects.land);
        const bordersGeo = topojson.mesh(
          topology,
          topology.objects.countries,
          (a, b) => a !== b
        );

        setGeoData({
          land: pathGenerator(landGeo),
          borders: pathGenerator(bordersGeo),
        });
      })
      .catch((err) => console.error("Error loading world topology:", err));
  }, [pathGenerator]);

  const activeLanes = LANES.filter(
    (l) => filter === "all" || l.category === filter
  );

  return (
    <div className="w-full font-mono">
      {/* 1. TOP CONTROLS & STATUS */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 text-xs">
        <div className="flex items-center gap-2">
          {(
            [
              { id: "all", label: "ALL CORRIDORS (42 VESSELS)" },
              { id: "brazil", label: "BRAZIL ARABICA (32)" },
              { id: "vietnam", label: "VIETNAM ROBUSTA (10)" },
            ] as const
          ).map((btn) => (
            <button
              key={btn.id}
              onClick={() => setFilter(btn.id)}
              style={{
                backgroundColor: filter === btn.id ? "#34211B" : "#120d0b",
                color: filter === btn.id ? "#ffffff" : "#a8a29e",
                borderColor:
                  filter === btn.id
                    ? "rgba(255,255,255,0.25)"
                    : "rgba(255,255,255,0.08)",
              }}
              className="px-3 py-1.5 rounded-lg border text-[11px] font-bold tracking-wider transition-all hover:text-white"
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-stone-400">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span>MARITIME TELEMETRY: D3-GEO SYNC</span>
        </div>
      </div>

      {/* 2. MAIN MAP CONTAINER */}
      <div className="relative w-full h-[460px] md:h-[500px] rounded-2xl overflow-hidden border border-white/10 bg-[#070504] shadow-2xl flex items-center justify-between p-4 md:p-6">
        
        {/* Full-bleed SVG Projection Area */}
        <div className="absolute inset-0 w-full h-full">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full select-none"
          >
            <defs>
              <pattern
                id="d3Grid"
                width="45"
                height="45"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 45 0 L 0 0 0 45"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.03)"
                  strokeWidth="1"
                />
              </pattern>

              <filter
                id="vesselGlow"
                x="-30%"
                y="-30%"
                width="160%"
                height="160%"
              >
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Ocean Floor */}
            <rect width={width} height={height} fill="#070504" />
            <rect width={width} height={height} fill="url(#d3Grid)" />

            {/* Equator & Tropic of Capricorn */}
            {(() => {
              const equatorY = projection([0, 0])?.[1] ?? height / 2;
              const capricornY = projection([0, -23.44])?.[1] ?? height * 0.63;
              return (
                <>
                  <line
                    x1="0"
                    y1={equatorY}
                    x2={width}
                    y2={equatorY}
                    stroke="rgba(200, 157, 124, 0.20)"
                    strokeDasharray="4 6"
                    strokeWidth="1"
                  />
                  <line
                    x1="0"
                    y1={capricornY}
                    x2={width}
                    y2={capricornY}
                    stroke="rgba(200, 157, 124, 0.12)"
                    strokeDasharray="3 5"
                    strokeWidth="1"
                  />
                </>
              );
            })()}

            {/* Landmasses: #34211B Header Coffee Tone */}
            {geoData.land && (
              <path
                d={geoData.land}
                fill="#34211B"
              />
            )}

            {/* Country Borders: Thin Dark Brown Hairlines #1a0f0a */}
            {geoData.borders && (
              <path
                d={geoData.borders}
                fill="none"
                stroke="#1a0f0a"
                strokeWidth="0.5"
                strokeLinejoin="round"
              />
            )}

            {/* Shipping Arcs & Vessel Pulses */}
            {activeLanes.map((lane) => {
              const p1 = PORTS[lane.origin];
              const p2 = PORTS[lane.dest];
              const pt1 = projection(p1.coordinates);
              const pt2 = projection(p2.coordinates);

              if (!pt1 || !pt2) return null;

              const [x1, y1] = pt1;
              const [x2, y2] = pt2;

              let cx = (x1 + x2) / 2;
              let cy = Math.min(y1, y2) - 40;

              // Vietnam to Hamburg sweeps south through Malacca/Indian ocean
              if (lane.category === "vietnam") {
                cx = 480;
                cy = 300;
              }

              const pathD = `M ${x1} ${y1} Q ${cx} ${cy}, ${x2} ${y2}`;

              return (
                <g key={lane.id}>
                  <path
                    d={pathD}
                    fill="none"
                    stroke="rgba(200, 157, 124, 0.32)"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#D9D9D9"
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                    opacity="0.85"
                  />

                  {/* Vessel Beacon 1 */}
                  <circle r="3.5" fill="#FFFFFF" filter="url(#vesselGlow)">
                    <animateMotion
                      path={pathD}
                      dur={lane.category === "brazil" ? "8s" : "12s"}
                      repeatCount="indefinite"
                    />
                  </circle>

                  {/* Vessel Beacon 2 */}
                  <circle r="2.5" fill="#C89D7C">
                    <animateMotion
                      path={pathD}
                      dur={lane.category === "brazil" ? "8s" : "12s"}
                      begin="-4s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </g>
              );
            })}

            {/* Port Nodes with Accurate Geolocation */}
            {Object.values(PORTS).map((port) => {
              const point = projection(port.coordinates);
              if (!point) return null;

              const [px, py] = point;
              const isHovered = hoveredPort === port.id;
              const isOrigin = port.type === "origin";

              return (
                <g
                  key={port.id}
                  onMouseEnter={() => setHoveredPort(port.id)}
                  onMouseLeave={() => setHoveredPort(null)}
                  className="cursor-pointer pointer-events-auto"
                >
                  {isOrigin && (
                    <circle
                      cx={px}
                      cy={py}
                      r="8"
                      fill="none"
                      stroke="#C89D7C"
                      strokeWidth="1"
                      opacity="0.6"
                    >
                      <animate
                        attributeName="r"
                        values="4;13;4"
                        dur="3s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.8;0;0.8"
                        dur="3s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}

                  <circle
                    cx={px}
                    cy={py}
                    r={isHovered ? 6 : 4}
                    fill={
                      isOrigin
                        ? "rgba(200, 157, 124, 0.4)"
                        : "rgba(255, 255, 255, 0.25)"
                    }
                    stroke={isOrigin ? "#C89D7C" : "#FFFFFF"}
                    strokeWidth="1.5"
                  />

                  <circle
                    cx={px}
                    cy={py}
                    r="2"
                    fill={isOrigin ? "#C89D7C" : "#FFFFFF"}
                  />

                  <text
                    x={px + port.labelOffsetX}
                    y={py + port.labelOffsetY}
                    fontSize="9"
                    fontFamily="'JetBrains Mono', monospace"
                    fontWeight={isHovered ? "bold" : "normal"}
                    fill={isHovered ? "#FFFFFF" : "#E5E5E5"}
                    className="select-none tracking-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
                  >
                    {port.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Section Badge */}
        <div className="absolute top-4 left-4 z-20 pointer-events-none">
          <span className="px-3 py-1.5 rounded-lg bg-[#1b120f]/90 border border-white/10 text-xs font-mono font-bold text-white backdrop-blur-md">
            GLOBAL FLOW RADAR
          </span>
        </div>

        {/* 3. RIGHT-SIDE GLASS PANEL (Unobstructed Layout) */}
        <div className="relative z-20 ml-auto w-72 sm:w-80 md:w-[310px] h-[390px] md:h-[430px] rounded-2xl overflow-hidden backdrop-blur-md bg-stone-950/25 border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.4)] flex flex-row">
          <div className="flex-1 p-5 flex flex-col justify-between text-xs font-mono">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-white font-bold tracking-wider uppercase text-[11px]">
                  Maritime Telemetry
                </span>
                <span className="text-[10px] text-stone-300">42 Vessels Active</span>
              </div>

              <div className="mt-4 space-y-2.5">
                <div className="p-2.5 rounded-lg bg-black/30 border border-white/5 flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[#d9d9d9]">
                    <span className="font-semibold text-[11px]">Santos → Antwerp</span>
                    <strong className="text-white font-mono">14.2d ETA</strong>
                  </div>
                  <div className="flex justify-between text-[10px] text-stone-300">
                    <span>18 Container Ships</span>
                    <span className="text-stone-200">In Atlantic Transit</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-black/30 border border-white/5 flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[#d9d9d9]">
                    <span className="font-semibold text-[11px]">Santos → New York</span>
                    <strong className="text-white font-mono">11.5d ETA</strong>
                  </div>
                  <div className="flex justify-between text-[10px] text-stone-300">
                    <span>14 Vessels En Route</span>
                    <span className="text-stone-200">Prompt Deliveries</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-black/30 border border-white/5 flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[#d9d9d9]">
                    <span className="font-semibold text-[11px]">Haiphong → Hamburg</span>
                    <strong className="text-white font-mono">24.8d ETA</strong>
                  </div>
                  <div className="flex justify-between text-[10px] text-stone-300">
                    <span>10 Bulk Carriers</span>
                    <span className="text-stone-200">EUDR Pre-Stocking</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 space-y-2 text-[11px] text-stone-200">
                <div className="flex justify-between">
                  <span className="text-stone-300">Santos Port Dwell:</span>
                  <span className="text-white font-semibold">3.8 Days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-300">Paranaguá Status:</span>
                  <span className="text-white font-semibold">Low Congestion (1.2d)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-300">Panama Canal Draft:</span>
                  <span className="text-white font-semibold">49.5 ft (Normal)</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex flex-col gap-1.5 text-[10px]">
              <div className="flex justify-between items-center text-stone-300">
                <span>MINAS GERAIS:</span>
                <span className="text-[#d9d9d9] font-bold">POST-FLOWERING</span>
              </div>
              <div className="flex justify-between items-center text-stone-300">
                <span>VIETNAM:</span>
                <span className="text-[#d9d9d9] font-bold">HARVEST PEAK</span>
              </div>
            </div>
          </div>

          {/* Right Silver Vertical Spine Bar */}
          <div className="w-5 sm:w-6 bg-[#d9d9d9] shrink-0 border-l border-black/30" />
        </div>
      </div>
    </div>
  );
}
