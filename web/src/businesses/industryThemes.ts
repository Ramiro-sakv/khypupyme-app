import type { CSSProperties } from "react";
import type { IconName } from "../ui/Icon";

const identities = {
  convenience: ["#8c3b29", "#faebe4", "barcode"],
  grocery: ["#3e642e", "#edf3e7", "basket"],
  beverages: ["#166463", "#e4f3f1", "bottles"],
  clothing: ["#70375e", "#f4e9f1", "clothing"],
  footwear: ["#583d76", "#eee9f6", "shoe"],
  furniture: ["#76513b", "#f3ebe3", "chair"],
  cosmetics: ["#8b3f64", "#f9e9f0", "cosmetic"],
  timber: ["#794415", "#f7ebd7", "wood"],
  ceramics: ["#9a4735", "#f8ebe5", "tile"],
  cement: ["#4b535c", "#edf0f3", "sack"],
  hardware: ["#66571b", "#f4f0dd", "tools"],
  appliances: ["#294e96", "#e8eefb", "appliance"],
  electronics: ["#37407e", "#ececfa", "chip"],
  spareParts: ["#3e5b70", "#e9f0f4", "wheel"],
  stationery: ["#665089", "#f2edf8", "print"],
  pets: ["#516324", "#eff2e1", "paw"],
  beauty: ["#8b3d55", "#f9eaf0", "calendar"],
  cleaning: ["#2c6477", "#e7f2f5", "spark"],
  professional: ["#355b51", "#e9f2ed", "briefcase"],
  repair: ["#704c30", "#f2ebe2", "wrench"],
  crafts: ["#8a4c25", "#f8eee1", "craft"],
} satisfies Record<string, readonly [string, string, IconName]>;

export type IndustryId = keyof typeof identities;
export const usesDeliveries = (industry: string) => ["furniture", "cement", "ceramics", "hardware", "beverages", "timber"].includes(industry);

export const industryFamilies: { label: string; ids: IndustryId[] }[] = [
  { label: "Alimentos y consumo", ids: ["convenience", "grocery", "beverages"] },
  { label: "Moda y hogar", ids: ["clothing", "footwear", "furniture", "cosmetics"] },
  { label: "Construcción y materiales", ids: ["timber", "ceramics", "cement", "hardware"] },
  { label: "Tecnología y equipos", ids: ["appliances", "electronics", "spareParts"] },
  { label: "Otros comercios", ids: ["stationery", "pets", "crafts"] },
  { label: "Servicios y oficios", ids: ["beauty", "cleaning", "professional", "repair"] },
];

export function industryTheme(industry: string): { style: CSSProperties; icon: IconName } {
  const [accent, surface, icon] = identities[industry as keyof typeof identities] ?? ["#12483d", "#e9f0eb", "shops"];
  return { style: { "--accent": accent, "--accent-soft": surface } as CSSProperties, icon };
}
