import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Manrope } from "next/font/google";
import { InstallAppFab } from "@/components/InstallAppFab";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

const display = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "SatReward",
  description: "Spend sats. Get rewarded.",
  applicationName: "SatReward",
  manifest: `${base}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SatReward",
  },
  icons: {
    icon: [
      { url: `${base}/icons/favicon-16.png`, sizes: "16x16", type: "image/png" },
      { url: `${base}/icons/favicon-32.png`, sizes: "32x32", type: "image/png" },
      { url: `${base}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${base}/icons/icon.svg`, type: "image/svg+xml" },
    ],
    apple: [{ url: `${base}/icons/apple-touch-icon.png`, sizes: "180x180" }],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#c9a24a",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} font-sans antialiased`}>
        {children}
        <InstallAppFab />
        <PwaRegister />
      </body>
    </html>
  );
}
