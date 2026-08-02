"use client";

import {
  ChevronDown,
  Copy,
  Download,
  FilePlus2,
  Save,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { HelpSheet } from "@/components/HelpSheet";
import { OpenDialog } from "@/components/OpenDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { RenderMode } from "@/core/render";
import type { Backend, StoredDocument } from "@/lib/document";

export type DownloadFormat = "png" | "svg" | "source" | "json";

export interface HeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  mode: RenderMode;
  onModeChange: (mode: RenderMode) => void;
  onNew: () => void;
  onOpen: (document: StoredDocument) => void;
  onImport: (name: string, source: string) => void;
  onSave: () => void;
  onDownload: (format: DownloadFormat) => void;
  onCopyImage: () => void;
  saving: boolean;
  dirty: boolean;
  backend: Backend | null;
}

export function Header({
  title,
  onTitleChange,
  mode,
  onModeChange,
  onNew,
  onOpen,
  onImport,
  onSave,
  onDownload,
  onCopyImage,
  saving,
  dirty,
  backend,
}: HeaderProps) {
  return (
    <header className="shrink-0">
      {/* Brand row */}
      <div className="flex h-12 items-center gap-3 border-b px-4">
        <div className="flex items-center gap-2 font-semibold">
          <BrandMark />
          <span
            className="text-[17px]"
            style={{ fontFamily: "var(--font-hand), sans-serif" }}
          >
            TypeSketch
          </span>
        </div>

        <div className="bg-border h-5 w-px" />

        {/*
          Sequence diagrams need a time-ordered layout engine rather than a
          graph one — a sibling LayoutStrategy, not a tweak. Shown because it is
          planned, disabled because pretending otherwise would be worse.
        */}
        <div className="flex items-center gap-1">
          <span className="bg-accent text-accent-foreground rounded-md px-3 py-1 text-sm font-medium">
            Flow
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground/60 cursor-not-allowed rounded-md px-3 py-1 text-sm">
                Sequence
              </span>
            </TooltipTrigger>
            <TooltipContent>Sequence diagrams are coming later</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Action row */}
      <div className="flex h-12 items-center gap-1 border-b px-3">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onNew}>
          <FilePlus2 className="size-4" />
          New
        </Button>

        <OpenDialog onOpen={onOpen} onImport={onImport} />

        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={onSave}
          disabled={saving}
        >
          <Save className="size-4" />
          {saving ? "Saving…" : "Save"}
          {dirty && !saving ? (
            <span className="bg-foreground/40 ml-0.5 size-1.5 rounded-full" />
          ) : null}
        </Button>

        <div className="bg-border mx-1.5 h-5 w-px" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <Download className="size-4" />
              Download
              <ChevronDown className="size-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onDownload("png")}>
              PNG image
              <span className="text-muted-foreground ml-auto text-xs">2×</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload("svg")}>
              SVG vector
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDownload("source")}>
              Source
              <span className="text-muted-foreground ml-auto text-xs">.sketch</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload("json")}>
              Data
              <span className="text-muted-foreground ml-auto text-xs">.json</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onCopyImage}>
          <Copy className="size-4" />
          Copy Image
        </Button>

        {/* Title, centred independently of the button groups either side. */}
        <div className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 md:block">
          <input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            aria-label="Diagram title"
            className="pointer-events-auto hover:bg-accent focus:bg-accent w-64 rounded-md border-none bg-transparent px-2 py-1 text-center text-sm outline-none"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {backend ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-muted-foreground hidden text-xs lg:inline">
                  {backend === "mongodb" ? "MongoDB" : "This browser"}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {backend === "mongodb"
                  ? "Saved to your local MongoDB"
                  : "No database connected — saved in this browser only"}
              </TooltipContent>
            </Tooltip>
          ) : null}

          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(next) => next && onModeChange(next as RenderMode)}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="sketch">Sketch</ToggleGroupItem>
            <ToggleGroupItem value="clean">Clean</ToggleGroupItem>
          </ToggleGroup>

          <HelpSheet />
        </div>
      </div>
    </header>
  );
}
