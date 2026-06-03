import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AasaMedChem | Inventory & Order Management",
  description: "High-precision chemical component inventory and order management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
