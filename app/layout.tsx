import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Research Lens",
  description:
    "Evidence to AI interpretation to trust decision to deterministic skill.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
