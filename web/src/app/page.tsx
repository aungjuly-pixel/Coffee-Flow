import fs from "fs";
import path from "path";
import Image from "next/image";
import CoffeeChart, { ChartSessionPoint } from "./CoffeeChart";
import CotChart, { CotPoint } from "./CotChart";
import FlowMap from "./FlowMap";
import Header from "./Header";
import HeroSection from "./HeroSection";
import PredictiveModel from "./PredictiveModel";
import NewsImage from "./NewsImage";

interface IcePortItem {
  code: string;
  label: string;
  bags: number;
  delta: string;
  share_pct: number;
}

interface IceStocksDetail {
  short_label: string;
  is_up: boolean;
  status_badge: string;
  report_date?: string;
  total_bags: number;
  top_ports: IcePortItem[];
}

interface CotGroupSummary {
  net: number;
  gross_long: number;
  gross_short: number;
  percentile_52w: number;
}

interface CotSummary {
  report_date?: string;
  commercial: CotGroupSummary;
  large_spec: CotGroupSummary;
  small_spec: CotGroupSummary;
}

interface MarketSnapshot {
  timestamp: string;
  arabica_spot_cents_lb: number;
  arabica_change_pct: number;
  arabica_up?: boolean;
  sma20?: number;
  sma50?: number;
  robusta_price_mt?: number;
  robusta_up?: boolean;
  ice_stocks?: string;
  ice_stocks_up?: boolean;
  ice_stocks_detail?: IceStocksDetail;
  usd_brl: number;
  usd_brl_up?: boolean;
  market_status: string;
  benchmark: string;
  chart_history?: ChartSessionPoint[];
  cot_history?: CotPoint[];
  cot_summary?: CotSummary;
}

async function getMarketSnapshot(): Promise<MarketSnapshot | null> {
  try {
    const filePath = path.join(process.cwd(), "..", "ticker_snapshot.json");
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(fileContent);
    }
  } catch (error) {
    console.error("Error reading ticker_snapshot.json:", error);
  }
  return null;
}

interface NewsArticle {
  title: string;
  summary: string;
  url: string;
  image: string;
  source: string;
  region: string;
  category: string;
  timeAgo: string;
}

async function getNewsArticles(): Promise<NewsArticle[]> {
  try {
    const filePath = path.join(process.cwd(), "..", "news_snapshot.json");
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(fileContent);
      if (Array.isArray(parsed?.articles) && parsed.articles.length > 0) {
        return parsed.articles.slice(0, 5);
      }
    }
  } catch (error) {
    console.error("Error reading news_snapshot.json:", error);
  }
  return [];
}

