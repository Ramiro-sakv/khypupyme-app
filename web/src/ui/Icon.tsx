const paths = {
  home: "M3 11 12 3l9 8M5 10v10h14V10M9 20v-6h6v6",
  settings: "M4 7h16M4 17h16M8 5v4m8 6v4",
  shops: "M3 10v10h18V10M2 10l2-6h16l2 6M2 10a3 3 0 0 0 5 2 3 3 0 0 0 5 0 3 3 0 0 0 5 0 3 3 0 0 0 5-2M9 20v-5h6v5",
  cash: "M3 7h18v12H3zM6 7V4h12v3M3 12h18m-11 3h4",
  chart: "M3 4v16h18M7 16v-4m5 4V8m5 8V5",
  arrow: "M4 12h15m-6-6 6 6-6 6",
  back: "M20 12H5m6 6-6-6 6-6",
  plus: "M12 4v16M4 12h16",
  search: "M16 16l4 4M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
  check: "m5 12 4 4 10-10",
  close: "m6 6 12 12M18 6 6 18",
  wood: "M4 7h16v11H4zM4 11c4-2 6 2 10 1 2-1 3-2 6-2M8 15c2-1 4-1 6 0",
  clothing: "M8 4 3 7l2 5 3-1v9h8v-9l3 1 2-5-5-3a4 4 0 0 1-8 0Z",
  parcel: "m3 7 9-4 9 4v10l-9 4-9-4Zm0 0 9 4 9-4m-9 4v10M7 5l9 4",
  appliance: "M6 3h12v18H6zM6 10h12M9 6v2m0 5v3",
  calendar: "M4 6h16v15H4zM8 3v5m8-5v5M4 10h16m-12 4h2m4 0h2m-8 3h2",
  tools: "m7 4 3 3-3 3-3-3a5 5 0 0 0 6 6l7 7 3-3-7-7a5 5 0 0 0-6-6Z",
  spark: "M12 2c0 6 4 10 10 10-6 0-10 4-10 10 0-6-4-10-10-10 6 0 10-4 10-10Z",
  grid: "M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z",
  document: "M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name }: { name: IconName }) {
  return <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <path d={paths[name]} />
  </svg>;
}
