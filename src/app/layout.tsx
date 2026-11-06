import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Agentic Wallet Tracker", template: "%s · Agentic Wallet Tracker" },
  description: "Read-only wallet tracking for Robinhood Chain: every transfer, swap and liquidity move a wallet makes, decoded.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
