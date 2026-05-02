import type { Metadata } from "next";
import { Cinzel, Open_Sans } from "next/font/google";
import { ManaThemeProvider } from "@/context/ManaThemeContext";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  weight: ["500", "600", "700"],
});

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
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
      className={`${cinzel.variable} ${openSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ManaThemeProvider>{children}</ManaThemeProvider>
      </body>
    </html>
  );
}
