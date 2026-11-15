"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  Time,
} from "lightweight-charts";
import Papa from "papaparse";

interface MarketRow {
  date: string;
  arabica_cents_lb: string;
  usd_brl: string;
  arabica_sma20: string;
  arabica_sma50: string;
}

interface PriceDataPoint {
  time: Time;
  value: number;
}

export default function CoffeeChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [dataPointsCount, setDataPointsCount] = useState<number>(0);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    let chart: IChartApi | null = null;
    let mainSeries: ISeriesApi<"Area"> | null = null;
    let sma20Series: ISeriesApi<"Line"> | null = null;
    let sma50Series: ISeriesApi<"Line"> | null = null;

    chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#78716c",
        fontFamily: "var(--font-mono), monospace",
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.04)" },
        horzLines: { color: "rgba(255, 255, 255, 0.04)" },
      },
      crosshair: {
        vertLine: { color: "#d97706", width: 1, style: 2 },
        horzLine: { color: "#d97706", width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        autoScale: true,
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    mainSeries = chart.addAreaSeries({
      topColor: "rgba(217, 119, 6, 0.35)",
      bottomColor: "rgba(217, 119, 6, 0.0)",
      lineColor: "#f59e0b",
      lineWidth: 2,
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.05,
      },
    });

    sma20Series = chart.addLineSeries({
      color: "#10b981",
      lineWidth: 1,
      priceLineVisible: false,
    });

    sma50Series = chart.addLineSeries({
      color: "#94a3b8",
      lineWidth: 1,
      priceLineVisible: false,
    });

    fetch("/api/market-history")
      .then((res) => {
        if (!res.ok) throw new Error("HTTP error " + res.status);
        return res.text();
      })
      .then((csvText) => {
        Papa.parse<MarketRow>(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const rawData = results.data;
            const parseDateToTime = (d: string): string => d.split(" ")[0];

            const pricePoints: PriceDataPoint[] = [];
            const sma20Points: PriceDataPoint[] = [];
            const sma50Points: PriceDataPoint[] = [];

            rawData.forEach((row) => {
              if (!row.date || !row.arabica_cents_lb) return;
              const formattedDate = parseDateToTime(row.date);
              const price = parseFloat(row.arabica_cents_lb);

              if (!isNaN(price)) {
                pricePoints.push({ time: formattedDate as Time, value: price });
              }

              if (row.arabica_sma20) {
                const sma20 = parseFloat(row.arabica_sma20);
                if (!isNaN(sma20)) {
                  sma20Points.push({ time: formattedDate as Time, value: sma20 });
                }
              }

              if (row.arabica_sma50) {
                const sma50 = parseFloat(row.arabica_sma50);
                if (!isNaN(sma50)) {
                  sma50Points.push({ time: formattedDate as Time, value: sma50 });
                }
              }
            });

            pricePoints.sort((a, b) => (String(a.time) > String(b.time) ? 1 : -1));
            sma20Points.sort((a, b) => (String(a.time) > String(b.time) ? 1 : -1));
            sma50Points.sort((a, b) => (String(a.time) > String(b.time) ? 1 : -1));

            mainSeries?.setData(pricePoints);
            sma20Series?.setData(sma20Points);
            sma50Series?.setData(sma50Points);

            chart?.timeScale().fitContent();
            setDataPointsCount(pricePoints.length);
            setLoading(false);
          },
        });
      })
      .catch((err) => {
        console.error("Failed to load chart data:", err);
        setLoading(false);
      });

    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart?.remove();
    };
  }, []);

  return (
    <div className="w-full flex flex-col justify-between">
      <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-stone-400 mb-3 gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-amber-500 inline-block" /> Arabica Spot
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-emerald-500 inline-block" /> SMA 20
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-slate-400 inline-block" /> SMA 50
          </span>
        </div>
        {dataPointsCount > 0 && (
          <span className="text-stone-500">
            {dataPointsCount} trading sessions indexed
          </span>
        )}
      </div>

      <div className="relative w-full h-72">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-stone-500">
            Streaming market tape...
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
