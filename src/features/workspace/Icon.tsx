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
  | "logout";
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
