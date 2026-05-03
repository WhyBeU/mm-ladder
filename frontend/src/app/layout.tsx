import type { Metadata } from "next";
import { Cinzel, Inter } from "next/font/google";
import { ManaThemeProvider } from "@/context/ManaThemeContext";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  weight: ["500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "MM Ladder",
  description: "Magic Mates Monday draft league tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-mana="U"
      className={`${cinzel.variable} ${inter.variable} h-full antialiased`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/keyrune@3.18.0/css/keyrune.css"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ManaThemeProvider>{children}</ManaThemeProvider>
      </body>
    </html>
  );
}
