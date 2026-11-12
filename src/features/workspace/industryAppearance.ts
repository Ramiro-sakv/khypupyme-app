import type { IndustryId } from "../../../shared/business-industries";
import type { IconName } from "./Icon";

const icons: Partial<Record<IndustryId, IconName>> = {
  timber: "grid", convenience: "sale", clothing: "users", appliances: "shield",
  electronics: "shield", footwear: "users",
};

export function industryIcon(industry: IndustryId | null): IconName {
  return (industry && icons[industry]) || "box";
}
