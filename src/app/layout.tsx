import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import AppToaster from "@/components/AppToaster";
import { cookies } from "next/headers";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { LANGUAGE_COOKIE, isLanguage, DEFAULT_LANGUAGE } from "@/i18n/config";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/context/ThemeContext";
import { ICON_FONT_URL } from "@/lib/icons";
import SmoothScroll from "@/components/SmoothScroll";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "BKI Academy CMS",
  description: "BKI Academy Certificate Management System",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();
  const cookieLang = store.get(LANGUAGE_COOKIE)?.value;
  const language = isLanguage(cookieLang) ? cookieLang : DEFAULT_LANGUAGE;

  return (
    <html lang={language} className={`h-full ${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets the theme class before first paint (static string, no flash) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Icon font: no next/font equivalent for Material Symbols. Loaded as a subset
            (src/lib/icons.ts, a few KB instead of ~3.9 MB). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={ICON_FONT_URL} />
      </head>
      <body className="bg-slate-50 text-slate-900 min-h-screen font-sans">
        <LanguageProvider initialLanguage={language}>
          <ThemeProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
            <AppToaster />
            <SmoothScroll />
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
