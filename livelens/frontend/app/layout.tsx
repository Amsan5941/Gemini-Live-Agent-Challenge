import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LiveLens",
  description: "Your voice-first copilot for confusing online tasks."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

