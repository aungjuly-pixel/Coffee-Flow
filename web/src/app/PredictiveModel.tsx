"use client";

import React, { useState, useMemo, useRef } from "react";

type ScenarioKey = "baseline" | "drought" | "fx_deval" | "reversion";

interface ContinuumPoint {
  dayOffset: number;
  date: string;
  isHistorical: boolean;
  actualSpot?: number;
  p10: number;
  p50: number;
  p90: number;
}

interface ScenarioConfig {
  name: string;
  badge: string;
  expectedDrift: string;
  expectedClose: number;
  confidenceScore: number;
  backtestAccuracy: string;
  mae: string;
  projectedRange: [number, number];
  drivers: {
    name: string;
    weight: number;
    trend: string;
    impact: string;
  }[];
  points: ContinuumPoint[];
  forwardPaths: number[][];
}

function generateContinuumData(drift: number, vol: number) {
  const points: ContinuumPoint[] = [];
  const anchorSpot = 287.15;
  const baseDate = new Date(2026, 10, 8);

  const actualHistory = [
    284.5, 283.0, 281.8, 282.5, 285.0, 283.4, 280.2, 278.5, 279.4, 276.8,
    278.0, 280.5, 282.1, 281.0, 283.6, 284.8, 282.0, 280.4, 279.2, 281.5,
    283.0, 285.2, 284.1, 286.0, 288.4, 287.2, 289.5, 288.0, 286.4, 285.8,
    287.15,
  ];

  for (let i = -30; i <= 0; i++) {
    const idx = i + 30;
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    const dateLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const actual = actualHistory[idx];

    const modelMid = Number((282.0 + (idx / 30) * 4.5 + Math.sin(idx / 4) * 1.5).toFixed(2));
    const spread = 7.5 + (1 - idx / 30) * 4.0;

    points.push({
      dayOffset: i,
      date: dateLabel,
      isHistorical: true,
      actualSpot: actual,
      p10: Number((modelMid - spread).toFixed(2)),
      p50: modelMid,
      p90: Number((modelMid + spread).toFixed(2)),
    });
  }

  for (let i = 1; i <= 30; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    const dateLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const t = i / 30;
    const currentDrift = anchorSpot * (drift * t);
    const spread = anchorSpot * vol * Math.sqrt(t);

    points.push({
      dayOffset: i,
      date: dateLabel,
      isHistorical: false,
      p10: Number((anchorSpot + currentDrift - spread * 1.64).toFixed(2)),
      p50: Number((anchorSpot + currentDrift).toFixed(2)),
      p90: Number((anchorSpot + currentDrift + spread * 1.64).toFixed(2)),
    });
  }

  const seedOffsets = [
    [0, 1.2, -0.8, 1.5, 2.1, 0.4, 3.2, 4.1, 2.8, 5.0, 4.2, 6.1, 7.5, 6.8, 8.2, 7.9, 9.5, 11.2, 10.4, 12.1, 11.5, 13.0, 12.4, 14.2, 15.1, 14.0, 16.2, 15.8, 17.1, 16.5, 18.2],
    [0, -0.5, 0.8, -1.2, -0.4, -2.1, -1.5, -0.8, 1.2, 0.5, -1.0, 1.4, 2.0, 1.2, 2.8, 3.4, 2.5, 4.1, 3.8, 4.9, 5.5, 4.2, 6.0, 5.4, 7.1, 6.5, 7.8, 7.2, 8.5, 8.0, 9.2],
    [0, 0.8, 1.9, 1.2, 0.4, -0.9, -1.8, -3.0, -2.2, -4.1, -3.5, -5.2, -4.8, -6.0, -5.5, -7.1, -6.4, -8.2, -7.5, -9.0, -8.2, -9.8, -8.9, -10.5, -11.2, -10.0, -11.8, -12.4, -13.1, -12.5, -14.0],
    [0, -1.1, -2.2, -1.5, -3.1, -4.2, -3.8, -5.0, -4.2, -6.1, -5.4, -7.0, -6.2, -7.8, -7.1, -8.5, -7.9, -9.2, -8.5, -10.1, -9.5, -11.2, -10.4, -12.0, -11.5, -13.1, -12.4, -14.0, -13.2, -15.0, -14.5],
  ];

  const forwardPaths = seedOffsets.map((offsets) =>
    offsets.map((off, idx) => {
      const t = idx / 30;
      return Number((anchorSpot + anchorSpot * drift * t + off * (vol * 5)).toFixed(2));
    })
  );

  return { points, forwardPaths };
}

