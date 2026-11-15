"use client";

import React, { useState } from "react";
import Image from "next/image";

interface HeaderProps {
  arabicaSpot?: number;
  robustaPrice?: number;
  iceStocks?: string;
  usdBrl?: number;
}

export default function Header({
  arabicaSpot = 287.15,
  robustaPrice = 3472,
  iceStocks = "734k",
  usdBrl = 5.38,
}: HeaderProps) {
  const [activeNav, setActiveNav] = useState("charts");

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    setActiveNav(targetId);

    if (targetId === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const element = document.getElementById(targetId);
    if (element) {
      const headerOffset = 95;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[#34211B] border-b border-black/40 shadow-lg select-none font-sans">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 pt-5 pb-3 flex items-center justify-between">
        <a
          href="#top"
          onClick={(e) => handleNavClick(e, "top")}
          className="flex items-center gap-4 sm:gap-5 group cursor-pointer transition-opacity hover:opacity-90"
        >
          <div className="relative w-12 sm:w-14 h-9 sm:h-10 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
            <Image
              src="/logo.png"
              alt="Coffee Flow Logo"
              fill
              priority
              className="object-contain transition-transform group-hover:scale-105"
            />
          </div>
          <span className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-wider text-[#D9D9D9] font-sans">
            COFFEE FLOW
          </span>
        </a>

        <nav className="flex items-center gap-6 sm:gap-8 md:gap-10">
          {[
            { label: "CHARTS", id: "charts" },
            { label: "FLOW", id: "flow" },
            { label: "NEWS", id: "news" },
            { label: "ABOUT", id: "about" },
          ].map((item) => {
            const isActive = activeNav === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => handleNavClick(e, item.id)}
                className={`text-xs md:text-sm font-bold tracking-widest transition-all pb-1 border-b-2 cursor-pointer font-sans ${
                  isActive
                    ? "text-white border-[#D9D9D9]"
                    : "text-[#D9D9D9]/70 border-transparent hover:text-white hover:border-[#D9D9D9]/50"
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
      </div>

      <div className="w-full flex justify-end">
        <div
          className="bg-[#11100F] border-t border-l border-stone-800/80 shadow-2xl px-6 sm:px-8 py-2 flex items-center gap-3 font-mono text-[11px] md:text-xs tracking-tight overflow-x-auto text-[#D9D9D9]"
          style={{
            clipPath: "polygon(22px 0%, 100% 0%, 100% 100%, 0% 100%)",
          }}
        >
          <span className="font-normal whitespace-nowrap">
            KC Arabica {arabicaSpot.toFixed(2)}¢ <span className="text-[10px]">▲</span>
          </span>

          <span className="text-white/20 select-none">|</span>

          <span className="font-normal whitespace-nowrap">
            RC Robusta ${robustaPrice.toLocaleString()}/MT <span className="text-[10px]">▼</span>
          </span>

          <span className="text-white/20 select-none">|</span>

          <span className="font-normal whitespace-nowrap">
            ICE Stocks {iceStocks} bags <span className="text-[10px]">▼</span>
          </span>

          <span className="text-white/20 select-none">|</span>

          <span className="font-normal whitespace-nowrap">
            USD/BRL {usdBrl.toFixed(2)} <span className="text-[10px]">▲</span>
          </span>
        </div>
      </div>
    </header>
  );
}
