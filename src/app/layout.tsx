import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jungle Lounge Intel",
  description: "Business Intelligence for Jungle Lounge - Rare Exotic Plants",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  themeColor: "#1A3D1F",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "JL Intel",
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
