import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});


export const metadata: Metadata = {
  title: "Sharknits WIP & Production Management System",
  description:
    "Sharknits Internal Production, WIP & Quality Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} bg-[#F6F8FC] text-[#16233B] antialiased`}>
        {children}
      </body>
    </html>
  );
}
