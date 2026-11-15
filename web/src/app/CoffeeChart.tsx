"use client";

import React, { useEffect, useRef, useState } from "react";
import { createChart, ColorType, AreaSeries, LineSeries, ISeriesApi } from "lightweight-charts";

export interface ChartSessionPoint {
  time: string;
  close: number;
  sma20: number;
  sma50: number;
}

interface CoffeeChartProps {
  data?: ChartSessionPoint[];
}

const FALLBACK_DATA: ChartSessionPoint[] = [
  { time: "2026-10-10", close: 293.0, sma20: 299.5, sma50: 298.8 },
  { time: "2026-10-12", close: 298.0, sma20: 300.2, sma50: 299.0 },
  { time: "2026-10-14", close: 305.0, sma20: 300.8, sma50: 299.1 },
  { time: "2026-10-16", close: 301.0, sma20: 301.0, sma50: 299.3 },
  { time: "2026-10-18", close: 290.0, sma20: 300.6, sma50: 299.4 },
  { time: "2026-10-20", close: 294.0, sma20: 300.1, sma50: 299.5 },
  { time: "2026-10-22", close: 289.0, sma20: 299.5, sma50: 299.6 },
  { time: "2026-10-24", close: 318.0, sma20: 298.6, sma50: 299.7 },
  { time: "2026-10-26", close: 312.0, sma20: 297.9, sma50: 299.9 },
  { time: "2026-10-28", close: 302.0, sma20: 297.5, sma50: 300.0 },
  { time: "2026-10-30", close: 305.0, sma20: 297.6, sma50: 300.1 },
  { time: "2026-11-01", close: 304.0, sma20: 298.0, sma50: 300.2 },
  { time: "2026-11-03", close: 298.0, sma20: 298.9, sma50: 300.3 },
  { time: "2026-11-05", close: 300.0, sma20: 299.8, sma50: 300.4 },
  { time: "2026-11-07", close: 306.0, sma20: 300.6, sma50: 300.6 },
  { time: "2026-11-09", close: 300.0, sma20: 301.1, sma50: 300.8 },
  { time: "2026-11-11", close: 292.0, sma20: 301.2, sma50: 301.0 },
  { time: "2026-11-13", close: 290.0, sma20: 301.0, sma50: 301.2 },
  { time: "2026-11-15", close: 278.65, sma20: 290.15, sma50: 293.07 },
];

export default function CoffeeChart({ data }: CoffeeChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const sma20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const sma50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [showSma20, setShowSma20] = useState(true);
  const [showSma50, setShowSma50] = useState(true);

  const seriesData = data && data.length > 0 ? data : FALLBACK_DATA;

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#A8A29E",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.04)" },
        horzLines: { color: "rgba(255, 255, 255, 0.04)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.08)",
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.08)",
        timeVisible: false,
      },
      crosshair: {
        vertLine: { color: "rgba(217, 217, 217, 0.3)", width: 1, style: 2 },
        horzLine: { color: "rgba(217, 217, 217, 0.3)", width: 1, style: 2 },
      },
      width: chartContainerRef.current.clientWidth,
      height: 290,
    });

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: "#C89D7C",
      topColor: "rgba(200, 157, 124, 0.22)",
      bottomColor: "rgba(200, 157, 124, 0.0)",
      lineWidth: 2,
      title: "",
    });

    const sma20Series = chart.addSeries(LineSeries, {
      color: "#D9D9D9",
      lineWidth: 1,
      title: "",
      visible: showSma20,
    });

    const sma50Series = chart.addSeries(LineSeries, {
      color: "#8E9AA8",
      lineWidth: 1,
      title: "",
      visible: showSma50,
    });

    sma20SeriesRef.current = sma20Series;
    sma50SeriesRef.current = sma50Series;

    areaSeries.setData(seriesData.map((d) => ({ time: d.time, value: d.close })));
    sma20Series.setData(seriesData.map((d) => ({ time: d.time, value: d.sma20 })));
    sma50Series.setData(seriesData.map((d) => ({ time: d.time, value: d.sma50 })));

    if (seriesData.length > 65) {
      chart.timeScale().setVisibleLogicalRange({
        from: seriesData.length - 65,
        to: seriesData.length - 1,
      });
    } else {
      chart.timeScale().fitContent();
    }

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      sma20SeriesRef.current = null;
      sma50SeriesRef.current = null;
      chart.remove();
    };
  }, [seriesData]);

  // Toggle series visibility without resetting zoom/pan position
  useEffect(() => {
    if (sma20SeriesRef.current) {
      sma20SeriesRef.current.applyOptions({ visible: showSma20 });
    }
  }, [showSma20]);

  useEffect(() => {
    if (sma50SeriesRef.current) {
      sma50SeriesRef.current.applyOptions({ visible: showSma50 });
    }
  }, [showSma50]);

  return (
    <div className="w-full font-mono select-none">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] mb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 text-[#C89D7C] font-semibold px-2 py-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#C89D7C]" />
            Arabica Spot
          </span>

          <button
            type="button"
            onClick={() => setShowSma20((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded border transition-all cursor-pointer ${
              showSma20
                ? "bg-[#34211B] text-[#D9D9D9] border-white/30"
                : "bg-[#090808] text-stone-500 border-stone-800/80 opacity-60 hover:opacity-90"
            }`}
          >
            <span className="w-2.5 h-0.5 bg-[#D9D9D9]" />
            <span>SMA 20</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSma50((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded border transition-all cursor-pointer ${
              showSma50
                ? "bg-[#34211B] text-[#8E9AA8] border-[#8E9AA8]/40"
                : "bg-[#090808] text-stone-500 border-stone-800/80 opacity-60 hover:opacity-90"
            }`}
          >
            <span className="w-2.5 h-0.5 bg-[#8E9AA8]" />
            <span>SMA 50</span>
          </button>
        </div>

        <span className="text-stone-400">
          {seriesData.length} trading sessions indexed
        </span>
      </div>

      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
}
