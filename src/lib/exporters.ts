"use client";

import type { IRGraph } from "@/core/ir";
import type { LayoutResult } from "@/core/layout";
import { toSVG, type SvgOptions } from "@/core/export/svg";

/**
 * Browser-side export. The SVG itself is produced by the isomorphic core; this
 * module only deals with the things that need a DOM — rasterising, the
 * clipboard, and triggering a download.
 */

const FONT_URL = "/fonts/architects-daughter.woff2";

let embeddedFont: string | null = null;

/**
 * An SVG rendered inside an `<img>` — which is how rasterisation works — cannot
 * fetch external resources, fonts included. Without this the handwritten text
 * would quietly become Times New Roman in every PNG.
 *
 * Fetched once and cached; failure is not fatal, it just falls back to whatever
 * the system offers.
 */
async function fontFaceCss(): Promise<string> {
  if (embeddedFont !== null) return embeddedFont;

  try {
    const response = await fetch(FONT_URL);
    if (!response.ok) throw new Error(String(response.status));

    const buffer = await response.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
    const base64 = btoa(binary);

    embeddedFont = `@font-face{font-family:'Architects Daughter';font-style:normal;font-weight:400;src:url(data:font/woff2;base64,${base64}) format('woff2');}`;
  } catch {
    embeddedFont = "";
  }

  return embeddedFont;
}

function withFont(svg: string, css: string): string {
  if (!css) return svg;
  return svg.replace(/^(<svg[^>]*>)/, `$1<defs><style>${css}</style></defs>`);
}

export async function renderSVG(
  graph: IRGraph,
  layout: LayoutResult,
  options: SvgOptions,
): Promise<string> {
  return withFont(toSVG(graph, layout, options), await fontFaceCss());
}

/** Rasterise at 2× by default, so the result stands up in a slide or a doc. */
export async function renderPNG(
  graph: IRGraph,
  layout: LayoutResult,
  options: SvgOptions,
  scale = 2,
): Promise<Blob> {
  const svg = await renderSVG(graph, layout, options);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));

  try {
    const image = new Image();
    image.decoding = "sync";

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not rasterise the diagram"));
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode PNG"))),
        "image/png",
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Copy the diagram as an image, ready to paste into Slack, a doc, or a ticket.
 *
 * The blob must be handed to `ClipboardItem` as a promise rather than awaited
 * first: Safari drops the user-gesture permission across an await, so building
 * the PNG before the write would fail there while working in Chrome.
 */
export async function copyImage(
  graph: IRGraph,
  layout: LayoutResult,
  options: SvgOptions,
): Promise<void> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    throw new Error("This browser cannot copy images to the clipboard");
  }

  await navigator.clipboard.write([
    new ClipboardItem({
      "image/png": renderPNG(graph, layout, options),
    }),
  ]);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadText(text: string, filename: string, type: string): void {
  downloadBlob(new Blob([text], { type }), filename);
}

/** A filesystem-safe stem derived from the document title. */
export function fileStem(title: string | undefined): string {
  const stem = (title ?? "diagram")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return stem || "diagram";
}
