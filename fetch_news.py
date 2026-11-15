import json
import re
import html
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

NEWS_SNAPSHOT_PATH = Path(__file__).resolve().parent / "news_snapshot.json"
DEFAULT_IMAGE = "/coffee_hero2.jpg"

SOURCES = [
    {
        "name": "Daily Coffee News",
        "region": "Global Trade",
        "category": "Market Wire",
        "url": "https://dailycoffeenews.com/feed/",
    },
    {
        "name": "Perfect Daily Grind",
        "region": "Origin & Supply",
        "category": "Origin Intel",
        "url": "https://perfectdailygrind.com/feed/",
    },
    {
        "name": "Global Coffee Report",
        "region": "Commercial & Futures",
        "category": "Industry",
        "url": "https://www.gcrmag.com/feed/",
    },
]


def clean_html(raw_html: str) -> str:
    if not raw_html:
        return ""
    text = re.sub(r"<[^>]+>", " ", raw_html)
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def format_relative_time(pub_date_str: str) -> str:
    if not pub_date_str:
        return "Recent"
    try:
        dt = parsedate_to_datetime(pub_date_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        diff = now - dt
        hours = int(diff.total_seconds() // 3600)
        if hours < 1:
            return "Just now"
        if hours < 24:
            return f"{hours}h ago"
        days = hours // 24
        return f"{days}d ago"
    except Exception:
        return "Recent"


def extract_image_url(item: ET.Element, raw_content: str) -> str:
    # 1. Check media:content or media:thumbnail
    for elem in item.iter():
        tag = elem.tag.lower()
        if tag.endswith("content") or tag.endswith("thumbnail"):
            url = elem.attrib.get("url", "")
            if url and any(ext in url.lower() for ext in [".jpg", ".jpeg", ".png", ".webp"]):
                return url

    # 2. Check <enclosure url="..." type="image/...">
    enclosure = item.find("enclosure")
    if enclosure is not None:
        enc_type = enclosure.attrib.get("type", "")
        enc_url = enclosure.attrib.get("url", "")
        if "image" in enc_type and enc_url:
            return enc_url

    # 3. Search <img src="..."> inside description or content:encoded
    img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', raw_content, re.IGNORECASE)
    if img_match:
        src = img_match.group(1)
        if src.startswith("http") and "pixel" not in src.lower() and "emoji" not in src.lower():
            return src

    return DEFAULT_IMAGE


def fetch_feed_items(source: dict, limit: int = 3) -> list:
    req = urllib.request.Request(
        source["url"],
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        },
    )
    items_out = []
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            xml_bytes = resp.read()
        root = ET.fromstring(xml_bytes)

        for item in root.findall(".//item")[:limit]:
            title = clean_html(item.findtext("title", default=""))
            link = item.findtext("link", default="#").strip()
            pub_date = item.findtext("pubDate", default="")
            desc_raw = item.findtext("description", default="")

            # Check content:encoded for richer HTML/images
            content_raw = desc_raw
            for child in item:
                if child.tag.lower().endswith("encoded") and child.text:
                    content_raw = child.text
                    break

            summary = clean_html(desc_raw)
            if len(summary) > 155:
                summary = summary[:152].rsplit(" ", 1)[0] + "..."

            image_url = extract_image_url(item, content_raw)

            if title:
                items_out.append({
                    "title": title,
                    "summary": summary,
                    "url": link,
                    "image": image_url,
                    "source": source["name"],
                    "region": source["region"],
                    "category": source["category"],
                    "timeAgo": format_relative_time(pub_date),
                })
    except Exception as e:
        print(f"Warning: Could not fetch {source['name']}: {e}")

    return items_out


def main():
    print("Fetching live coffee news from 3 sources...")
    source_buckets = [fetch_feed_items(src, limit=3) for src in SOURCES]

    # Round-robin across the 3 sources so we get balanced coverage (total 5 articles)
    combined = []
    for round_idx in range(3):
        for bucket in source_buckets:
            if round_idx < len(bucket) and len(combined) < 5:
                combined.append(bucket[round_idx])

    # Fallback defaults if offline
    if not combined:
        combined = [
            {
                "title": "Conab revises post-flowering berry set projections downward across Cerrado Mineiro.",
                "summary": "Sub-average precipitation throughout critical development windows has sparked commercial forward-contract pauses.",
                "url": "#news",
                "image": DEFAULT_IMAGE,
                "source": "Conab Dispatch",
                "region": "Minas Gerais",
                "category": "Agronomy",
                "timeAgo": "3h ago",
            }
        ]

    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "count": len(combined),
        "articles": combined,
    }

    NEWS_SNAPSHOT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Successfully saved {len(combined)} articles to {NEWS_SNAPSHOT_PATH}:")
    for idx, art in enumerate(combined, 1):
        print(f"  {idx}. [{art['source']}] {art['title']} -> Image: {art['image']}")


if __name__ == "__main__":
    main()
