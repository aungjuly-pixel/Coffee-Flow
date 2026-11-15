import io
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
import urllib.parse
import urllib.request
import pandas as pd
import yfinance as yf

SNAPSHOT_PATH = Path(__file__).resolve().parent / "ticker_snapshot.json"

PORT_LABELS = {
    "ANT": "Antwerp Port (EU Warehouse)",
    "BAR": "Barcelona Port (Spain)",
    "HA/BR": "Hamburg / Bremen (DE)",
    "HOU": "Houston Terminal (US Gulf)",
    "MIAMI": "Miami Terminal (US South)",
    "NOLA": "New Orleans (US Gulf)",
    "NY": "New York (US Terminal)",
    "VA": "Norfolk / Virginia (US)",
}


def get_yahoo_quote(symbol: str, default_price: float, default_up: bool):
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="3mo", interval="1d")
        if hist.empty or "Close" not in hist:
            return default_price, 0.0, default_up, default_price, default_price

        closes = hist["Close"].dropna()
        if len(closes) == 0:
            return default_price, 0.0, default_up, default_price, default_price

        latest = float(closes.iloc[-1])
        prev = float(closes.iloc[-2]) if len(closes) > 1 else latest
        change_pct = ((latest - prev) / prev) * 100 if prev != 0 else 0.0
        is_up = latest >= prev

        sma20 = float(closes.tail(20).mean()) if len(closes) >= 20 else latest
        sma50 = float(closes.tail(50).mean()) if len(closes) >= 50 else latest

        return round(latest, 2), round(change_pct, 2), bool(is_up), round(sma20, 2), round(sma50, 2)
    except Exception as e:
        print(f"Warning: Failed to fetch {symbol}: {e}")
        return default_price, 0.0, default_up, default_price, default_price


def get_kc_chart_history():
    try:
        ticker = yf.Ticker("KC=F")
        hist = ticker.history(period="14mo", interval="1d")
        if hist.empty or "Close" not in hist:
            return []

        df = hist[["Close"]].dropna().copy()
        df["sma20"] = df["Close"].rolling(window=20, min_periods=1).mean()
        df["sma50"] = df["Close"].rolling(window=50, min_periods=1).mean()
        df = df.tail(252)

        series = []
        for idx, row in df.iterrows():
            series.append({
                "time": idx.strftime("%Y-%m-%d"),
                "close": round(float(row["Close"]), 2),
                "sma20": round(float(row["sma20"]), 2),
                "sma50": round(float(row["sma50"]), 2),
            })
        return series
    except Exception as e:
        print(f"Warning: Failed to build KC chart history: {e}")
        return []


def get_london_robusta(kc_price: float, kc_chg: float, kc_up: bool):
    url = "https://ca.investing.com/commodities/london-coffee"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
            match = re.search(r'instrument-price-last[^>]*>([\d,]+(?:\.\d+)?)<', html)
            if match:
                price_val = float(match.group(1).replace(",", ""))
                chg_match = re.search(r'instrument-price-change-percent[^>]*>\(([+\-]?\d+(?:\.\d+)?)%\)<', html)
                chg_val = float(chg_match.group(1)) if chg_match else 0.0
                return int(round(price_val)), round(chg_val, 2), bool(chg_val >= 0)
    except Exception:
        pass

    implied_rc = int(round(kc_price * 11.49))
    return implied_rc, kc_chg, kc_up


def parse_ice_xls_bytes(xls_bytes: bytes) -> dict | None:
    try:
        df = pd.read_excel(io.BytesIO(xls_bytes), sheet_name=0, header=None, engine="xlrd")
        col_map = {}
        for r_idx in range(min(25, len(df))):
            row_vals = [str(v).strip().upper() if pd.notna(v) else "" for v in df.iloc[r_idx].tolist()]
            if "ANT" in row_vals and "TOTAL" in row_vals:
                for c_idx, val in enumerate(row_vals):
                    if val in {"ANT", "BAR", "HA/BR", "HOU", "MIAMI", "NOLA", "NY", "VA", "TOTAL"}:
                        col_map[val] = c_idx
                for sub_r in range(r_idx + 1, min(r_idx + 35, len(df))):
                    first_cell = str(df.iloc[sub_r, 0]).strip().lower() if pd.notna(df.iloc[sub_r, 0]) else ""
                    if "total in bags" in first_cell:
                        def get_int(key: str) -> int:
                            idx = col_map.get(key)
                            if idx is None:
                                return 0
                            raw_v = df.iloc[sub_r, idx]
                            if pd.isna(raw_v):
                                return 0
                            return int(round(float(str(raw_v).replace(",", ""))))

                        ports = {code: get_int(code) for code in PORT_LABELS.keys()}
                        total = get_int("TOTAL")
                        if total > 0:
                            return {"ports": ports, "total": total}
                break
    except Exception as e:
        print(f"Warning: Failed parsing ICE .xls bytes: {e}")
    return None


