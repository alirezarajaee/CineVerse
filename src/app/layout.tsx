import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const vazir = Vazirmatn({
  variable: "--font-vazir",
  subsets: ["arabic", "latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CineVerse — دنیای فیلم و سریال در دستان شما",
  description:
    "CineVerse: کشف و تماشای فیلم، سریال و انیمیشن با رابط فارسی، پخش واقعی، زیرنویس فارسی و کتابخانه شخصی. Built by Alireza Rajaee.",
  applicationName: "CineVerse",
  authors: [{ name: "Alireza Rajaee" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
  openGraph: {
    title: "CineVerse",
    description: "دنیای فیلم و سریال در دستان شما",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#08090D",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className={`${vazir.variable} font-sans antialiased bg-background text-foreground`}>
        {children}
        <Toaster
          position="top-center"
          theme="dark"
          toastOptions={{
            style: {
              background: "#191C24",
              border: "1px solid rgba(245,245,247,0.08)",
              color: "#F5F5F7",
              fontFamily: "var(--font-vazir)",
            },
          }}
        />
      </body>
    </html>
  );
}
