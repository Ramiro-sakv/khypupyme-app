import type { CSSProperties } from "react";
export type IconName =
  | "home"
  | "sale"
  | "box"
  | "purchase"
  | "cash"
  | "users"
  | "debt"
  | "expense"
  | "chart"
  | "document"
  | "settings"
  | "shield"
  | "history"
  | "grid"
  | "arrow"
  | "plus"
  | "close"
  | "check"
  | "search"
  | "wifi"
  | "logout"
  | "timber" | "barcode" | "shirt" | "appliance" | "basket" | "bottles"
  | "shoe" | "chair" | "cosmetic" | "tile" | "sack" | "tools" | "chip"
  | "wheel" | "print" | "paw" | "calendar" | "sparkle" | "briefcase" | "wrench" | "craft";
const paths: Record<IconName, string> = {
  home: "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
  sale: "M3 3h2l2 12h11l3-9H6M9 20h.01M18 20h.01",
  box: "m12 3 9 5v9l-9 5-9-5V8Zm-9 5 9 5 9-5M12 13v9M7 5l9 5",
  purchase: "M4 7h16v14H4ZM8 7V5a4 4 0 0 1 8 0v2M12 11v6M9 14h6",
  cash: "M3 5h18v14H3ZM3 9h18M16 14h2M6 14h3",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M17 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87",
  debt: "M4 3h16v18l-4-2-4 2-4-2-4 2ZM8 7h8M8 11h6",
  expense: "M20 12a8 8 0 1 1-8-8M14 3h7v7M21 3l-9 9",
  chart: "M3 3v18h18M7 16l4-5 4 2 6-8",
  document: "M14 2H5v20h14V7ZM14 2v6h5M8 12h8M8 16h8",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M10 2h4l1 3 3 1 3 3-1 3 1 3-3 3-3 1-1 3h-4l-1-3-3-1-3-3 1-3-1-3 3-3 3-1Z",
  shield: "m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Zm-4 10 3 3 5-6",
  history: "M3 11a9 9 0 1 1 2 7M3 3v8h8M12 7v5l3 2",
  grid: "M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  plus: "M12 5v14M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
  search: "M21 21l-5-5M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14",
  wifi: "M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0M12 20h.01",
  logout: "M9 3H3v18h6M9 12h12m-5-5 5 5-5 5",
  timber: "M2 8 9 3h13v13l-7 5H2Zm0 0h13l7-5m-7 5v13M4 12h8m-8 4h6",
  barcode: "M3 7V4h3m12 0h3v3m0 10v3h-3M6 20H3v-3m4-9v8m3-8v8m4-8v8m3-8v8",
  shirt: "m9 4-3 1-4 4 3 4 3-2v9h8v-9l3 2 3-4-4-4-3-1a3 3 0 0 1-6 0Z",
  appliance: "M5 3h14v17H5Zm0 6h14M8 6h1m-1 6v4M7 20v2m10-2v2",
  basket: "M3 10h18l-2 10H5Zm4 0 3-6m7 6-3-6m-6 9 1 4m7-4-1 4",
  bottles: "M5 3h4v5l2 3v9H3v-9l2-3Zm10 2h4v4l2 3v8h-8v-8l2-3ZM3 14h8m2 1h8",
  shoe: "M3 9v9h18v-3c0-2-3-3-6-3l-5-5-3 4-4-2Zm0 6h18",
  chair: "M6 12V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6m-14 0h16v5H4Zm2 5v4m12-4v4",
  cosmetic: "M8 10h8v11H8Zm2 0V5l4-3v8m-6 4h8",
  tile: "M3 3h18v18H3Zm9 0v18M3 12h18m-15-5 2 2m8 7 2 2",
  sack: "m8 3 2 4h4l2-4Zm2 4c-4 3-6 7-6 11 0 2 2 3 4 3h8c2 0 4-1 4-3 0-4-2-8-6-11m-5 8h6",
  tools: "m3 21 8-8m-4-8 4-3 5 5-3 4-6-6Zm7 10 6 6 2-2-6-6M5 15l-3 3 2 2",
  chip: "M6 6h12v12H6Zm4 4h4v4h-4ZM9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4",
  wheel: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-6 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm-3-3V3m3 10 5 3m-11-3-5 3",
  print: "M7 8V3h10v5M6 17H3V8h18v9h-3m-11-3h10v7H7Zm10-3h1",
  paw: "M8 15c1-1 2-3 4-3s3 2 4 3c3 2 2 6-1 5l-3-1-3 1c-3 1-4-3-1-5ZM6 9a2 3 0 1 0-4 0 2 3 0 1 0 4 0Zm5-3a2 3 0 1 0-4 0 2 3 0 1 0 4 0Zm6 0a2 3 0 1 0-4 0 2 3 0 1 0 4 0Zm5 3a2 3 0 1 0-4 0 2 3 0 1 0 4 0Z",
  calendar: "M3 5h18v16H3Zm4-3v6m10-6v6M3 10h18m-14 5h3m4 0h3m-10 3h3",
  sparkle: "m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Zm6 1v4m-2-2h4",
  briefcase: "M3 7h18v13H3Zm5 0V4h8v3M3 12h18m-10 0v3h2v-3",
  wrench: "M20 3a5 5 0 0 1-6 7l-9 10-2-2 9-10a5 5 0 0 1 7-6l-3 3 2 2Z",
  craft: "M3 8h18v12H3Zm0 0 9 6 9-6M12 14v6m0-12c-6 0-6-5-3-5 2 0 3 2 3 5Zm0 0c6 0 6-5 3-5-2 0-3 2-3 5Z",
};
export function Icon({
  name,
  className = "",
  style,
}: {
  name: IconName;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={`icon ${className}`}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
