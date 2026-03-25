import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jungle Lounge Intel",
  description: "Business Intelligence for Jungle Lounge - Rare Exotic Plants",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
