import warnings
warnings.simplefilter(action='ignore', category=FutureWarning)

import yfinance as yf
import pandas as pd
from datetime import datetime
import json

def pull_coffee_tape():
    print("Fetching coffee market tape and FX rates...")

    # Primary tickers: KC=F (ICE Arabica), BRL=X (USD/BRL)
    tickers = ["KC=F", "BRL=X"]
    
    # Download close data
    raw = yf.download(tickers, period="1y", interval="1d", progress=False)
    
    if 'Close' in raw.columns:
        data = raw['Close']
    else:
        data = raw

    # Reset index and clean column names
    df = data.reset_index()
    
    # Standardize names
    df = df.rename(columns={
        "Date": "date",
        "KC=F": "arabica_cents_lb",
        "BRL=X": "usd_brl"
    })
    
    # Drop rows where Arabica price is missing
    df = df.dropna(subset=['arabica_cents_lb'])

    if df.empty:
        print("Error: No market data retrieved.")
        return None

    # Calculate 20-day and 50-day Simple Moving Averages for Arabica
    df['arabica_sma20'] = df['arabica_cents_lb'].rolling(window=20).mean().round(2)
    df['arabica_sma50'] = df['arabica_cents_lb'].rolling(window=50).mean().round(2)

    # 1. Save historical CSV
    df.to_csv("daily_coffee_market.csv", index=False)

    # 2. Extract snapshot metrics
    latest = df.iloc[-1]
    prev = df.iloc[-2]

    arabica_spot = round(float(latest['arabica_cents_lb']), 2)
    prev_spot = round(float(prev['arabica_cents_lb']), 2)
    change_pct = round(((arabica_spot - prev_spot) / prev_spot) * 100, 2)
    
    usd_brl = round(float(latest['usd_brl']), 4) if pd.notnull(latest.get('usd_brl')) else None

    snapshot = {
        "timestamp": datetime.utcnow().isoformat(),
        "arabica_spot_cents_lb": arabica_spot,
        "arabica_change_pct": change_pct,
        "usd_brl": usd_brl,
        "market_status": "OPEN",
        "benchmark": "ICE Arabica (KC)"
    }

    # Save lightweight JSON for UI ticker
    with open("ticker_snapshot.json", "w") as f:
        json.dump(snapshot, f, indent=2)

    print("\n--- Market Pulse Snapshot ---")
    print(json.dumps(snapshot, indent=2))
    print("\nSuccessfully updated 'daily_coffee_market.csv' and 'ticker_snapshot.json'.")
    return snapshot

if __name__ == "__main__":
    pull_coffee_tape()