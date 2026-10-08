import type { Metadata } from "next";
import "./globals.css";
import "./reader.css";

export const metadata: Metadata = {
  title: "Library · Codex Musica",
  description:
    "Browse poetry and song collections, read original texts, and inspect sources, editions, and rights.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
