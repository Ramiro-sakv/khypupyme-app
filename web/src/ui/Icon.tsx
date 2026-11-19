const paths = {
  home: "M3 11 12 3l9 8M5 10v10h14V10M9 20v-6h6v6",
  settings: "M4 7h16M4 17h16M8 5v4m8 6v4",
  shops: "M3 10v10h18V10M2 10l2-6h16l2 6M2 10a3 3 0 0 0 5 2 3 3 0 0 0 5 0 3 3 0 0 0 5 0 3 3 0 0 0 5-2M9 20v-5h6v5",
  cash: "M3 7h18v12H3zM6 7V4h12v3M3 12h18m-11 3h4",
  chart: "M3 4v16h18M7 16v-4m5 4V8m5 8V5",
  arrow: "M4 12h15m-6-6 6 6-6 6",
  back: "M20 12H5m6 6-6-6 6-6",
  plus: "M12 4v16M4 12h16",
  minus: "M5 12h14",
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
  cart: "M2 4h3l2.5 11h11l2.5-8H6m2 12h.01M18 19h.01",
  help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.4-3 4m0 3h.01",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-4M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm4-3.6a4 4 0 0 1 0 7.2",
  archive: "M3 4h18v5H3zM5 9v11h14V9m-10 4h6",
  barcode: "M3 5h3M3 5v3m15-3h3v3m-18 8v3h3m15-3v3h-3M7 8v8m3-8v8m4-8v8m3-8v8",
  basket: "M3 10h18l-2 10H5Zm4 0 3-6m7 6-3-6m-6 9 1 4m7-4-1 4",
  bottles: "M5 3h4v5l2 3v9H3v-9l2-3Zm10 2h4v4l2 3v8h-8v-8l2-3ZM3 14h8m2 1h8",
  shoe: "M3 9v9h18v-3c0-2-3-3-6-3l-5-5-3 4-4-2Zm0 6h18",
  chair: "M6 12V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6m-14 0h16v5H4Zm2 5v4m12-4v4",
  cosmetic: "M8 10h8v11H8Zm2 0V5l4-3v8m-6 4h8",
  tile: "M3 3h18v18H3Zm9 0v18M3 12h18m-15-5 2 2m8 7 2 2",
  sack: "m8 3 2 4h4l2-4Zm2 4c-4 3-6 7-6 11 0 2 2 3 4 3h8c2 0 4-1 4-3 0-4-2-8-6-11m-5 8h6",
  chip: "M6 6h12v12H6Zm4 4h4v4h-4ZM9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4",
  wheel: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-6 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm-3-3V3m3 10 5 3m-11-3-5 3",
  print: "M7 8V3h10v5M6 17H3V8h18v9h-3m-11-3h10v7H7Zm10-3h1",
  paw: "M8 15c1-1 2-3 4-3s3 2 4 3c3 2 2 6-1 5l-3-1-3 1c-3 1-4-3-1-5ZM6 9a2 3 0 1 0-4 0 2 3 0 1 0 4 0Zm5-3a2 3 0 1 0-4 0 2 3 0 1 0 4 0Zm6 0a2 3 0 1 0-4 0 2 3 0 1 0 4 0Zm5 3a2 3 0 1 0-4 0 2 3 0 1 0 4 0Z",
  briefcase: "M3 7h18v13H3Zm5 0V4h8v3M3 12h18m-10 0v3h2v-3",
  wrench: "M20 3a5 5 0 0 1-6 7l-9 10-2-2 9-10a5 5 0 0 1 7-6l-3 3 2 2Z",
  craft: "M3 8h18v12H3Zm0 0 9 6 9-6M12 14v6m0-12c-6 0-6-5-3-5 2 0 3 2 3 5Zm0 0c6 0 6-5 3-5-2 0-3 2-3 5Z",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name }: { name: IconName }) {
  return <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <path d={paths[name]} />
  </svg>;
}
