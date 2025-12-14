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
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://jjsquared.vercel.app",
    siteName: "J-Squared Cinema",
    title: "J-Squared Cinema",
    description: "Your destination for movies and TV shows.",
    images: [
      {
        url: "https://jjsquared.vercel.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "J-Squared Cinema",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "J-Squared Cinema",
    description: "Your destination for movies and TV shows.",
    images: ["https://jjsquared.vercel.app/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="overflow-hidden">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
      </head>
      <body className="overflow-hidden">
        <Providers> {/* Wrap children with Providers */}
          {children}
        </Providers>
      </body>
    </html>
  );
}