const SCENARIOS: Record<ScenarioKey, ScenarioConfig> = {
  baseline: {
    name: "Current Trend Baseline",
    badge: "STATUS QUO DRIFT",
    expectedDrift: "+3.8%",
    expectedClose: 298.2,
    confidenceScore: 78,
    backtestAccuracy: "88.4%",
    mae: "1.92¢",
    projectedRange: [278, 318],
    drivers: [
      { name: "Minas Gerais Soil Moisture Deficit", weight: 35, trend: "Deficit -18%", impact: "+12.4¢" },
      { name: "USD/BRL Real Currency Elasticity", weight: 25, trend: "5.38 BRL/USD", impact: "+4.1¢" },
      { name: "ICE Certified Inventory Drawdowns", weight: 25, trend: "-2.4% / Week", impact: "+6.8¢" },
      { name: "Managed Money Net Inflows", weight: 15, trend: "+38k Contracts", impact: "+3.2¢" },
    ],
    ...generateContinuumData(0.038, 0.065),
  },
  drought: {
    name: "Minas Gerais Drought Shock",
    badge: "AGRONOMIC SHOCK",
    expectedDrift: "+14.2%",
    expectedClose: 328.0,
    confidenceScore: 84,
    backtestAccuracy: "84.2%",
    mae: "2.14¢",
    projectedRange: [302, 355],
    drivers: [
      { name: "Cerrado Mineiro Heat Anomaly", weight: 55, trend: "+3.2°C Above Avg", impact: "+26.5¢" },
      { name: "Berry Abortion / Yield Downgrades", weight: 25, trend: "Conab Rev: -12%", impact: "+11.2¢" },
      { name: "Origin Merchant Withholding", weight: 15, trend: "Spot Physical Paused", impact: "+7.4¢" },
      { name: "Speculative Managed Long Chasing", weight: 5, trend: "Aggressive Inflow", impact: "+3.8¢" },
    ],
    ...generateContinuumData(0.142, 0.085),
  },
  fx_deval: {
    name: "BRL Currency Devaluation",
    badge: "MACRO FX DRIVER",
    expectedDrift: "+8.5%",
    expectedClose: 311.5,
    confidenceScore: 71,
    backtestAccuracy: "81.6%",
    mae: "2.65¢",
    projectedRange: [288, 335],
    drivers: [
      { name: "USD/BRL Exchange Rate Surge", weight: 50, trend: "> 5.80 BRL/USD", impact: "+16.8¢" },
      { name: "Brazilian Forward Fixation Pause", weight: 25, trend: "Exporters Wait", impact: "+8.2¢" },
      { name: "ICE Warehouse Depletion", weight: 15, trend: "Prompt Tightness", impact: "+4.5¢" },
      { name: "Fertilizer & Logistics Invoicing", weight: 10, trend: "Cost Push Inflation", impact: "+2.1¢" },
    ],
    ...generateContinuumData(0.085, 0.075),
  },
  reversion: {
    name: "Roaster Demand Destruction",
    badge: "MEAN REVERSION",
    expectedDrift: "-6.4%",
    expectedClose: 268.8,
    confidenceScore: 68,
    backtestAccuracy: "86.1%",
    mae: "2.05¢",
    projectedRange: [248, 290],
    drivers: [
      { name: "Retail Price Rationing", weight: 45, trend: "European Substitution", impact: "-15.2¢" },
      { name: "Robusta Blending Infiltration", weight: 30, trend: "+18% Robusta Ratio", impact: "-9.4¢" },
      { name: "Managed Money Long Liquidation", weight: 15, trend: "Stop Triggers", impact: "-5.8¢" },
      { name: "Vietnam Record Crop Inflow", weight: 10, trend: "Harvest Surplus", impact: "-3.2¢" },
    ],
    ...generateContinuumData(-0.064, 0.068),
  },
};

