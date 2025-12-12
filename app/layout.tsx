import type { Metadata } from "next";
import { Providers } from "./providers"; // Import Providers
import "./globals.css"; // Import global CSS

export const metadata: Metadata = {
  title: "J-Squared Cinema",
  description: "Your destination for movies and TV shows.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers> {/* Wrap children with Providers */}
          {children}
        </Providers>
      </body>
    </html>
  );
}