import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Big Homie",
  description: "AI-powered financial education and coaching",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col m-0">{children}</body>
    </html>
  );
}