def format_delta_label(curr_bags: int, prev_bags: int) -> str:
    if prev_bags <= 0 or curr_bags == prev_bags:
        return "Unchanged"
    pct = ((curr_bags - prev_bags) / prev_bags) * 100
    if abs(pct) < 0.05:
        return "Unchanged"
    sign = "+" if pct > 0 else ""
    return f"{sign}{pct:.1f}%"


def get_ice_certified_stocks(old_breakdown: dict | None):
    found_reports = []
    now_utc = datetime.now(timezone.utc)

    for days_back in range(0, 10):
        dt_str = (now_utc - timedelta(days=days_back)).strftime("%Y%m%d")
        url = f"https://www.ice.com/publicdocs/futures_us_reports/coffee/coffee_cert_stock_{dt_str}.xls"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                raw_bytes = resp.read()
                parsed = parse_ice_xls_bytes(raw_bytes)
                if parsed:
                    parsed["report_date"] = f"{dt_str[:4]}-{dt_str[4:6]}-{dt_str[6:8]}"
                    found_reports.append(parsed)
                    if len(found_reports) >= 2:
                        break
        except Exception:
            continue

    if found_reports:
        latest = found_reports[0]
        prev = found_reports[1] if len(found_reports) > 1 else latest
        total_bags = latest["total"]
        is_up = total_bags > prev["total"]
        report_date = latest["report_date"]

        # Sort all 8 ports descending by current bag count and take Top 5
        ranked_codes = sorted(
            latest["ports"].keys(),
            key=lambda code: latest["ports"][code],
            reverse=True,
        )

        top_ports = []
        for code in ranked_codes:
            bags = latest["ports"][code]
            prev_bags = prev["ports"].get(code, bags)
            share_pct = max(3, min(95, round((bags / total_bags) * 100))) if total_bags else 5
            top_ports.append({
                "code": code,
                "label": PORT_LABELS.get(code, code),
                "bags": bags,
                "delta": format_delta_label(bags, prev_bags),
                "share_pct": share_pct,
            })
    else:
        total_bags = old_breakdown.get("total_bags", 211321) if old_breakdown else 211321
        is_up = old_breakdown.get("is_up", False) if old_breakdown else False
        report_date = old_breakdown.get("report_date", "") if old_breakdown else ""
        top_ports = old_breakdown.get("top_ports", []) if old_breakdown else []

    short_label = f"{round(total_bags / 1000)}k"

    return {
        "short_label": short_label,
        "is_up": bool(is_up),
        "status_badge": "ACCUMULATION" if is_up else "DRAWDOWN",
        "report_date": report_date,
        "total_bags": total_bags,
        "top_ports": top_ports,
    }


def calc_percentile_rank(values: list[int], current: int) -> int:
    if not values:
        return 50
    if len(values) == 1:
        return 50
    min_v = min(values)
    max_v = max(values)
    if max_v == min_v:
        return 50
    pct = round(((current - min_v) / (max_v - min_v)) * 100)
    return max(0, min(100, pct))


