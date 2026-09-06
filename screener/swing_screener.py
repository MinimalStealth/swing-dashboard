"""
Swing Trading Screener v4 — Sean Trades momentum swing strategy, automated.

Designed to run unattended as a Claude Cowork scheduled task (or cron job).

What it does, mirroring the strategy's top-down checklist:
  0. MARKET REGIME  — Are SPY and QQQ above rising, stacked 8/21/50 EMAs?
                      (Stage 2 "Advancing" = favorable; otherwise flagged.)
  1. LIVE SCREEN    — TradingView's live US-market scanner, filtered to:
                      price > $3, mkt cap > $300M, price > EMA21 & EMA50,
                      relative volume > 1, avg volume > 500K, ADR% > 2%.
                      Common stocks on NASDAQ/NYSE/AMEX only (no ETFs/OTC).
  2. THEME STRENGTH — Which sectors/industries the survivors cluster in
                      (where money is already flowing).
  3. SETUP & PLAN   — Per survivor: 8 EMA trend check, tightness
                      (volatility contraction), setup status (breaking out /
                      setting up / trending / extended), a trade plan (entry
                      trigger, stop, risk %, 3x-ATR extension trim level),
                      and an earnings-within-7-days risk flag.
  4. RANK           — Percentile-based composite score (0-100) across
                      momentum, tightness, proximity to highs, relative
                      volume and theme strength. Two output sections:
                      Top 3 overall, Top 3 mid-cap ($2B-$10B).

Requires (see requirements.txt): tradingview_screener, yfinance, pandas, numpy

Usage:
  python3 swing_screener_v4.py                 # defaults
  python3 swing_screener_v4.py --top 5         # more picks per section
  python3 swing_screener_v4.py --no-yfinance   # TradingView-only (faster,
                                               # skips exact pivot/stop levels)
  python3 swing_screener_v4.py --publish URL   # also POST results to the
                                               # dashboard's /api/ingest
                                               # (needs $SCREENER_INGEST_SECRET;
                                               # URL defaults to
                                               # $SCREENER_INGEST_URL)

Outputs (in the working directory):
  screener_report.md      — the markdown report (this is what to send back)
  screener_results.json   — full structured results
  screener_all_ranked.csv — every survivor with all metrics

Caveats: tradingview_screener and yfinance are unofficial wrappers around
public endpoints and can break without notice. This script judges only
quantifiable criteria — it cannot assess chart-pattern quality, news, or
catalysts. It is a research tool, not financial advice.
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

import numpy as np
import pandas as pd

log = logging.getLogger("screener")

# ----------------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------------
MIN_PRICE = 3.0
MIN_MARKET_CAP = 300_000_000
MIN_AVG_VOLUME = 500_000
MIN_REL_VOLUME = 1.0
MIN_ADR_PCT = 2.0
MIDCAP_MIN, MIDCAP_MAX = 2_000_000_000, 10_000_000_000
LARGECAP_MIN = 10_000_000_000
ALLOWED_EXCHANGES = {"NASDAQ", "NYSE", "AMEX"}
ALLOWED_SUBTYPES = {"common", "foreign-issuer"}
EARNINGS_WARN_DAYS = 7
EMA_FAST, EMA_MID, EMA_SLOW = 8, 21, 50
ATR_EXTENSION_MULT = 3.0        # "3x ATR extension from the 8 EMA" trim rule
BREAKOUT_REL_VOL = 1.5          # volume confirmation for a breakout label
TIGHT_RATIO = 0.80              # weekly range < 80% of monthly range = "tight"

SCORE_WEIGHTS = {               # percentile-rank weights, sum to 1.0
    "momentum": 0.35,           # blend of 1M and 3M performance
    "tightness": 0.20,          # lower weekly/monthly volatility ratio is better
    "proximity": 0.20,          # closer to 52-week high is better
    "rel_volume": 0.10,
    "theme": 0.15,              # sector strength among survivors
}


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def retry(fn, attempts=3, base_delay=2.0, what="call"):
    """Run fn() with simple exponential backoff. Returns None on final failure."""
    for i in range(1, attempts + 1):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001
            if i == attempts:
                log.warning("%s failed after %d attempts: %s", what, attempts, e)
                return None
            delay = base_delay * (2 ** (i - 1))
            log.info("%s failed (%s); retrying in %.0fs", what, e, delay)
            time.sleep(delay)


def fmt_cap(mc: float) -> str:
    return f"${mc / 1e9:.1f}B" if mc >= 1e9 else f"${mc / 1e6:.0f}M"


def pct_rank(series: pd.Series, higher_is_better=True) -> pd.Series:
    s = series.astype(float)
    r = s.rank(pct=True, method="average")
    return r if higher_is_better else 1 - r + (1 / max(len(s), 1))


def ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


# ----------------------------------------------------------------------------
# Stage 0 — market regime
# ----------------------------------------------------------------------------
def market_regime(use_yfinance=True) -> dict:
    """Classify SPY/QQQ by the 8/21/50 EMA structure the strategy trades on."""
    out = {}
    symbols = {"SPY": "SPY", "QQQ": "QQQ"}

    def classify(price, e8, e21, e50, e21_rising):
        if price > e8 > e21 > e50 and e21_rising:
            return "FAVORABLE (Stage 2 advance: price above rising, stacked 8/21/50 EMAs)"
        if price > e50:
            return "MIXED (above 50 EMA but not cleanly stacked — choppy; size down)"
        return "UNFAVORABLE (below 50 EMA — strategy says sit in cash / play quick shorts only)"

    if use_yfinance:
        import yfinance as yf
        for name, sym in symbols.items():
            hist = retry(lambda: yf.Ticker(sym).history(period="6mo", interval="1d", auto_adjust=True),
                         what=f"yfinance {sym}")
            if hist is None or len(hist) < 60:
                continue
            c = hist["Close"]
            e8, e21, e50 = ema(c, EMA_FAST), ema(c, EMA_MID), ema(c, EMA_SLOW)
            out[name] = {
                "price": round(float(c.iloc[-1]), 2),
                "ema8": round(float(e8.iloc[-1]), 2),
                "ema21": round(float(e21.iloc[-1]), 2),
                "ema50": round(float(e50.iloc[-1]), 2),
                "status": classify(c.iloc[-1], e8.iloc[-1], e21.iloc[-1], e50.iloc[-1],
                                   e21.iloc[-1] > e21.iloc[-6]),
            }

    if not out:  # fallback: TradingView fields (EMA10 stands in for EMA8)
        from tradingview_screener import Query
        q = Query().select("name", "close", "EMA10", "EMA21", "EMA50") \
            .set_tickers("AMEX:SPY", "NASDAQ:QQQ")
        # set_tickers() alone still inherits the default stock/dr/fund(non-etf)
        # filter2, which excludes ETFs like SPY/QQQ entirely — clear it so the
        # explicit ticker list is all that's applied.
        q.query["filter"] = []
        q.query.pop("filter2", None)
        _, df = q.get_scanner_data()
        for _, r in df.iterrows():
            out[r["name"]] = {
                "price": round(float(r["close"]), 2),
                "ema8": round(float(r["EMA10"]), 2),
                "ema21": round(float(r["EMA21"]), 2),
                "ema50": round(float(r["EMA50"]), 2),
                "status": classify(r["close"], r["EMA10"], r["EMA21"], r["EMA50"], True),
            }

    favorable = sum(1 for v in out.values() if v["status"].startswith("FAVORABLE"))
    out["_overall"] = ("FAVORABLE" if favorable == len(out) and out else
                       "UNFAVORABLE" if favorable == 0 else "MIXED")
    return out


# ----------------------------------------------------------------------------
# Stage 1 — live screen
# ----------------------------------------------------------------------------
def live_screen(limit: int) -> pd.DataFrame:
    from tradingview_screener import Query, Column as col

    q = (
        Query()
        .select(
            "name", "close", "volume", "relative_volume_10d_calc", "average_volume_10d_calc",
            "market_cap_basic", "EMA10", "EMA21", "EMA50", "ATR",
            "Perf.W", "Perf.1M", "Perf.3M", "price_52_week_high", "High.1M",
            "Volatility.W", "Volatility.M", "sector", "industry",
            "type", "subtype", "exchange", "earnings_release_next_date",
        )
        .where(
            col("close") > MIN_PRICE,
            col("market_cap_basic") > MIN_MARKET_CAP,
            col("close") > col("EMA21"),
            col("close") > col("EMA50"),
            col("relative_volume_10d_calc") > MIN_REL_VOLUME,
            col("average_volume_10d_calc") > MIN_AVG_VOLUME,
            col("type") == "stock",
        )
        .set_markets("america")
        .order_by("volume", ascending=False)
        .limit(limit)
    )
    res = retry(lambda: q.get_scanner_data(), what="TradingView scan")
    if res is None:
        raise SystemExit("TradingView scan failed after retries — aborting.")
    total, df = res

    df = df[df["subtype"].isin(ALLOWED_SUBTYPES) & df["exchange"].isin(ALLOWED_EXCHANGES)].copy()
    df["adr_pct"] = df["ATR"] / df["close"] * 100
    df = df[df["adr_pct"] > MIN_ADR_PCT].copy()
    df["symbol"] = df["ticker"].str.split(":").str[1]
    df["tightness_ratio"] = df["Volatility.W"] / df["Volatility.M"].replace(0, np.nan)
    df["dist_from_52w_high_pct"] = (df["price_52_week_high"] - df["close"]) / df["price_52_week_high"] * 100

    now = datetime.now(timezone.utc).timestamp()
    df["days_to_earnings"] = ((df["earnings_release_next_date"] - now) / 86400).round()

    log.info("Live scan: %d raw matches -> %d common stocks on NASDAQ/NYSE/AMEX with ADR%% > %.0f",
             total, len(df), MIN_ADR_PCT)
    return df.reset_index(drop=True)


# ----------------------------------------------------------------------------
# Stage 2 — theme strength
# ----------------------------------------------------------------------------
def theme_strength(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    sectors = (df.groupby("sector")
                 .agg(count=("symbol", "size"), avg_perf_1m=("Perf.1M", "mean"), avg_perf_w=("Perf.W", "mean"))
                 .sort_values("count", ascending=False))
    industries = (df.groupby("industry")
                    .agg(count=("symbol", "size"), avg_perf_1m=("Perf.1M", "mean"))
                    .sort_values("count", ascending=False))
    return sectors, industries


# ----------------------------------------------------------------------------
# Stage 3 — per-ticker setup + trade plan (yfinance enrichment, optional)
# ----------------------------------------------------------------------------
def enrich_one(row: dict) -> dict:
    """Pull daily bars for exact EMA8 / pivot / stop / ATR levels."""
    import yfinance as yf
    sym = row["symbol"]
    hist = retry(lambda: yf.Ticker(sym).history(period="6mo", interval="1d", auto_adjust=True),
                 attempts=2, base_delay=1.0, what=f"yfinance {sym}")
    if hist is None or len(hist) < 30:
        return {}
    c, h, l = hist["Close"], hist["High"], hist["Low"]
    e8 = ema(c, EMA_FAST)
    tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
    atr14 = tr.rolling(14).mean().iloc[-1]
    pivot = float(h.iloc[-21:-1].max())          # 20-day high, excluding today
    vol_dryup = float(hist["Volume"].tail(5).mean() / hist["Volume"].tail(50).mean())
    return {
        "ema8": float(e8.iloc[-1]),
        "above_ema8": bool(c.iloc[-1] > e8.iloc[-1]),
        "pivot": pivot,
        "low_of_day": float(l.iloc[-1]),
        "atr14": float(atr14),
        "vol_dryup_ratio": vol_dryup,           # <1 = quieter volume during consolidation
        "source": "yfinance",
    }


def fallback_levels(row: dict) -> dict:
    """TradingView-only approximation when yfinance is off or fails."""
    return {
        "ema8": float(row["EMA10"]),           # nearest available EMA
        "above_ema8": bool(row["close"] > row["EMA10"]),
        "pivot": float(row["High.1M"]),
        "low_of_day": float(row["close"] - row["ATR"]),  # approximation: 1 ATR below close
        "atr14": float(row["ATR"]),
        "vol_dryup_ratio": None,
        "source": "tradingview-approx",
    }


def classify_setup(price, pivot, ema8, atr, rel_vol, tightness):
    extension_level = ema8 + ATR_EXTENSION_MULT * atr
    if price >= extension_level:
        return "EXTENDED", extension_level
    if price > pivot and rel_vol >= BREAKOUT_REL_VOL:
        return "BREAKING OUT", extension_level
    if tightness <= TIGHT_RATIO and price >= pivot * 0.92:
        return "TIGHT / SETTING UP", extension_level
    return "TRENDING", extension_level


def build_plan(price, pivot, low_of_day, ema8, atr, setup):
    entry = price if setup == "BREAKING OUT" else max(pivot, price)   # buy the break, not below it
    stop = low_of_day
    risk_pct = (entry - stop) / entry * 100 if entry > stop else float("nan")
    ext_trim = ema8 + ATR_EXTENSION_MULT * atr
    return {
        "entry_trigger": round(entry, 2),
        "stop": round(stop, 2),
        "risk_pct": round(risk_pct, 1),
        "extension_trim_level": round(ext_trim, 2),
    }


# ----------------------------------------------------------------------------
# Stage 4 — score & rank
# ----------------------------------------------------------------------------
def rank(df: pd.DataFrame, sectors: pd.DataFrame, use_yfinance: bool, workers: int) -> list[dict]:
    rows = df.to_dict("records")
    levels: dict[str, dict] = {}

    if use_yfinance:
        with ThreadPoolExecutor(max_workers=workers) as ex:
            futs = {ex.submit(enrich_one, r): r["symbol"] for r in rows}
            for f in as_completed(futs):
                levels[futs[f]] = f.result() or {}

    top_sectors = set(sectors.head(3).index)
    records = []
    for r in rows:
        lv = levels.get(r["symbol"]) or fallback_levels(r)
        if not lv["above_ema8"]:
            continue
        setup, _ = classify_setup(r["close"], lv["pivot"], lv["ema8"], lv["atr14"],
                                  r["relative_volume_10d_calc"], r["tightness_ratio"])
        plan = build_plan(r["close"], lv["pivot"], lv["low_of_day"], lv["ema8"], lv["atr14"], setup)
        dte = r["days_to_earnings"]
        records.append({
            "ticker": r["symbol"],
            "sector": r["sector"],
            "industry": r["industry"],
            "price": round(float(r["close"]), 2),
            "market_cap": float(r["market_cap_basic"]),
            "perf_w_pct": round(float(r["Perf.W"]), 1),
            "perf_1m_pct": round(float(r["Perf.1M"]), 1),
            "perf_3m_pct": round(float(r["Perf.3M"]), 1),
            "rel_volume": round(float(r["relative_volume_10d_calc"]), 2),
            "adr_pct": round(float(r["adr_pct"]), 2),
            "tightness_ratio": round(float(r["tightness_ratio"]), 2) if pd.notna(r["tightness_ratio"]) else None,
            "dist_from_52w_high_pct": round(float(r["dist_from_52w_high_pct"]), 1),
            "vol_dryup_ratio": round(lv["vol_dryup_ratio"], 2) if lv.get("vol_dryup_ratio") else None,
            "in_leading_sector": r["sector"] in top_sectors,
            "setup": setup,
            "days_to_earnings": int(dte) if pd.notna(dte) else None,
            "earnings_risk": bool(pd.notna(dte) and 0 <= dte <= EARNINGS_WARN_DAYS),
            "levels_source": lv["source"],
            **plan,
        })

    if not records:
        return []

    sdf = pd.DataFrame(records)
    momentum = (sdf["perf_1m_pct"].clip(upper=150) * 0.6 + sdf["perf_3m_pct"].clip(upper=300) * 0.4)
    comp = (
        pct_rank(momentum) * SCORE_WEIGHTS["momentum"]
        + pct_rank(sdf["tightness_ratio"].fillna(1.0), higher_is_better=False) * SCORE_WEIGHTS["tightness"]
        + pct_rank(sdf["dist_from_52w_high_pct"], higher_is_better=False) * SCORE_WEIGHTS["proximity"]
        + pct_rank(sdf["rel_volume"]) * SCORE_WEIGHTS["rel_volume"]
        + sdf["in_leading_sector"].astype(float) * SCORE_WEIGHTS["theme"]
    )
    sdf["score"] = (comp * 100).round(1)
    # Don't let "extended" names (past the 3x ATR trim zone) top the list — the
    # strategy trims there, it doesn't initiate there.
    sdf.loc[sdf["setup"] == "EXTENDED", "score"] -= 15
    sdf = sdf.sort_values("score", ascending=False)
    return sdf.to_dict("records")


# ----------------------------------------------------------------------------
# Report
# ----------------------------------------------------------------------------
def picks_table(picks: list[dict]) -> list[str]:
    head = ("| Ticker | Sector | Setup | Price | Mkt Cap | 1M | 3M | Rel Vol | ADR% | Tight | From 52wk High "
            "| Entry | Stop | Risk % | 3x ATR Trim | Earnings | Score |")
    sep = "|" + "---|" * 17
    lines = [head, sep]
    for m in picks:
        earn = f"⚠ {m['days_to_earnings']}d" if m["earnings_risk"] else (
            f"{m['days_to_earnings']}d" if m["days_to_earnings"] is not None else "—")
        lines.append(
            f"| **{m['ticker']}** | {m['sector']} | {m['setup']} | ${m['price']} | {fmt_cap(m['market_cap'])} "
            f"| {m['perf_1m_pct']}% | {m['perf_3m_pct']}% | {m['rel_volume']}x | {m['adr_pct']}% "
            f"| {m['tightness_ratio']} | {m['dist_from_52w_high_pct']}% "
            f"| ${m['entry_trigger']} | ${m['stop']} | {m['risk_pct']}% | ${m['extension_trim_level']} "
            f"| {earn} | {m['score']} |"
        )
    return lines


def write_report(regime, sectors, industries, ranked, screened_n, top_n) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    top_all = ranked[:top_n]
    mids = [m for m in ranked if MIDCAP_MIN <= m["market_cap"] <= MIDCAP_MAX]
    top_mid = mids[:top_n]
    larges = [m for m in ranked if m["market_cap"] >= LARGECAP_MIN]
    top_large = larges[:top_n]

    L = [f"# Swing Screener — {ts}", ""]

    L += ["## 1. Market Regime (Stage 1 of the strategy: is the environment favorable?)", ""]
    for k, v in regime.items():
        if k.startswith("_"):
            continue
        L.append(f"- **{k}** ${v['price']} — 8 EMA {v['ema8']} / 21 EMA {v['ema21']} / 50 EMA {v['ema50']} → {v['status']}")
    L += ["", f"**Overall: {regime['_overall']}.** "
          + ("Breakouts have the tailwind the strategy wants." if regime["_overall"] == "FAVORABLE"
             else "The strategy's own rule is to be selective or sit in cash here — treat picks below as a watchlist, not a buy list."), ""]

    L += ["## 2. Where Money Is Flowing (theme strength among survivors)", "",
          "| Sector | # Survivors | Avg 1M Perf | Avg 1W Perf |", "|---|---|---|---|"]
    for sec, r in sectors.head(5).iterrows():
        L.append(f"| {sec} | {int(r['count'])} | {r['avg_perf_1m']:.1f}% | {r['avg_perf_w']:.1f}% |")
    L += ["", "Top industries: " + ", ".join(f"{i} ({int(r['count'])})" for i, r in industries.head(6).iterrows()), ""]

    L += [f"## 3. Top {top_n} Picks (All Market Caps)", ""]
    L += picks_table(top_all) if top_all else ["No candidates cleared the filters today."]
    L += ["", f"## 4. Top {top_n} Mid-Cap Picks (${MIDCAP_MIN/1e9:.0f}B–${MIDCAP_MAX/1e9:.0f}B)", ""]
    L += picks_table(top_mid) if top_mid else ["No mid-cap candidates cleared the filters today."]

    L += ["", f"## 5. Top {top_n} Large-Cap Picks (${LARGECAP_MIN/1e9:.0f}B+)", ""]
    L += picks_table(top_large) if top_large else ["No large-cap candidates cleared the filters today."]

    L += ["", "## How to read this", "",
          f"- **Setup**: BREAKING OUT = closed above its 20-day pivot on ≥{BREAKOUT_REL_VOL}x relative volume (the strategy's entry trigger). "
          f"TIGHT / SETTING UP = weekly range ≤{TIGHT_RATIO:.0%} of monthly range and within 8% of the pivot — set an alert at the entry level. "
          f"TRENDING = healthy but no clean trigger yet. EXTENDED = already past the 3x-ATR-from-8-EMA level where the strategy *trims*, not buys.",
          "- **Entry** is the pivot (or today's price if already breaking out); **Stop** is the low of day, per the strategy; **Risk %** = distance to stop.",
          "- **3x ATR Trim** = 8 EMA + 3×ATR, the strategy's extension-trim level. Trail the 8/21/50 EMAs after the stop is at breakeven.",
          f"- **Earnings ⚠** = report within {EARNINGS_WARN_DAYS} days; the strategy holds for weeks, so decide whether you want that event risk.",
          f"- Score is a 0–100 percentile blend: momentum {SCORE_WEIGHTS['momentum']:.0%}, tightness {SCORE_WEIGHTS['tightness']:.0%}, "
          f"proximity to highs {SCORE_WEIGHTS['proximity']:.0%}, relative volume {SCORE_WEIGHTS['rel_volume']:.0%}, leading-sector bonus {SCORE_WEIGHTS['theme']:.0%}.",
          "",
          f"_{screened_n} stocks passed the live screen; {len(ranked)} cleared the 8 EMA check; {len(mids)} are mid-caps; {len(larges)} are large-caps. "
          "This screens quantifiable trend/momentum/volume/volatility criteria only — it does not judge chart-pattern quality "
          "or news, and tradingview_screener/yfinance are unofficial API wrappers that could break without notice. "
          "Not financial advice; verify charts and do your own research before trading._"]
    return "\n".join(L)


# ----------------------------------------------------------------------------
# Publish — optional POST to the dashboard's ingest endpoint
# ----------------------------------------------------------------------------
def publish(results: dict, url: str) -> bool:
    """POST the run to the dashboard. Never fatal — the report is the product.

    Auth is a single shared secret in $SCREENER_INGEST_SECRET, sent as the
    x-ingest-secret header. Nothing else is needed on the task side: no repo
    clone, no git credentials, no rebuild.
    """
    secret = os.environ.get("SCREENER_INGEST_SECRET")
    if not secret:
        log.warning("--publish given but $SCREENER_INGEST_SECRET is unset; skipping publish.")
        return False

    body = json.dumps(results, default=str).encode()
    req = urllib.request.Request(
        url, data=body, method="POST",
        headers={"Content-Type": "application/json", "x-ingest-secret": secret},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = resp.read().decode()
        log.info("Published to %s: %s", url, payload)
        print(f"Published {len(body)} bytes to {url}", file=sys.stderr)
        return True
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:400]
        log.warning("Publish failed: HTTP %s %s — %s", e.code, e.reason, detail)
        print(f"WARNING: publish failed (HTTP {e.code}): {detail}", file=sys.stderr)
    except Exception as e:  # noqa: BLE001
        log.warning("Publish failed: %s", e)
        print(f"WARNING: publish failed: {e}", file=sys.stderr)
    return False


# ----------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--top", type=int, default=3, help="picks per section (default 3)")
    ap.add_argument("--limit", type=int, default=600, help="max live-screen rows to consider (default 600)")
    ap.add_argument("--workers", type=int, default=12, help="parallel yfinance fetches (default 12)")
    ap.add_argument("--no-yfinance", action="store_true", help="TradingView-only mode (faster, approximate levels)")
    ap.add_argument("--publish", metavar="URL", default=os.environ.get("SCREENER_INGEST_URL"),
                    help="POST the results to a dashboard ingest endpoint "
                         "(e.g. https://your-site.vercel.app/api/ingest). "
                         "Defaults to $SCREENER_INGEST_URL. Requires $SCREENER_INGEST_SECRET.")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO if args.verbose else logging.WARNING,
                        format="%(levelname)s %(message)s", stream=sys.stderr)
    use_yf = not args.no_yfinance

    regime = market_regime(use_yfinance=use_yf)
    screened = live_screen(limit=args.limit)
    sectors, industries = theme_strength(screened)
    ranked = rank(screened, sectors, use_yfinance=use_yf, workers=args.workers)

    report = write_report(regime, sectors, industries, ranked, len(screened), args.top)
    with open("screener_report.md", "w") as f:
        f.write(report)

    mids = [m for m in ranked if MIDCAP_MIN <= m["market_cap"] <= MIDCAP_MAX]
    larges = [m for m in ranked if m["market_cap"] >= LARGECAP_MIN]
    now = datetime.now(timezone.utc)
    results = {
        "generated_at": now.isoformat(),
        "date": now.strftime("%Y-%m-%d"),
        "regime": regime,
        "sectors": sectors.reset_index().to_dict("records"),
        "screened_n": len(screened),
        "ranked_n": len(ranked),
        "midcap_n": len(mids),
        "largecap_n": len(larges),
        "top_overall": ranked[:args.top],
        "top_midcap": mids[:args.top],
        "top_largecap": larges[:args.top],
        "all_ranked": ranked,
    }
    with open("screener_results.json", "w") as f:
        json.dump(results, f, indent=2, default=str)

    if args.publish:
        publish(results, args.publish)

    if ranked:
        with open("screener_all_ranked.csv", "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(ranked[0].keys()))
            w.writeheader()
            w.writerows(ranked)

    print(report)


if __name__ == "__main__":
    main()
