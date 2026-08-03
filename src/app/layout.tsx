import type { Metadata } from "next";
// Self-hosted, OFL-1.1. Sketch mode's handwritten face — see --font-hand.
import "@fontsource/architects-daughter/400.css";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { paletteCss } from "@/core/registry";

export const metadata: Metadata = {
  title: "TypeSketch",
  description: "Type a diagram. Stop dragging shapes.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/*
          Generated from PALETTE rather than hand-written in globals.css, so the
          canvas variables and the values the exporter resolves cannot drift
          apart. Variables (not inline colours) so a theme change repaints
          without re-rendering the diagram.
        */}
        <style dangerouslySetInnerHTML={{ __html: paletteCss() }} />
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
