import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TypeSketch",
  description: "Type a diagram. Stop dragging shapes.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