def get_cftc_cot_data(old_cot: list | None, old_summary: dict | None, chart_history: list | None = None):
    """
    Fetches the latest 52 weekly Disaggregated Futures & Options Combined COT reports
    for Coffee C - ICE Futures U.S. (083731) from CFTC Socrata API (kh3c-gbw2.json).
    Returns:
      - cot_history: last 26 weeks for the chart
      - cot_summary: latest week's Net, Gross Long, Gross Short, and 52W Net Percentile
    """
    price_by_date = {}
    if chart_history:
        for pt in chart_history:
            price_by_date[pt["time"]] = float(pt["close"])

    def lookup_spot_for_date(date_str: str) -> float:
        if not price_by_date:
            return 287.15
        if date_str in price_by_date:
            return price_by_date[date_str]
        prior_dates = [d for d in price_by_date.keys() if d <= date_str]
        if prior_dates:
            return price_by_date[max(prior_dates)]
        return list(price_by_date.values())[-1]

    try:
        params = urllib.parse.urlencode({
            "$where": "cftc_contract_market_code='083731'",
            "$order": "report_date_as_yyyy_mm_dd DESC",
            "$limit": "52",
        })
        url = f"https://publicreporting.cftc.gov/resource/kh3c-gbw2.json?{params}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=12) as resp:
            rows = json.loads(resp.read().decode("utf-8"))

        if not rows:
            return (old_cot or []), (old_summary or {})

        rows.reverse()
        full_series = []
        for r in rows:
            raw_dt = str(r.get("report_date_as_yyyy_mm_dd", ""))[:10]
            if not raw_dt:
                continue

            def to_int(key: str) -> int:
                val = r.get(key)
                if val is None or val == "":
                    return 0
                return int(round(float(val)))

            comm_long = to_int("prod_merc_positions_long")
            comm_short = to_int("prod_merc_positions_short")
            mm_long = to_int("m_money_positions_long_all")
            mm_short = to_int("m_money_positions_short_all")
            nonrept_long = to_int("nonrept_positions_long_all")
            nonrept_short = to_int("nonrept_positions_short_all")
            oi = to_int("open_interest_all")

            full_series.append({
                "date": raw_dt,
                "spot": round(lookup_spot_for_date(raw_dt), 2),
                "commercial_long": comm_long,
                "commercial_short": comm_short,
                "commercial_net": comm_long - comm_short,
                "managed_money_long": mm_long,
                "managed_money_short": mm_short,
                "managed_money_net": mm_long - mm_short,
                "small_spec_long": nonrept_long,
                "small_spec_short": nonrept_short,
                "small_spec_net": nonrept_long - nonrept_short,
                "open_interest": oi,
            })

        if not full_series:
            return (old_cot or []), (old_summary or {})

        latest = full_series[-1]
        comm_nets = [x["commercial_net"] for x in full_series]
        mm_nets = [x["managed_money_net"] for x in full_series]
        small_nets = [x["small_spec_net"] for x in full_series]

        cot_summary = {
            "report_date": latest["date"],
            "commercial": {
                "net": latest["commercial_net"],
                "gross_long": latest["commercial_long"],
                "gross_short": latest["commercial_short"],
                "percentile_52w": calc_percentile_rank(comm_nets, latest["commercial_net"]),
            },
            "large_spec": {
                "net": latest["managed_money_net"],
                "gross_long": latest["managed_money_long"],
                "gross_short": latest["managed_money_short"],
                "percentile_52w": calc_percentile_rank(mm_nets, latest["managed_money_net"]),
            },
            "small_spec": {
                "net": latest["small_spec_net"],
                "gross_long": latest["small_spec_long"],
                "gross_short": latest["small_spec_short"],
                "percentile_52w": calc_percentile_rank(small_nets, latest["small_spec_net"]),
            },
        }

        chart_26w = [
            {
                "date": x["date"],
                "spot": x["spot"],
                "commercial_net": x["commercial_net"],
                "managed_money_net": x["managed_money_net"],
                "small_spec_net": x["small_spec_net"],
                "open_interest": x["open_interest"],
            }
            for x in full_series
        ]

        return chart_26w, cot_summary
    except Exception as e:
        print(f"Warning: Failed fetching CFTC COT data: {e}")
        return (old_cot or []), (old_summary or {})


def main():
    print("Fetching live market data, chart history, All 8 ICE Certified Ports, and CFTC COT...")

    old_data = {}
    if SNAPSHOT_PATH.exists():
        try:
            old_data = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
        except Exception:
            old_data = {}

    chart_history = get_kc_chart_history()
    if chart_history:
        latest_pt = chart_history[-1]
        prev_pt = chart_history[-2] if len(chart_history) > 1 else latest_pt
        kc_price = latest_pt["close"]
        kc_chg = round(((kc_price - prev_pt["close"]) / prev_pt["close"]) * 100, 2) if prev_pt["close"] else 0.0
        kc_up = bool(kc_price >= prev_pt["close"])
        sma20 = latest_pt["sma20"]
        sma50 = latest_pt["sma50"]
    else:
        kc_price, kc_chg, kc_up, sma20, sma50 = get_yahoo_quote("KC=F", 278.65, False)

    rc_price, rc_chg, rc_up = get_london_robusta(kc_price, kc_chg, kc_up)
    brl_price, brl_chg, brl_up, _, _ = get_yahoo_quote("BRL=X", 5.64, True)
    ice_data = get_ice_certified_stocks(old_data.get("ice_stocks_detail"))
    cot_history, cot_summary = get_cftc_cot_data(old_data.get("cot_history"), old_data.get("cot_summary"), chart_history)

    snapshot = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "arabica_spot_cents_lb": kc_price,
        "arabica_change_pct": kc_chg,
        "arabica_up": kc_up,
        "sma20": sma20,
        "sma50": sma50,
        "robusta_price_mt": rc_price,
        "robusta_change_pct": rc_chg,
        "robusta_up": rc_up,
        "ice_stocks": ice_data["short_label"],
        "ice_stocks_up": ice_data["is_up"],
        "ice_stocks_detail": ice_data,
        "usd_brl": brl_price,
        "usd_brl_change_pct": brl_chg,
        "usd_brl_up": brl_up,
        "market_status": "ACTIVE",
        "benchmark": "ICE KC=F / RC",
        "chart_history": chart_history,
        "cot_history": cot_history,
        "cot_summary": cot_summary,
    }

    SNAPSHOT_PATH.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
    top_summary = ", ".join([f"{p['code']}:{p['bags']:,}" for p in ice_data["top_ports"]])
    print(f"Updated {SNAPSHOT_PATH} | Total={ice_data['total_bags']:,} | All 8: {top_summary}")


if __name__ == "__main__":
    main()



