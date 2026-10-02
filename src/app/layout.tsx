import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import AppToaster from "@/components/AppToaster";
import { cookies } from "next/headers";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { LANGUAGE_COOKIE, isLanguage, DEFAULT_LANGUAGE } from "@/i18n/config";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/context/ThemeContext";

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
        {/* Icon font: no next/font equivalent for Material Symbols */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
      </head>
      <body className="bg-slate-50 text-slate-900 min-h-screen font-sans">
        <LanguageProvider initialLanguage={language}>
          <ThemeProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
            <AppToaster />
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
