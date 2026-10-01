import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "California Land Use Bills | LUS Planning",
  description: "San Bernardino County LUS Planning bill tracker.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
