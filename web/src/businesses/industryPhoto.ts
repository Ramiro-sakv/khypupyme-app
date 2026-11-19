import timber from "../assets/rubros/maderas-v1.webp";
import retail from "../assets/rubros/mostrador-v1.webp";
import fashion from "../assets/rubros/moda-v1.webp";
import equipment from "../assets/rubros/equipos-v1.webp";
import workshop from "../assets/rubros/taller-v1.webp";
import services from "../assets/rubros/servicios-v1.webp";
import type { IndustryId } from "./industryThemes";

const photos: Record<IndustryId, string> = {
  timber, convenience: retail, grocery: retail, beverages: retail, pets: retail, stationery: retail,
  clothing: fashion, footwear: fashion, cosmetics: fashion, furniture: timber,
  appliances: equipment, electronics: equipment,
  hardware: workshop, spareParts: workshop, cement: workshop, ceramics: workshop, repair: workshop, crafts: workshop,
  beauty: services, cleaning: services, professional: services,
};

export function industryPhoto(industry?: string): string | undefined {
  return industry ? photos[industry as IndustryId] : undefined;
}
