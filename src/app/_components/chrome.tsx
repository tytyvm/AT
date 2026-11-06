import Link from "next/link";

type Page = "home" | "feed" | "docs";

function Mark() {
  // An aperture: the ring is the chain, the offset dot is the wallet you're watching.
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r="11.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="13" cy="13" r="6" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
      <circle cx="17.5" cy="9" r="2.6" fill="var(--accent)" />
    </svg>
  );
}

export function SiteHeader({ current }: { current: Page }) {
  const link = (href: string, page: Page, text: string) => (
    <Link href={href} aria-current={current === page ? "page" : undefined}>{text}</Link>
  );
  return (
    <header className="masthead">
      <div className="wrap masthead-inner">
        <Link href="/" className="wordmark">
          <Mark />
          <span className="wm-text">Agentic Wallet Tracker</span>
          <small>4663</small>
        </Link>
        <nav className="nav" aria-label="Main">
          {link("/feed", "feed", "Live feed")}
          {link("/docs", "docs", "Docs")}
          <Link href="/#roadmap">Roadmap</Link>
        </nav>
        <span className="phase-chip">Phase 1 / 6</span>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="colophon">
      <div className="wrap">
        <span>Agentic Wallet Tracker · read-only wallet intelligence for Robinhood Chain (4663)</span>
        <span>
          <Link href="/feed">Feed</Link> · <Link href="/docs">Docs</Link> · <Link href="/docs#security">Security</Link>
        </span>
        <span>Independent project. Not affiliated with or endorsed by Robinhood Markets, Inc.</span>
      </div>
    </footer>
  );
}

/** Scrolling ticker. Items are rendered twice so the loop is seamless. */
export function Tape({ items }: { items: React.ReactNode[] }) {
  const row = items.map((item, i) => <span key={i}>{item}</span>);
  return (
    <div className="tape" aria-hidden="true">
      <div className="tape-track">{row}{row.map((r, i) => <span key={`b${i}`}>{r.props.children}</span>)}</div>
    </div>
  );
}
