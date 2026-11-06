import { INDUSTRIES, INDUSTRY_IDS } from './business-industries.js';
import type { IndustryId } from './business-industries.js';
export const TOOL_IDS = ['inventory', 'purchases', 'services', 'customers', 'receivables'] as const;
export type ToolId = (typeof TOOL_IDS)[number];
export type ProfileId = 'retail' | 'services' | 'mixed';
export interface BusinessConfiguration {
  profileId: ProfileId;
  version: 1;
  industryId?: IndustryId;
  tools: ToolId[];
}
export const PROFILE_DEFAULTS: Record<ProfileId, readonly ToolId[]> = {
  retail: ['inventory', 'purchases', 'customers', 'receivables'],
  services: ['services', 'customers', 'receivables'],
  mixed: TOOL_IDS,
};

export function validateConfiguration(value: unknown): BusinessConfiguration {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Configuración de negocio inválida.');
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data).some(
      (key) => !['profileId', 'version', 'tools', 'industryId'].includes(key),
    ) ||
    !['profileId', 'version', 'tools'].every((key) => key in data) ||
    ('industryId' in data &&
      (!INDUSTRY_IDS.includes(data.industryId as IndustryId) ||
        INDUSTRIES[data.industryId as IndustryId].profile !== data.profileId)) ||
    !['retail', 'services', 'mixed'].includes(String(data.profileId)) ||
    data.version !== 1 ||
    !Array.isArray(data.tools) ||
    data.tools.length > TOOL_IDS.length ||
    data.tools.some((tool) => !TOOL_IDS.includes(tool as ToolId)) ||
    new Set(data.tools).size !== data.tools.length ||
    (data.tools.includes('purchases') && !data.tools.includes('inventory'))
  )
    throw new Error(
      'Revisa el perfil, su versión y las herramientas compatibles. Compras requiere Inventario.',
    );
  // El orden es estable para comparar solicitudes y evitar cambios solo de presentación.
  return {
    profileId: data.profileId as ProfileId,
    version: 1,
    ...('industryId' in data ? { industryId: data.industryId as IndustryId } : {}),
    tools: TOOL_IDS.filter((tool) => (data.tools as unknown[]).includes(tool)),
  };
}
export function configurationActivity(
  config: BusinessConfiguration,
): 'commerce' | 'services' | 'mixed' {
  return config.tools.includes('services')
    ? config.tools.includes('inventory')
      ? 'mixed'
      : 'services'
    : 'commerce';
}
export function defaultConfiguration(profileId: ProfileId): BusinessConfiguration {
  return { profileId, version: 1, tools: [...PROFILE_DEFAULTS[profileId]] };
}
export function toggleTool(
  config: BusinessConfiguration,
  tool: ToolId,
  enabled: boolean,
): BusinessConfiguration {
  const selected = new Set(config.tools);
  if (enabled) {
    selected.add(tool);
    if (tool === 'purchases') selected.add('inventory');
  } else {
    selected.delete(tool);
    if (tool === 'inventory') selected.delete('purchases');
  }
  return validateConfiguration({ ...config, tools: [...selected] });
}
// Los negocios anteriores mantienen todas sus herramientas hasta elegir explícitamente un perfil.
export function enabledTools(business: {
  configuration?: BusinessConfiguration;
}): readonly ToolId[] {
  return business.configuration?.tools ?? TOOL_IDS;
}

export function industryConfiguration(industryId: IndustryId): BusinessConfiguration {
  return { ...defaultConfiguration(INDUSTRIES[industryId].profile), industryId };
}