export default function PredictiveModel() {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioKey>("baseline");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scenario = SCENARIOS[selectedScenario];
  const totalDays = 60;
  const todayIndex = 30;

  const width = 950;
  const height = 340;
  const paddingLeft = 50;
  const paddingRight = 75;
  const paddingTop = 28;
  const paddingBottom = 42;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const yMin = 240;
  const yMax = 360;

  const getY = (price: number) => {
    const clamped = Math.max(yMin, Math.min(yMax, price));
    return height - paddingBottom - ((clamped - yMin) / (yMax - yMin)) * plotHeight;
  };

  const getX = (idx: number) => {
    return paddingLeft + (idx / totalDays) * plotWidth;
  };

  const todayX = getX(todayIndex);

  const backtestPoints = scenario.points.slice(0, 31);
  const backtestConeD = useMemo(() => {
    const top = backtestPoints.map((pt, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(pt.p90)}`).join(" ");
    const bottomRev = backtestPoints
      .slice()
      .reverse()
      .map((pt, i) => `L ${getX(30 - i)} ${getY(pt.p10)}`)
      .join(" ");
    return `${top} ${bottomRev} Z`;
  }, [backtestPoints]);

  const actualSpotPath = useMemo(() => {
    return backtestPoints
      .filter((pt) => pt.actualSpot !== undefined)
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(pt.actualSpot!)}`)
      .join(" ");
  }, [backtestPoints]);

  const backtestMidPath = useMemo(() => {
    return backtestPoints.map((pt, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(pt.p50)}`).join(" ");
  }, [backtestPoints]);

  const forwardPoints = scenario.points.slice(30);
  const forwardConeD = useMemo(() => {
    const top = forwardPoints
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${getX(30 + i)} ${getY(pt.p90)}`)
      .join(" ");
    const bottomRev = forwardPoints
      .slice()
      .reverse()
      .map((pt, i) => `L ${getX(60 - i)} ${getY(pt.p10)}`)
      .join(" ");
    return `${top} ${bottomRev} Z`;
  }, [forwardPoints]);

  const forwardP50Path = useMemo(() => {
    return forwardPoints.map((pt, i) => `${i === 0 ? "M" : "L"} ${getX(30 + i)} ${getY(pt.p50)}`).join(" ");
  }, [forwardPoints]);

  const activePoint =
    hoverIndex !== null ? scenario.points[hoverIndex] : scenario.points[todayIndex];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    const clampedX = Math.max(paddingLeft, Math.min(paddingLeft + plotWidth, svgX));
    const ratio = (clampedX - paddingLeft) / plotWidth;
    const index = Math.round(ratio * totalDays);
    setHoverIndex(index);
  };

  return (
    <div className="w-full font-mono select-none" ref={containerRef}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6 pb-4 border-b border-stone-800/80">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold tracking-wide text-white uppercase font-sans">
              Editorial Futures Predictive Model & Backtest
            </h3>
            <span className="text-[11px] px-2.5 py-0.5 rounded bg-[#34211B] text-[#D9D9D9] border border-white/15 font-semibold">
              T-30 TO T+30 CONTINUUM
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-1 font-body">
            Realized spot performance validation against 30-day historical model backtest alongside forward Monte Carlo projections.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="bg-[#090808] px-3 py-1 rounded border border-stone-800/80 flex items-center gap-2">
            <span className="text-stone-400">Backtest Fit:</span>
            <strong className="text-[#C89D7C]">{scenario.backtestAccuracy}</strong>
          </div>
          <div className="bg-[#090808] px-3 py-1 rounded border border-stone-800/80 flex items-center gap-2">
            <span className="text-stone-400">MAE:</span>
            <strong className="text-white">{scenario.mae}</strong>
          </div>
          <div className="bg-[#090808] px-3 py-1 rounded border border-stone-800/80 flex items-center gap-2">
            <span className="text-stone-400">Confidence:</span>
            <strong className="text-white">{scenario.confidenceScore}%</strong>
            <span className="w-2 h-2 rounded-full bg-[#C89D7C] animate-pulse" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { key: "baseline", label: "BASE TREND (+3.8%)" },
              { key: "drought", label: "MINAS DROUGHT SHOCK (+14.2%)" },
              { key: "fx_deval", label: "BRL DEVALUATION (+8.5%)" },
              { key: "reversion", label: "DEMAND REVERSION (-6.4%)" },
            ] as const
          ).map((btn) => (
            <button
              key={btn.key}
              onClick={() => {
                setSelectedScenario(btn.key);
                setHoverIndex(null);
              }}
              style={{
                backgroundColor: selectedScenario === btn.key ? "#34211B" : "#090808",
                color: selectedScenario === btn.key ? "#FFFFFF" : "#A8A29E",
                borderColor: selectedScenario === btn.key ? "rgba(255,255,255,0.3)" : "rgba(120,113,108,0.25)",
              }}
              className="px-3 py-1.5 rounded-lg border text-[11px] font-bold tracking-wider transition-all hover:text-white font-sans"
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-[10px] text-stone-400">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-white" />
            <span>Actual Spot</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#C89D7C]" />
            <span>Model P50</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2 bg-[#C89D7C]/25 border border-[#C89D7C]/40 rounded-sm" />
            <span>P10-P90 Envelope</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-xl border border-stone-800/80 bg-[#090808] p-5 shadow-inner flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                {activePoint.isHistorical ? "T-30 Historical Out-of-Sample Backtest" : "T+30 Forward Monte Carlo Projection"}
              </span>
              <span className="text-[10px] text-stone-500">| {activePoint.date}</span>
            </div>

            <div className="text-[11px] bg-white/[0.03] px-2.5 py-1 rounded border border-stone-800/80 flex items-center gap-2">
              <span className="text-stone-400">
                {activePoint.dayOffset === 0 ? "Today" : activePoint.dayOffset < 0 ? `T${activePoint.dayOffset}d` : `T+${activePoint.dayOffset}d`}
              </span>
              <span className="text-stone-600">•</span>
              {activePoint.actualSpot !== undefined ? (
                <>
                  <span className="text-white">Actual: <strong>{activePoint.actualSpot}¢</strong></span>
                  <span className="text-stone-600">•</span>
                  <span className="text-[#C89D7C]">Model P50: <strong>{activePoint.p50}¢</strong></span>
                  <span className="text-stone-600">•</span>
                  <span className="text-stone-400 text-[10px]">
                    Δ {(activePoint.actualSpot - activePoint.p50 > 0 ? "+" : "")}{(activePoint.actualSpot - activePoint.p50).toFixed(2)}¢
                  </span>
                </>
              ) : (
                <>
                  <span className="text-white">Forward P50: <strong>{activePoint.p50}¢</strong></span>
                  <span className="text-stone-600">•</span>
                  <span className="text-[#C89D7C] text-[10px]">[{activePoint.p10}¢ - {activePoint.p90}¢]</span>
                </>
              )}
            </div>
          </div>

          <div className="relative w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto block cursor-crosshair"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverIndex(null)}
            >
              <defs>
                <linearGradient id="backtestConeGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#8E9AA8" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#C89D7C" stopOpacity="0.18" />
                </linearGradient>

                <linearGradient id="forwardConeGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#C89D7C" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#C89D7C" stopOpacity="0.06" />
                </linearGradient>
              </defs>

              {[260, 280, 300, 320, 340].map((level) => (
                <g key={level}>
                  <line
                    x1={paddingLeft}
                    y1={getY(level)}
                    x2={width - paddingRight}
                    y2={getY(level)}
                    stroke="rgba(255,255,255,0.05)"
                  />
                  <text
                    x={width - paddingRight + 8}
                    y={getY(level) + 3}
                    fill="#78716C"
                    fontSize="9.5"
                  >
                    {level}.00¢
                  </text>
                </g>
              ))}

              <path d={backtestConeD} fill="url(#backtestConeGrad)" />
              <path
                d={backtestPoints.map((pt, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(pt.p90)}`).join(" ")}
                fill="none"
                stroke="#C89D7C"
                strokeWidth="0.8"
                strokeDasharray="3 3"
                opacity="0.5"
              />
              <path
                d={backtestPoints.map((pt, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(pt.p10)}`).join(" ")}
                fill="none"
                stroke="#C89D7C"
                strokeWidth="0.8"
                strokeDasharray="3 3"
                opacity="0.5"
              />
              <path
                d={backtestMidPath}
                fill="none"
                stroke="#C89D7C"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                opacity="0.85"
              />
              <path
                d={actualSpotPath}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <path d={forwardConeD} fill="url(#forwardConeGrad)" />
              <path
                d={forwardPoints.map((pt, i) => `${i === 0 ? "M" : "L"} ${getX(30 + i)} ${getY(pt.p90)}`).join(" ")}
                fill="none"
                stroke="#C89D7C"
                strokeWidth="1"
                strokeDasharray="4 3"
                opacity="0.85"
              />
              <path
                d={forwardPoints.map((pt, i) => `${i === 0 ? "M" : "L"} ${getX(30 + i)} ${getY(pt.p10)}`).join(" ")}
                fill="none"
                stroke="#C89D7C"
                strokeWidth="1"
                strokeDasharray="4 3"
                opacity="0.85"
              />

              {scenario.forwardPaths.map((p, idx) => (
                <path
                  key={idx}
                  d={p.map((val, i) => `${i === 0 ? "M" : "L"} ${getX(30 + i)} ${getY(val)}`).join(" ")}
                  fill="none"
                  stroke="#8E9AA8"
                  strokeWidth="0.8"
                  opacity="0.30"
                />
              ))}

              <path
                d={forwardP50Path}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2"
                strokeLinecap="round"
              />

              <line
                x1={todayX}
                y1={paddingTop - 5}
                x2={todayX}
                y2={height - paddingBottom}
                stroke="#C89D7C"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <rect
                x={todayX - 22}
                y={paddingTop - 18}
                width="44"
                height="15"
                rx="3"
                fill="#34211B"
                stroke="#C89D7C"
                strokeWidth="0.8"
              />
              <text
                x={todayX}
                y={paddingTop - 7}
                fill="#FFFFFF"
                fontSize="8.5"
                fontWeight="bold"
                textAnchor="middle"
              >
                TODAY
              </text>

              <circle
                cx={todayX}
                cy={getY(287.15)}
                r="4.5"
                fill="#FFFFFF"
                stroke="#34211B"
                strokeWidth="2"
              />

              <text x={paddingLeft + 10} y={paddingTop + 6} fill="#78716C" fontSize="9" fontWeight="bold">
                ◄ HISTORICAL BACKTEST
              </text>
              <text x={width - paddingRight - 10} y={paddingTop + 6} fill="#C89D7C" fontSize="9" fontWeight="bold" textAnchor="end">
                FORWARD PROJECTION ►
              </text>

              {[
                { idx: 0, label: "T-30d" },
                { idx: 15, label: "T-15d" },
                { idx: 30, label: "Nov 8 (T-0)" },
                { idx: 45, label: "T+15d" },
                { idx: 60, label: "T+30d" },
              ].map((tick) => (
                <g key={tick.label}>
                  <line
                    x1={getX(tick.idx)}
                    y1={height - paddingBottom}
                    x2={getX(tick.idx)}
                    y2={height - paddingBottom + 4}
                    stroke="rgba(255,255,255,0.2)"
                  />
                  <text
                    x={getX(tick.idx)}
                    y={height - paddingBottom + 16}
                    fill={tick.idx === 30 ? "#FFFFFF" : "#78716C"}
                    fontWeight={tick.idx === 30 ? "bold" : "normal"}
                    fontSize="9.5"
                    textAnchor="middle"
                  >
                    {tick.label}
                  </text>
                </g>
              ))}

              {hoverIndex !== null && (
                <g>
                  <line
                    x1={getX(hoverIndex)}
                    y1={paddingTop}
                    x2={getX(hoverIndex)}
                    y2={height - paddingBottom}
                    stroke="rgba(255,255,255,0.6)"
                    strokeDasharray="2 3"
                    strokeWidth="1"
                  />

                  {activePoint.actualSpot !== undefined && (
                    <circle
                      cx={getX(hoverIndex)}
                      cy={getY(activePoint.actualSpot)}
                      r="4.5"
                      fill="#FFFFFF"
                      stroke="#000000"
                      strokeWidth="1.5"
                    />
                  )}

                  <circle
                    cx={getX(hoverIndex)}
                    cy={getY(activePoint.p50)}
                    r="3.5"
                    fill="#C89D7C"
                    stroke="#FFFFFF"
                    strokeWidth="1"
                  />
                </g>
              )}
            </svg>
          </div>

          <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between text-[10px] text-stone-500">
            <span>Left: Actual Price vs. Out-of-Sample Model Envelope | Right: Stochastic Monte Carlo Simulation</span>
            <span>Anchor: 287.15¢</span>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col justify-between gap-4">
          <div className="rounded-xl border border-stone-800/80 bg-[#090808] p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-stone-400 uppercase tracking-wider font-sans">
                {scenario.badge}
              </span>
              <span className="text-[10px] text-[#C89D7C] font-bold">
                {scenario.expectedDrift} 30D Drift
              </span>
            </div>

            <div className="text-3xl font-extrabold text-white tracking-tight">
              {scenario.expectedClose}¢
            </div>
            <div className="text-xs text-stone-400 mt-1">
              Projected Range: ({scenario.projectedRange[0]}¢ - {scenario.projectedRange[1]}¢)
            </div>

            <div className="mt-4 pt-3 border-t border-stone-800/80 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-stone-500 block">Backtest Hit Rate</span>
                <strong className="text-white">{scenario.backtestAccuracy}</strong>
              </div>
              <div>
                <span className="text-[10px] text-stone-500 block">Tracking MAE</span>
                <strong className="text-[#C89D7C]">{scenario.mae}</strong>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-stone-800/80 bg-[#090808] p-5 flex-1 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-3 font-sans">
                Active Feature Weights & Drivers
              </span>

              <div className="space-y-3.5">
                {scenario.drivers.map((d, i) => (
                  <div key={i} className="text-xs">
                    <div className="flex justify-between items-center text-[#D9D9D9] mb-1">
                      <span className="truncate pr-2">{d.name}</span>
                      <strong className="text-white font-mono shrink-0">{d.weight}%</strong>
                    </div>

                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mb-1">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${d.weight}%`,
                          backgroundColor:
                            i === 0 ? "#D9D9D9" : i === 1 ? "#C89D7C" : i === 2 ? "#8E9AA8" : "#6E7A8A",
                        }}
                      />
                    </div>

                    <div className="flex justify-between text-[10px] text-stone-400">
                      <span>{d.trend}</span>
                      <span className="text-[#C89D7C]">{d.impact}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-stone-800/80 text-[10px] text-stone-500">
              Weights recalibrate dynamically upon stress test parameter selection.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
