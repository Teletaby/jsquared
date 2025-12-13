import type { Metadata } from "next";
import { Providers } from "./providers"; // Import Providers
import "./globals.css"; // Import global CSS

export const metadata: Metadata = {
  title: "J-Squared Cinema",
  description: "Your destination for movies and TV shows.",
  icons: {
    icon: "/favicon.ico",
  },
  viewport: "width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
      </head>
      <body>
        <Providers> {/* Wrap children with Providers */}
          {children}
        </Providers>
      </body>
    </html>
  );
}