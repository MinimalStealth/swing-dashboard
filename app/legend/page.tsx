import Masthead from "@/components/Masthead";

export default function LegendPage() {
  return (
    <main className="shell">
      <Masthead current="legend" />

      <section className="card">
        <h2>Sectors</h2>
        <p className="card-note">
          The emoji next to each sector name is a visual anchor for scanning
          the table quickly — it carries no signal of its own.
        </p>
        <div className="glossary-grid">
          <div className="glossary-item"><span className="emoji">🧬</span><span><strong>Health Technology</strong> — biotech, pharma, medical devices</span></div>
          <div className="glossary-item"><span className="emoji">⚕️</span><span><strong>Health Services</strong> — providers, insurers, care delivery</span></div>
          <div className="glossary-item"><span className="emoji">💻</span><span><strong>Technology Services</strong> — software, IT services, internet</span></div>
          <div className="glossary-item"><span className="emoji">🔌</span><span><strong>Electronic Technology</strong> — semiconductors, hardware</span></div>
          <div className="glossary-item"><span className="emoji">💰</span><span><strong>Finance</strong> — banks, insurers, asset managers</span></div>
          <div className="glossary-item"><span className="emoji">🚚</span><span><strong>Transportation</strong> — shipping, rail, logistics, airlines</span></div>
          <div className="glossary-item"><span className="emoji">🛍️</span><span><strong>Retail Trade</strong> — retailers, e-commerce</span></div>
          <div className="glossary-item"><span className="emoji">🛎️</span><span><strong>Consumer Services</strong> — hotels, restaurants, leisure</span></div>
          <div className="glossary-item"><span className="emoji">🚗</span><span><strong>Consumer Durables</strong> — autos, appliances, homebuilders</span></div>
          <div className="glossary-item"><span className="emoji">🧴</span><span><strong>Consumer Non-Durables</strong> — food, beverages, household goods</span></div>
          <div className="glossary-item"><span className="emoji">📦</span><span><strong>Distribution Services</strong> — wholesalers, distributors</span></div>
          <div className="glossary-item"><span className="emoji">🛢️</span><span><strong>Energy Minerals</strong> — oil &amp; gas producers</span></div>
          <div className="glossary-item"><span className="emoji">⛏️</span><span><strong>Non-Energy Minerals</strong> — mining, metals</span></div>
          <div className="glossary-item"><span className="emoji">🏭</span><span><strong>Process Industries</strong> — chemicals, materials processing</span></div>
          <div className="glossary-item"><span className="emoji">⚙️</span><span><strong>Producer Manufacturing</strong> — industrial equipment</span></div>
          <div className="glossary-item"><span className="emoji">🏗️</span><span><strong>Industrial Services</strong> — engineering, construction</span></div>
          <div className="glossary-item"><span className="emoji">📡</span><span><strong>Communications</strong> — telecom, media</span></div>
          <div className="glossary-item"><span className="emoji">🧾</span><span><strong>Commercial Services</strong> — business services, staffing</span></div>
          <div className="glossary-item"><span className="emoji">⚡</span><span><strong>Utilities</strong> — power, water, gas utilities</span></div>
          <div className="glossary-item"><span className="emoji">📊</span><span><strong>Other / unmapped</strong> — anything TradingView labels outside the above</span></div>
        </div>
      </section>

      <section className="card">
        <h2>Setup</h2>
        <p className="card-note">
          Where a name sits in the strategy&rsquo;s entry sequence, ordered
          from least to most immediate.
        </p>
        <dl className="deflist">
          <dt>
            <span className="chip chip-trending"><span className="dot" aria-hidden="true" /> TRN</span>
            {" "}📈 Trending
          </dt>
          <dd>Healthy uptrend, above its EMAs, but no trigger yet. Watch, don&rsquo;t act.</dd>

          <dt>
            <span className="chip chip-tight"><span className="dot" aria-hidden="true" /> TGT</span>
            {" "}🎯 Tight / setting up
          </dt>
          <dd>
            Weekly range has contracted to ≤80% of the monthly range and price
            sits within 8% of the pivot. This is the &ldquo;set an alert&rdquo;
            state.
          </dd>

          <dt>
            <span className="chip chip-breakout"><span className="dot" aria-hidden="true" /> BRK</span>
            {" "}🚀 Breaking out
          </dt>
          <dd>
            Closed above its 20-day pivot on at least 1.5&times; relative
            volume — the strategy&rsquo;s actual entry trigger.
          </dd>

          <dt>
            <span className="chip chip-extended"><span className="dot" aria-hidden="true" /> EXT</span>
            {" "}⚠️ Extended
          </dt>
          <dd>
            Already past 3&times;ATR above the 8 EMA. This is the
            strategy&rsquo;s trim zone, not a place to initiate a new position.
          </dd>
        </dl>
        <p className="card-note" style={{ marginTop: 12, marginBottom: 0 }}>
          ⚡ next to a ticker means it&rsquo;s currently 🚀 Breaking out or 🎯
          Tight / setting up — the two setups with a real trigger nearby.
          🔥 next to a ticker means its score is 85 or higher.
        </p>
      </section>

      <section className="card">
        <h2>Table columns</h2>
        <dl className="deflist">
          <dt>Rel vol</dt>
          <dd>
            Today&rsquo;s volume as a multiple of the 10-day average. Above 1x
            means more interest than usual; the breaking-out trigger requires
            1.5x or higher.
          </dd>

          <dt>From high</dt>
          <dd>Percent below the 52-week high. Closer to 0% means closer to new highs.</dd>

          <dt>Entry</dt>
          <dd>
            The suggested trigger price — the pivot level, or today&rsquo;s
            price if the stock is already breaking out.
          </dd>

          <dt>Stop</dt>
          <dd>The strategy&rsquo;s stop-loss level: the low of the current day.</dd>

          <dt>Risk</dt>
          <dd>
            Percent distance from the entry down to the stop — how much
            you&rsquo;re risking per share if the trade fails immediately.
          </dd>

          <dt>Plan</dt>
          <dd>
            A single bar visualizing the trade end to end: the red segment is
            the distance from stop to entry (what you risk), the blue segment
            is the runway from entry up to the 3&times;ATR trim level (where
            the strategy takes profit), and the vertical mark shows where
            price sits right now relative to both. Hover it to see the exact
            stop, entry, trim, and current price.
          </dd>

          <dt>Earnings</dt>
          <dd>
            Days until the next scheduled earnings report. A 📅 flag means it
            falls within 7 days — inside a typical multi-week swing hold, so
            you&rsquo;re deciding whether to accept that event risk. A ❓
            means no date has been published; that&rsquo;s unknown, not safe.
          </dd>

          <dt>Score</dt>
          <dd>
            A 0–100 percentile blend across the field: momentum 35%, tightness
            20%, proximity to 52-week highs 20%, relative volume 10%, and a
            15% bonus for sitting in one of the top 3 leading sectors that
            day.
          </dd>
        </dl>
      </section>

      <section className="card">
        <h2>Callouts</h2>
        <dl className="deflist">
          <dt>⚡ Actionable now</dt>
          <dd>
            Count of published picks (across all three size tables,
            de-duplicated) that are either 🚀 breaking out or 🎯 tight and
            setting up — the two setups with a real trigger nearby, as
            opposed to 📈 trending names that are still just watchlist
            material. The same ⚡ mark appears next to those tickers in the
            picks tables.
          </dd>

          <dt>📋 Published picks</dt>
          <dd>
            Unique tickers across the overall, mid-cap, and large-cap tables
            that day, out of everything that cleared the screen.
          </dd>

          <dt>🧭 Sector concentration</dt>
          <dd>
            How many of the published picks share the single most common
            sector. A warning dot appears when half or more of the picks are
            really one sector bet wearing different tickers.
          </dd>

          <dt>📅 Earnings inside the hold</dt>
          <dd>How many published picks report earnings within the next 7 days.</dd>
        </dl>
      </section>

      <p className="footnote">
        This page documents the mechanics only — it doesn&rsquo;t change how
        anything is screened, scored, or ranked. See the footnote on the{" "}
        <a href="/">Latest</a> page for the underlying screen&rsquo;s
        criteria and caveats.
      </p>
    </main>
  );
}
