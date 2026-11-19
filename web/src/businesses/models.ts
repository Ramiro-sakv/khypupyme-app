import type { components } from "../api/schema";

export type BusinessCard = components["schemas"]["BusinessCard"];
export type BusinessProfile = components["schemas"]["BusinessProfile"];
export type OperatingPolicy = components["schemas"]["OperatingPolicy"];
export type BusinessList = components["schemas"]["BusinessPage"];
export type BusinessSelection = components["schemas"]["SelectedBusiness"];
export type IndustryOption = components["schemas"]["IndustryOption"];

export const businessApi = "/api/v1/businesses";
