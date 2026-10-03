import type { Metadata } from "next";
import "./globals.css";
import "./forest.css";

export const metadata: Metadata = {
  title: "Thando Thomo | Software Developer",
  description:
    "Thando Thomo is an independent software engineer building clinical systems, AI integrations, data experiences, and automation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
