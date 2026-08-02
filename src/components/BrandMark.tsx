/**
 * Three connected nodes — the smallest thing that reads as "diagram" at 20px.
 * Uses `currentColor` so it inherits whatever the header is.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2.5" y="3" width="6" height="6" rx="1.5" />
      <rect x="15.5" y="3" width="6" height="6" rx="1.5" />
      <rect x="9" y="15" width="6" height="6" rx="1.5" />
      <path d="M8.5 6h7" />
      <path d="M5.5 9v3.5a1.5 1.5 0 0 0 1.5 1.5h2" />
      <path d="M18.5 9v3.5a1.5 1.5 0 0 1-1.5 1.5h-2" />
    </svg>
  );
}
