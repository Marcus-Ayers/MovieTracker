import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/nav/site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "MovieTracker", template: "%s · MovieTracker" },
  description: "Find something to watch, and keep a diary of everything you've seen.",
};

export const viewport: Viewport = {
  themeColor: "#0b0b0e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg font-sans text-fg">
        <ClerkProvider
          appearance={{
            // Match the site's dark theme.
            variables: {
              colorPrimary: "#e50914",
              colorBackground: "#141418",
              colorForeground: "#ededf0",
              colorMutedForeground: "#a3a3b0",
              colorInput: "#0b0b0e",
              colorInputForeground: "#ededf0",
              colorNeutral: "#ededf0",
              colorDanger: "#ff4d55",
              borderRadius: "0.5rem",
              fontFamily: "var(--font-geist-sans)",
            },
          }}
        >
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </ClerkProvider>
      </body>
    </html>
  );
}