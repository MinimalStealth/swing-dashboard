import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Swing Screener",
  description: "Daily momentum swing screener — picks, themes and persistence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