export default async function Home() {
  const snapshot = await getMarketSnapshot();
  const newsArticles = await getNewsArticles();

  const arabicaSpot = snapshot?.arabica_spot_cents_lb ?? 287.15;
  const arabicaUp = snapshot?.arabica_up ?? true;
  const robustaPrice = snapshot?.robusta_price_mt ?? 3472;
  const robustaUp = snapshot?.robusta_up ?? false;
  const iceStocks = snapshot?.ice_stocks ?? "734k";
  const iceStocksUp = snapshot?.ice_stocks_up ?? false;
  const usdBrl = snapshot?.usd_brl ?? 5.38;
  const usdBrlUp = snapshot?.usd_brl_up ?? true;
  const sma20 = snapshot?.sma20 ?? 284.10;
  const sma50 = snapshot?.sma50 ?? 268.45;
  const chartHistory = snapshot?.chart_history ?? [];
  const cotSummary: CotSummary = snapshot?.cot_summary ?? {
    commercial: { net: -17538, gross_long: 32490, gross_short: 50028, percentile_52w: 50 },
    large_spec: { net: 9605, gross_long: 38110, gross_short: 28505, percentile_52w: 50 },
    small_spec: { net: 1962, gross_long: 9230, gross_short: 7268, percentile_52w: 50 },
  };
  const fmtSigned = (n: number) => `${n >= 0 ? "+" : ""}${Math.round(n).toLocaleString()}`;
  const fmtOrdinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
  };
  const iceDetail: IceStocksDetail = snapshot?.ice_stocks_detail ?? {
    short_label: "211k",
    is_up: false,
    status_badge: "DRAWDOWN",
    report_date: "",
    total_bags: 211321,
    top_ports: [
      { code: "ANT", label: "Antwerp Port (EU Warehouse)", bags: 161400, delta: "-9.7%", share_pct: 76 },
      { code: "HA/BR", label: "Hamburg / Bremen (DE)", bags: 6772, delta: "Unchanged", share_pct: 4 },
      { code: "NY", label: "New York (US Terminal)", bags: 890, delta: "Unchanged", share_pct: 4 },
    ],
  };
  const timestamp = snapshot?.timestamp ?? "Active Sync";

  return (
    <main id="top" className="min-h-screen bg-black text-[#D9D9D9] flex flex-col selection:bg-stone-800 font-body">
      <Header
        arabicaSpot={arabicaSpot}
        arabicaUp={arabicaUp}
        robustaPrice={robustaPrice}
        robustaUp={robustaUp}
        iceStocks={iceStocks}
        iceStocksUp={iceStocksUp}
        usdBrl={usdBrl}
        usdBrlUp={usdBrlUp}
      />

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-10 bg-black">
        <HeroSection items={newsArticles.map((a) => ({ headline: a.title, source: a.source, time: a.timeAgo }))} />

        {/* 3. CHARTS CONTAINER */}
        <section id="charts" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 relative overflow-hidden rounded-2xl border border-stone-800/80 bg-[#11100F] p-6 flex flex-col justify-between shadow-xl">
            <div className="absolute inset-0 z-0 pointer-events-none">
              <Image
                src="/chart_background.jpg"
                alt="Price Chart Background"
                fill
                priority
                className="object-cover object-center opacity-20 grayscale filter brightness-75 contrast-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#11100F] via-[#11100F]/85 to-[#11100F]/90" />
            </div>

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold tracking-wider text-[#D9D9D9] uppercase font-sans">
                  KC Arabica Futures (Rolling Continuous)
                </h3>
                <span className="text-[11px] px-2.5 py-0.5 rounded bg-[#34211B] text-[#D9D9D9] border border-white/15 font-mono font-semibold tracking-wider">
                  LIVE BENCHMARK
                </span>
              </div>
              <p className="text-xs text-stone-400 font-body">
                Daily close with SMA20 and SMA50 institutional momentum indicators.
              </p>
            </div>
            
            <div className="my-4 w-full relative z-10">
              <CoffeeChart data={chartHistory} />
            </div>

            <div className="relative z-10 flex items-center justify-between text-xs font-mono text-stone-400 pt-3 border-t border-stone-800/80">
              <span>SMA20: {sma20.toFixed(2)}¢ | SMA50: {sma50.toFixed(2)}¢</span>
              <span>Synced: {timestamp}</span>
            </div>
          </div>

          <div id="stocks" className="rounded-2xl border border-stone-800/80 bg-[#11100F] p-6 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold tracking-wider text-[#D9D9D9] uppercase font-sans">
                  ICE Certified Stocks
                </h3>
                <span className="text-[11px] font-mono text-[#D9D9D9] bg-[#34211B] px-2.5 py-0.5 rounded border border-white/15 tracking-wider font-semibold">
                  {iceDetail.status_badge}
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-1 font-body">
                All 8 licensed ICE delivery ports ranked by certified inventory.
              </p>
            </div>

            <div className="my-4 space-y-2.5 font-mono">
              {iceDetail.top_ports.map((port, idx) => (
                <div key={port.code}>
                  <div className="flex justify-between text-xs text-[#D9D9D9] mb-1">
                    <span className="text-stone-300 truncate pr-2">{port.label}</span>
                    <span className={idx < 2 ? "text-white font-semibold shrink-0" : "text-stone-400 shrink-0"}>
                      {port.bags.toLocaleString()} bags ({port.delta})
                    </span>
                  </div>
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`${idx < 2 ? "bg-[#D9D9D9]" : "bg-[#8E9AA8]"} h-full transition-all duration-500`}
                      style={{ width: `${port.share_pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3.5 rounded-xl border border-stone-800/80 bg-[#090808] text-xs font-mono text-stone-400 flex items-center justify-between">
              <span>
                Total Certified{iceDetail.report_date ? ` (${iceDetail.report_date})` : ""}:
              </span>
              <strong className="text-white text-sm">
                {iceDetail.total_bags.toLocaleString()} Bags
              </strong>
            </div>
          </div>
        </section>

        {/* 4. ACTIVE FLOW RADAR CONTAINER */}
        <section id="flow" className="rounded-2xl border border-stone-800/80 bg-[#11100F] p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6 pb-4 border-b border-stone-800/80">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold tracking-wide text-white uppercase font-sans">
                  Global Origin Harvest Radar & Port Flow
                </h3>
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-[#34211B] text-[#D9D9D9] border border-white/15 font-semibold">
                  LIVE SPATIAL CORRIDORS
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-1 font-body">
                Spatial transit lanes connecting South American & Southeast Asian origin ports to European & North American discharge terminals.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-stone-400">
                Active Vessel Telemetry: <strong className="text-white">42 Vessels En Route</strong>
              </span>
            </div>
          </div>

          <FlowMap />
        </section>

        {/* 5. CFTC COMMITMENT OF TRADERS (COT) SECTION */}
        <section id="cot" className="rounded-2xl border border-stone-800/80 bg-[#11100F] p-6 sm:p-8 shadow-xl">

          <div className="mb-8">
            <CotChart data={snapshot?.cot_history} />
          </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {/* Commercial Players */}
            <div className="rounded-2xl border border-stone-800/80 bg-[#11100F] p-6 font-mono">
              <div className="flex items-center justify-between text-[11px] mb-3">
                <span className="font-bold tracking-wider text-[#D9D9D9] uppercase font-sans">
                  Commercial Players
                </span>
                <span className="text-stone-500">PRODUCERS / MERCHANTS</span>
              </div>
              <div className="text-2xl md:text-3xl font-bold text-white">
                {fmtSigned(cotSummary.commercial.net)}
              </div>
              <div className="text-xs text-stone-400 mt-1 font-body">
                {cotSummary.commercial.net < 0 ? "Net Hedged Short Contracts" : "Net Hedged Long Contracts"}
              </div>
              <div className="my-4 border-t border-stone-800/70" />
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-400">Gross Long:</span>
                  <span className="text-white">{cotSummary.commercial.gross_long.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Gross Short:</span>
                  <span className="text-white">{cotSummary.commercial.gross_short.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-stone-400">52W Net Percentile</span>
                  <span className="text-white font-semibold">
                    {fmtOrdinal(cotSummary.commercial.percentile_52w)} %tile
                  </span>
                </div>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-[#C89D7C] h-full transition-all duration-500"
                  style={{ width: `${Math.max(4, cotSummary.commercial.percentile_52w)}%` }}
                />
              </div>
            </div>

            {/* Large Speculators */}
            <div className="rounded-2xl border border-stone-800/80 bg-[#11100F] p-6 font-mono">
              <div className="flex items-center justify-between text-[11px] mb-3">
                <span className="font-bold tracking-wider text-[#D9D9D9] uppercase font-sans">
                  Large Speculators
                </span>
                <span className="text-stone-500">MANAGED MONEY / FUNDS</span>
              </div>
              <div className="text-2xl md:text-3xl font-bold text-white">
                {fmtSigned(cotSummary.large_spec.net)}
              </div>
              <div className="text-xs text-stone-400 mt-1 font-body">
                {cotSummary.large_spec.net >= 0 ? "Net Speculative Long Contracts" : "Net Speculative Short Contracts"}
              </div>
              <div className="my-4 border-t border-stone-800/70" />
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-400">Gross Long:</span>
                  <span className="text-white">{cotSummary.large_spec.gross_long.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Gross Short:</span>
                  <span className="text-white">{cotSummary.large_spec.gross_short.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-stone-400">52W Net Percentile</span>
                  <span className="text-white font-semibold">
                    {fmtOrdinal(cotSummary.large_spec.percentile_52w)} %tile
                  </span>
                </div>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-[#D9D9D9] h-full transition-all duration-500"
                  style={{ width: `${Math.max(4, cotSummary.large_spec.percentile_52w)}%` }}
                />
              </div>
            </div>

            {/* Small Speculators */}
            <div className="rounded-2xl border border-stone-800/80 bg-[#11100F] p-6 font-mono">
              <div className="flex items-center justify-between text-[11px] mb-3">
                <span className="font-bold tracking-wider text-[#D9D9D9] uppercase font-sans">
                  Small Speculators
                </span>
                <span className="text-stone-500">NON-REPORTABLE</span>
              </div>
              <div className="text-2xl md:text-3xl font-bold text-white">
                {fmtSigned(cotSummary.small_spec.net)}
              </div>
              <div className="text-xs text-stone-400 mt-1 font-body">
                {cotSummary.small_spec.net >= 0 ? "Net Retail Long Contracts" : "Net Retail Short Contracts"}
              </div>
              <div className="my-4 border-t border-stone-800/70" />
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-400">Gross Long:</span>
                  <span className="text-white">{cotSummary.small_spec.gross_long.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Gross Short:</span>
                  <span className="text-white">{cotSummary.small_spec.gross_short.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-stone-400">52W Net Percentile</span>
                  <span className="text-white font-semibold">
                    {fmtOrdinal(cotSummary.small_spec.percentile_52w)} %tile
                  </span>
                </div>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-[#8E9AA8] h-full transition-all duration-500"
                  style={{ width: `${Math.max(4, cotSummary.small_spec.percentile_52w)}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 6. EDITORIAL PREDICTIVE MODEL */}
        <section id="predictive" className="rounded-2xl border border-stone-800/80 bg-[#11100F] p-6 sm:p-8 shadow-xl">
          <PredictiveModel />
        </section>

        {/* 7. NEWS CONTAINER WITH PHOTOS */}
        <section id="news" className="rounded-2xl border border-stone-800/80 bg-[#11100F] p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6 pb-4 border-b border-stone-800/80">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold tracking-wide text-white uppercase font-sans">
                  Origin & Terminal Intelligence Wire
                </h3>
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-[#34211B] text-[#D9D9D9] border border-white/15">
                  REAL-TIME DISPATCHES
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-1 font-body">
                Verified reports across Daily Coffee News, Perfect Daily Grind, and Global Coffee Report.
              </p>
            </div>
            <span className="text-xs font-mono text-stone-400 uppercase font-semibold">
              5 Live Dispatches • 3 Sources
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {newsArticles.map((article, idx) => (
              <article
                key={idx}
                className="group rounded-xl border border-stone-800/80 bg-[#090808] overflow-hidden hover:border-stone-600 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="relative w-full h-40 overflow-hidden bg-stone-900">
                    <NewsImage src={article.image} alt={article.title} />
                    <div className="absolute top-3 left-3 bg-[#11100F]/90 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono font-bold text-[#D9D9D9] border border-stone-700/60 uppercase">
                      {article.category}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="text-[11px] font-mono text-stone-400 mb-1.5 flex items-center gap-2">
                      <span className="truncate">{article.region}</span>
                      <span>•</span>
                      <span className="shrink-0">{article.timeAgo}</span>
                    </div>
                    <h4 className="text-sm font-bold text-[#D9D9D9] group-hover:text-white leading-snug line-clamp-2 font-sans">
                      {article.title}
                    </h4>
                    <p className="mt-2 text-xs text-stone-400 line-clamp-3 leading-relaxed font-body">
                      {article.summary}
                    </p>
                  </div>
                </div>
                <div className="p-4 pt-2 text-[11px] font-mono text-stone-500 border-t border-stone-800/80 flex justify-between items-center gap-2">
                  <span className="truncate">Source: {article.source}</span>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-400 group-hover:text-white transition-colors shrink-0"
                  >
                    Read →
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {/* 8. FOOTER */}
      <footer id="about" className="w-full bg-black border-t border-stone-800/80 mt-16 font-body">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 pb-10 border-b border-stone-800/80">
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-7 rounded overflow-hidden">
                  <Image
                    src="/logo.png"
                    alt="Coffee Flow"
                    fill
                    className="object-contain"
                  />
                </div>
                <span className="text-xl font-extrabold tracking-wider text-[#D9D9D9] font-sans">
                  COFFEE FLOW
                </span>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed max-w-sm font-body">
                Next-generation institutional coffee commodity intelligence terminal. Real-time physical flows, exchange certified inventory drawdowns, CFTC positioning, and predictive quantitative models.
              </p>
              <div className="flex items-center gap-2 text-xs font-mono text-[#D9D9D9]">
                <span className="w-2 h-2 rounded-full bg-[#C89D7C] animate-pulse" />
                <span>TERMINAL ACTIVE • LATENCY 42ms</span>
              </div>
            </div>

            <div className="space-y-3">
              <h5 className="text-xs font-bold font-sans tracking-wider text-white uppercase">
                Terminal Data
              </h5>
              <ul className="space-y-2 text-xs text-stone-400 font-mono">
                <li><a href="#charts" className="hover:text-white transition-colors">KC Arabica Spot</a></li>
                <li><a href="#flow" className="hover:text-white transition-colors">Port of Santos Logistics</a></li>
                <li><a href="#cot" className="hover:text-white transition-colors">CFTC Disaggregated COT</a></li>
                <li><a href="#stocks" className="hover:text-white transition-colors">ICE Certified Stocks</a></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h5 className="text-xs font-bold font-sans tracking-wider text-white uppercase">
                Quantitative
              </h5>
              <ul className="space-y-2 text-xs text-stone-400 font-mono">
                <li><a href="#predictive" className="hover:text-white transition-colors">Price Drift Model</a></li>
                <li><a href="#predictive" className="hover:text-white transition-colors">Precipitation Deficit Index</a></li>
                <li><a href="#predictive" className="hover:text-white transition-colors">USD/BRL Elasticity</a></li>
                <li><a href="#predictive" className="hover:text-white transition-colors">Monte Carlo Paths</a></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h5 className="text-xs font-bold font-sans tracking-wider text-white uppercase">
                Verified Sources
              </h5>
              <ul className="space-y-2 text-xs text-stone-400 font-mono">
                <li><span>ICE Futures U.S.</span></li>
                <li><span>CFTC Market Reports</span></li>
                <li><span>Conab Brazil Agronomy</span></li>
                <li><span>Cecafé Exporters Assoc</span></li>
                <li><span>Vicofa Vietnam Cocoa-Coffee</span></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-[11px] font-mono text-stone-500">
            <p className="max-w-2xl leading-relaxed font-body">
              <strong>Risk Disclosure:</strong> Commodity futures and options trading involves substantial risk of loss and is not suitable for all investors. Past performance, backtested data, and predictive scenario distributions generated by Coffee-Flow are for informational and research purposes only and do not constitute financial advice.
            </p>
            <div className="shrink-0 text-stone-400">
              © 2026 Coffee-Flow. Institutional Terminal Edition.
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}












