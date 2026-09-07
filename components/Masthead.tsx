export default function Masthead({
  current,
  meta,
}: {
  current: "latest" | "archive" | "legend";
  meta?: string;
}) {
  return (
    <header className="masthead">
      <div>
        <h1>Swing Screener</h1>
        {meta && <div className="meta">{meta}</div>}
      </div>
      <nav className="tabs">
        <a href="/" aria-current={current === "latest" ? "page" : undefined}>
          Latest
        </a>
        
          href="/archive"
          aria-current={current === "archive" ? "page" : undefined}
        >
          Archive
        </a>
        
          href="/legend"
          aria-current={current === "legend" ? "page" : undefined}
        >
          Legend
        </a>
      </nav>
    </header>
  );
}