import type { Metadata } from "next";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/poppins/800.css";
import "./styles.css";

export const metadata: Metadata = {
  title: "SERVIER Potion Lab — Clinical Discovery Atelier",
  description: "Premium fullstack potion laboratory for the SERVIER technical test",
  icons: {
    icon: [
      { url: "/brand/servier-favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/servier-favicon-192.png", sizes: "192x192", type: "image/png" }
    ],
    apple: [{ url: "/brand/servier-apple-touch-180.png", sizes: "180x180", type: "image/png" }]
  },
  other: {
    "msapplication-TileImage": "/brand/servier-tile-270.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
