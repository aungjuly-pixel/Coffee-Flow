"use client";

import React, { useState } from "react";

export interface CotPoint {
  date: string;
  spot: number;
  commercial_net: number;
  managed_money_net: number;
  small_spec_net: number;
  open_interest?: number;
}

interface CotChartProps {
  data?: CotPoint[];
}

const FALLBACK_COT: CotPoint[] = [
  { date: "2026-08-18", spot: 245.2, commercial_net: -48200, managed_money_net: 39100, small_spec_net: 9100 },
  { date: "2026-09-15", spot: 268.4, commercial_net: -51400, managed_money_net: 43200, small_spec_net: 8200 },
  { date: "2026-10-13", spot: 294.8, commercial_net: -49800, managed_money_net: 41900, small_spec_net: 7900 },
  { date: "2026-11-10", spot: 287.15, commercial_net: -44812, managed_money_net: 38240, small_spec_net: 6572 },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatSigned(val: number): string {
  const rounded = Math.round(val);
  return `${rounded >= 0 ? "+" : ""}${rounded.toLocaleString()}`;
}

function formatShortDate(isoDate: string): string {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const mIdx = parseInt(parts[1], 10) - 1;
  return `${MONTHS[mIdx] ?? parts[1]} ${parts[2]}`;
}

function buildNiceTicks(minVal: number, maxVal: number, targetSteps: number): { min: number; max: number; ticks: number[] } {
  const rawSpan = Math.max(1, maxVal - minVal);
  const rawStep = rawSpan / targetSteps;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;

  let niceStep = magnitude;
  if (residual > 5) niceStep = 10 * magnitude;
  else if (residual > 2) niceStep = 5 * magnitude;
  else if (residual > 1) niceStep = 2 * magnitude;

  const niceMin = Math.floor(Math.min(0, minVal) / niceStep) * niceStep;
  const niceMax = Math.ceil(Math.max(0, maxVal) / niceStep) * niceStep;

  const ticks: number[] = [];
  for (let v = niceMax; v >= niceMin - niceStep * 0.001; v -= niceStep) {
    ticks.push(Math.round(v));
  }
  return { min: niceMin, max: niceMax, ticks };
}

export default function CotChart({ data }: CotChartProps) {
  const series = data && data.length > 0 ? data : FALLBACK_COT;

  const [showSpot, setShowSpot] = useState(true);
  const [showComm, setShowComm] = useState(true);
  const [showLarge, setShowLarge] = useState(true);
  const [showSmall, setShowSmall] = useState(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const activeIndex = hoverIndex !== null && hoverIndex < series.length ? hoverIndex : series.length - 1;
  const activePoint = series[activeIndex];
  const latestReportDate = series[series.length - 1]?.date ?? "Tuesday Release";

  // Shared horizontal layout
  const width = 920;
  const padLeft = 16;
  const padRight = 68;
  const plotWidth = width - padLeft - padRight;

  const getX = (idx: number) => {
    if (series.length <= 1) return padLeft + plotWidth / 2;
    return padLeft + (idx / (series.length - 1)) * plotWidth;
  };

  // Month-boundary markers along the X-axis (Jun, Jul, Aug, Sep, Oct, Nov)
  const monthTicks: { idx: number; label: string }[] = [];
  let lastMonth = "";
  series.forEach((pt, idx) => {
    const parts = pt.date.split("-");
    if (parts.length === 3) {
      const mKey = `${parts[0]}-${parts[1]}`;
      if (mKey !== lastMonth) {
        lastMonth = mKey;
        const mIdx = parseInt(parts[1], 10) - 1;
        // Skip first point if it's in the last third of a month so labels stay evenly spaced
        const dayNum = parseInt(parts[2], 10);
        if (idx > 0 || dayNum <= 20) {
          monthTicks.push({ idx, label: MONTHS[mIdx] ?? parts[1] });
        }
      }
    }
  });

  // 1. Upper Spot Price scale
  const spotHeight = 140;
  const spotValues = series.map((d) => d.spot);
  const minSpot = Math.floor((Math.min(...spotValues) - 6) / 10) * 10;
  const maxSpot = Math.ceil((Math.max(...spotValues) + 6) / 10) * 10;
  const spotRange = Math.max(10, maxSpot - minSpot);
  const midSpot = Math.round((minSpot + maxSpot) / 2);

  const getSpotY = (val: number) => {
    const ratio = (val - minSpot) / spotRange;
    return spotHeight - 14 - ratio * (spotHeight - 28);
  };

  const spotPoints = series.map((d, idx) => `${getX(idx)},${getSpotY(d.spot)}`).join(" ");
  const spotAreaPoints = `${getX(0)},${spotHeight - 12} ${spotPoints} ${getX(series.length - 1)},${spotHeight - 12}`;

  // 2. Middle Institutional Net Positions scale (tight asymmetric bounds matching actual min/max)
  const instHeight = 175;
  const instVals = series.flatMap((d) => [d.commercial_net, d.managed_money_net]);
  const instScale = buildNiceTicks(Math.min(...instVals), Math.max(...instVals), 4);
  const instRange = Math.max(1, instScale.max - instScale.min);

  const getInstY = (val: number) => {
    const ratio = (val - instScale.min) / instRange;
    return instHeight - 14 - ratio * (instHeight - 28);
  };

  // 3. Lower Small Speculators (Retail) tight asymmetric scale (e.g., +3,000 down to -1,000)
  const smallHeight = 135;
  const smallVals = series.map((d) => d.small_spec_net);
  const smallScale = buildNiceTicks(Math.min(...smallVals), Math.max(...smallVals), 4);
  const smallRange = Math.max(1, smallScale.max - smallScale.min);

  const getSmallY = (val: number) => {
    const ratio = (val - smallScale.min) / smallRange;
    return smallHeight - 14 - ratio * (smallHeight - 28);
  };

  const smallZeroY = getSmallY(0);

  const buildSteppedPath = (accessor: (d: CotPoint) => number, yMapper: (v: number) => number) => {
    if (series.length === 0) return "";
    let dStr = `M ${getX(0)} ${yMapper(accessor(series[0]))}`;
    for (let i = 1; i < series.length; i++) {
      const prevX = getX(i - 1);
      const currX = getX(i);
      const midX = (prevX + currX) / 2;
      const prevY = yMapper(accessor(series[i - 1]));
      const currY = yMapper(accessor(series[i]));
      dStr += ` L ${midX} ${prevY} L ${midX} ${currY} L ${currX} ${currY}`;
    }
    return dStr;
  };

  const commPath = buildSteppedPath((d) => d.commercial_net, getInstY);
  const largePath = buildSteppedPath((d) => d.managed_money_net, getInstY);
  const smallPath = buildSteppedPath((d) => d.small_spec_net, getSmallY);

  const smallAreaPath =
    series.length > 0
      ? `${smallPath} L ${getX(series.length - 1)} ${smallZeroY} L ${getX(0)} ${smallZeroY} Z`
      : "";

  return (
    <div className="w-full font-mono select-none">
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base md:text-lg font-bold tracking-wider text-[#D9D9D9] uppercase font-sans">
              CFTC Commitment of Traders (COT)
            </h2>
            <span className="text-[10px] font-mono text-[#D9D9D9] bg-[#34211B] px-2.5 py-0.5 rounded border border-white/15 tracking-wider font-semibold">
              DISAGGREGATED REPORT
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-1 font-body">
            Net institutional &amp; retail positioning in ICE Arabica Coffee futures &amp; options contracts.
          </p>
        </div>

        <div className="text-xs text-stone-400">
          Report Date: <strong className="text-white">{latestReportDate}</strong>
        </div>
      </div>

      {/* Interactive Series Toggle Pills */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] mb-3">
        <span className="text-stone-500 mr-1">SERIES:</span>

        <button
          type="button"
          onClick={() => setShowSpot((p) => !p)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-all cursor-pointer ${
            showSpot
              ? "bg-[#1A1816] text-white border-white/25"
              : "bg-[#090808] text-stone-500 border-stone-800/80 opacity-60"
          }`}
        >
          <span className="w-2.5 h-0.5 bg-white" />
          <span>Spot Price (¢/lb)</span>
        </button>

        <button
          type="button"
          onClick={() => setShowComm((p) => !p)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-all cursor-pointer ${
            showComm
              ? "bg-[#34211B] text-[#C89D7C] border-[#C89D7C]/40"
              : "bg-[#090808] text-stone-500 border-stone-800/80 opacity-60"
          }`}
        >
          <span className="w-2.5 h-0.5 bg-[#C89D7C]" />
          <span>Commercials (Hedgers)</span>
        </button>

        <button
          type="button"
          onClick={() => setShowLarge((p) => !p)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-all cursor-pointer ${
            showLarge
              ? "bg-[#1A1816] text-[#D9D9D9] border-white/25"
              : "bg-[#090808] text-stone-500 border-stone-800/80 opacity-60"
          }`}
        >
          <span className="w-2.5 h-0.5 bg-[#D9D9D9]" />
          <span>Large Speculators (Funds)</span>
        </button>

        <button
          type="button"
          onClick={() => setShowSmall((p) => !p)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-all cursor-pointer ${
            showSmall
              ? "bg-[#1A1816] text-[#8E9AA8] border-[#8E9AA8]/40"
              : "bg-[#090808] text-stone-500 border-stone-800/80 opacity-60"
          }`}
        >
          <span className="w-2.5 h-0.5 bg-[#8E9AA8]" />
          <span>Small Speculators (Retail)</span>
        </button>
      </div>

      {/* Live / Hovered Readout Strip */}
      <div className="inline-flex flex-wrap items-center gap-3 px-3 py-1.5 rounded-lg border border-stone-800/80 bg-[#090808] text-[11px] mb-3">
        <span className="text-stone-400">
          Date: <strong className="text-white">{activePoint.date}</strong>
        </span>
        <span className="text-stone-700">|</span>
        <span className="text-stone-400">
          Spot: <strong className="text-white">{activePoint.spot.toFixed(2)}¢</strong>
        </span>
        <span className="text-stone-700">|</span>
        <span className="text-stone-400">
          Comm: <strong className="text-[#C89D7C]">{formatSigned(activePoint.commercial_net)}</strong>
        </span>
        <span className="text-stone-700">|</span>
        <span className="text-stone-400">
          Large: <strong className="text-[#D9D9D9]">{formatSigned(activePoint.managed_money_net)}</strong>
        </span>
        <span className="text-stone-700">|</span>
        <span className="text-stone-400">
          Small: <strong className="text-[#8E9AA8]">{formatSigned(activePoint.small_spec_net)}</strong>
        </span>
      </div>

      {/* Synchronized Multi-Panel Chart Container */}
      <div
        className="rounded-xl border border-stone-800/80 bg-[#090808] p-4 relative overflow-hidden space-y-3"
        onMouseLeave={() => setHoverIndex(null)}
      >
        {/* Panel 1: KC Spot Price */}
        <div>
          <div className="flex items-center gap-3 text-[11px] mb-1">
            <span className="px-2 py-0.5 rounded bg-white/5 text-stone-200 font-semibold">
              KC Arabica Spot
            </span>
            <span className="flex items-center gap-1.5 text-stone-400">
              <span className="w-3 h-0.5 bg-white inline-block" />
              Weekly Close (¢/lb)
            </span>
          </div>
          <svg viewBox={`0 0 ${width} ${spotHeight}`} className="w-full h-36 overflow-visible">
            <defs>
              <linearGradient id="cotSpotGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {[maxSpot, midSpot, minSpot].map((lvl) => {
              const y = getSpotY(lvl);
              return (
                <g key={lvl}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={width - padRight}
                    y2={y}
                    stroke="rgba(255,255,255,0.07)"
                  />
                  <text x={width - padRight + 8} y={y + 3} fill="#A8A29E" fontSize="10">
                    {lvl.toFixed(2)}¢
                  </text>
                </g>
              );
            })}

            {showSpot && (
              <>
                <polygon points={spotAreaPoints} fill="url(#cotSpotGrad)" />
                <polyline fill="none" stroke="#FFFFFF" strokeWidth="2" points={spotPoints} />
              </>
            )}

            <line
              x1={getX(activeIndex)}
              y1={6}
              x2={getX(activeIndex)}
              y2={spotHeight - 8}
              stroke="rgba(217,217,217,0.35)"
              strokeDasharray="3 3"
            />

            {series.map((_, idx) => {
              const colW = plotWidth / Math.max(1, series.length);
              return (
                <rect
                  key={idx}
                  x={getX(idx) - colW / 2}
                  y={0}
                  width={colW}
                  height={spotHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoverIndex(idx)}
                />
              );
            })}
          </svg>
        </div>

        {/* Panel 2: Institutional Net Positions with Inline COTBase-Style Legend */}
        <div className="pt-2 border-t border-stone-800/60">
          <div className="flex flex-wrap items-center gap-3 text-[11px] mb-1">
            <span className="px-2 py-0.5 rounded bg-white/5 text-stone-200 font-semibold">
              Net Positions
            </span>
            <span className="flex items-center gap-1.5 text-[#C89D7C]">
              <span className="w-3.5 h-0.5 bg-[#C89D7C] inline-block" />
              Commercials
            </span>
            <span className="flex items-center gap-1.5 text-[#D9D9D9]">
              <span className="w-3.5 h-0.5 bg-[#D9D9D9] inline-block" />
              Large Speculators
            </span>
          </div>
          <svg viewBox={`0 0 ${width} ${instHeight}`} className="w-full h-44 overflow-visible">
            {instScale.ticks.map((lvl) => {
              const y = getInstY(lvl);
              return (
                <g key={lvl}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={width - padRight}
                    y2={y}
                    stroke={lvl === 0 ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.07)"}
                  />
                  <text x={width - padRight + 8} y={y + 3} fill="#A8A29E" fontSize="10">
                    {lvl.toLocaleString()}
                  </text>
                </g>
              );
            })}

            {showComm && <path d={commPath} fill="none" stroke="#C89D7C" strokeWidth="1.9" />}
            {showLarge && <path d={largePath} fill="none" stroke="#D9D9D9" strokeWidth="1.9" />}

            <line
              x1={getX(activeIndex)}
              y1={6}
              x2={getX(activeIndex)}
              y2={instHeight - 6}
              stroke="rgba(217,217,217,0.35)"
              strokeDasharray="3 3"
            />

            {series.map((_, idx) => {
              const colW = plotWidth / Math.max(1, series.length);
              return (
                <rect
                  key={idx}
                  x={getX(idx) - colW / 2}
                  y={0}
                  width={colW}
                  height={instHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoverIndex(idx)}
                />
              );
            })}
          </svg>
        </div>

        {/* Panel 3: Dedicated Small Speculators (Retail) with Fine Gridlines & Inline Legend */}
        {showSmall && (
          <div className="pt-2 border-t border-stone-800/60">
            <div className="flex flex-wrap items-center gap-3 text-[11px] mb-1">
              <span className="px-2 py-0.5 rounded bg-white/5 text-stone-200 font-semibold">
                Net Positions
              </span>
              <span className="flex items-center gap-1.5 text-[#8E9AA8]">
                <span className="w-3.5 h-0.5 bg-[#8E9AA8] inline-block" />
                Small Speculators
              </span>
            </div>
            <svg viewBox={`0 0 ${width} ${smallHeight}`} className="w-full h-36 overflow-visible">
              {smallScale.ticks.map((lvl) => {
                const y = getSmallY(lvl);
                return (
                  <g key={lvl}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={width - padRight}
                      y2={y}
                      stroke={lvl === 0 ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.07)"}
                    />
                    <text x={width - padRight + 8} y={y + 3} fill="#A8A29E" fontSize="10">
                      {lvl.toLocaleString()}
                    </text>
                  </g>
                );
              })}

              <path d={smallAreaPath} fill="rgba(142, 154, 168, 0.14)" />
              <path d={smallPath} fill="none" stroke="#8E9AA8" strokeWidth="1.9" />

              <line
                x1={getX(activeIndex)}
                y1={6}
                x2={getX(activeIndex)}
                y2={smallHeight - 6}
                stroke="rgba(217,217,217,0.35)"
                strokeDasharray="3 3"
              />

              {series.map((_, idx) => {
                const colW = plotWidth / Math.max(1, series.length);
                return (
                  <rect
                    key={idx}
                    x={getX(idx) - colW / 2}
                    y={0}
                    width={colW}
                    height={smallHeight}
                    fill="transparent"
                    onMouseEnter={() => setHoverIndex(idx)}
                  />
                );
              })}
            </svg>
          </div>
        )}

        {/* Shared Horizontal Month-Boundary Timeline Axis */}
        <div className="pt-1.5 border-t border-stone-800/80">
          <svg viewBox={`0 0 ${width} 26`} className="w-full h-6 overflow-visible">
            <line
              x1={padLeft}
              y1={2}
              x2={width - padRight}
              y2={2}
              stroke="rgba(255,255,255,0.12)"
            />

            {monthTicks.map(({ idx, label }) => {
              const x = getX(idx);
              return (
                <g key={`${label}-${idx}`}>
                  <line x1={x} y1={2} x2={x} y2={7} stroke="rgba(255,255,255,0.3)" />
                  <text
                    x={x}
                    y={19}
                    textAnchor="middle"
                    fill="#A8A29E"
                    fontSize="10"
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {hoverIndex !== null && (
              <g>
                <rect
                  x={Math.max(padLeft, Math.min(width - padRight - 64, getX(activeIndex) - 32))}
                  y={4}
                  width={64}
                  height={18}
                  rx={4}
                  fill="#34211B"
                  stroke="rgba(217,217,217,0.35)"
                />
                <text
                  x={Math.max(padLeft + 32, Math.min(width - padRight - 32, getX(activeIndex)))}
                  y={16}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="10"
                  fontWeight="bold"
                >
                  {formatShortDate(activePoint.date)}
                </text>
              </g>
            )}

            <text x={width - padRight + 8} y={19} fill="#78716C" fontSize="9">
              CFTC TUE
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
}
