"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";

export interface HeroNewsItem {
  headline: string;
  source: string;
  time: string;
}

interface HeroSectionProps {
  items?: HeroNewsItem[];
}

const FALLBACK_NEWS: HeroNewsItem[] = [
  {
    headline: "Precipitation deficits in northern Minas Gerais trigger revised post-flowering berry set projections.",
    source: "Conab Monitor",
    time: "10h ago",
  },
  {
    headline: "ICE certified Arabica warehouse stocks register consecutive weekly drawdowns, hovering near historic lows.",
    source: "ICE Terminal",
    time: "3h ago",
  },
  {
    headline: "Vietnam Robusta exports surge amid tight supplies from Southeast Asian crop estimates.",
    source: "Trade Logistics",
    time: "5h ago",
  },
  {
    headline: "USD/BRL real fluctuations prompt Brazilian exporters to pause forward commercial spot fixings.",
    source: "Macro FX",
    time: "6h ago",
  },
  {
    headline: "Port of Santos vessel backlog eases as container throughput accelerates for Q4 European shipments.",
    source: "Maritime Flow",
    time: "8h ago",
  },
];

export default function HeroSection({ items }: HeroSectionProps) {
  const newsFeed = items && items.length > 0 ? items : FALLBACK_NEWS;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  const safeIndex = currentIndex % newsFeed.length;

  useEffect(() => {
    const fullText = newsFeed[safeIndex].headline;
    setDisplayedText("");
    setIsTyping(true);
    let charIndex = 0;

    const typingInterval = setInterval(() => {
      charIndex++;
      setDisplayedText(fullText.slice(0, charIndex));

      if (charIndex >= fullText.length) {
        clearInterval(typingInterval);
        setIsTyping(false);
      }
    }, 28);

    return () => clearInterval(typingInterval);
  }, [safeIndex, newsFeed]);

  useEffect(() => {
    const slideTimer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % newsFeed.length);
    }, 8500);
    return () => clearInterval(slideTimer);
  }, [newsFeed.length]);

  const currentNews = newsFeed[safeIndex];

  return (
    <section className="relative w-full rounded-3xl overflow-hidden min-h-[440px] md:min-h-[480px] flex items-center p-6 md:p-10 border border-stone-800/80 shadow-2xl bg-black">
      <Image
        src="/coffee_hero2.jpg"
        alt="Coffee Flow Hero Visual"
        fill
        priority
        quality={95}
        className="object-cover object-center filter brightness-110 contrast-105"
      />

      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent z-10 pointer-events-none" />

      <div className="relative z-20 max-w-md sm:max-w-lg md:max-w-xl w-full min-h-[300px] md:min-h-[320px] rounded-[20px] overflow-hidden backdrop-blur-xl bg-[#11100F]/65 border border-stone-700/50 shadow-[0_12px_40px_rgba(0,0,0,0.55)] flex flex-row">
        <div className="w-7 sm:w-8 md:w-9 bg-[#D9D9D9] shrink-0 border-r border-black/20" />

        <div className="flex-1 p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <h2 className="text-sm sm:text-base md:text-lg font-bold text-[#D9D9D9] tracking-tight font-sans">
              &ldquo;From Origin Soil to Terminal Liquidity&rdquo;
            </h2>

            <div className="mt-3.5 min-h-[85px] flex flex-col justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-[#D9D9D9] leading-relaxed min-h-[52px] font-body">
                  {displayedText}
                  <span
                    className={`inline-block w-1.5 h-3.5 ml-1 bg-[#D9D9D9] align-middle ${
                      isTyping ? "opacity-100" : "animate-pulse"
                    }`}
                  />
                </p>

                <div className="mt-2.5 flex items-center gap-2 text-[10px] font-mono text-[#D9D9D9]/70">
                  <span className="font-semibold uppercase tracking-wider text-[#D9D9D9]">
                    {currentNews.source}
                  </span>
                  <span>•</span>
                  <span>{currentNews.time}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-stone-800/80 flex flex-wrap items-center justify-between gap-3 font-sans">
            <div className="flex items-center gap-3">
              <a
                href="#flow"
                style={{ backgroundColor: "#34211B", color: "#D9D9D9" }}
                className="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all shadow-md text-center hover:brightness-125 hover:text-white"
              >
                EXPLORE FLOW
              </a>
              <a
                href="#news"
                style={{ backgroundColor: "#34211B", color: "#D9D9D9" }}
                className="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all shadow-md text-center hover:brightness-125 hover:text-white"
              >
                MARKET NEWS
              </a>
            </div>

            <div className="flex items-center gap-1.5">
              {newsFeed.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`News ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    safeIndex === idx
                      ? "w-4 bg-[#D9D9D9]"
                      : "w-1.5 bg-[#D9D9D9]/30 hover:bg-[#D9D9D9]/50"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
