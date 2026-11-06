import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  configurationActivity,
  defaultConfiguration,
  enabledTools,
  toggleTool,
  validateConfiguration,
  TOOL_IDS,
} from '../../../shared/business-configuration';
import type { BusinessConfiguration } from '../../../shared/business-configuration';
import { ProfilePicker } from './ProfilePicker';

describe('perfiles y compatibilidad', () => {
  it('conserva todas las herramientas de negocios anteriores sin escribir datos', () =>
    expect(enabledTools({})).toEqual(TOOL_IDS));
  it.each(['retail', 'services', 'mixed'] as const)('valida el perfil completo %s', (profile) =>
    expect(validateConfiguration(defaultConfiguration(profile)).profileId).toBe(profile),
  );
  it.each([
    null,
    {},
    { ...defaultConfiguration('retail'), version: 2 },
    { ...defaultConfiguration('retail'), profileId: 'wood' },
    { ...defaultConfiguration('retail'), ownerUid: 'B' },
    { ...defaultConfiguration('retail'), tools: ['factory'] },
    { ...defaultConfiguration('retail'), tools: ['inventory', 'inventory'] },
    { ...defaultConfiguration('retail'), tools: ['purchases'] },
  ])('rechaza configuración desconocida o incompatible %j', (value) =>
    expect(() => validateConfiguration(value)).toThrow(),
  );
  it('activa Inventario con Compras y retira Compras al desactivar Inventario, sin mutar el original', () => {
    const original = defaultConfiguration('services'),
      withPurchases = toggleTool(original, 'purchases', true);
    expect(withPurchases.tools).toEqual(
      expect.arrayContaining(['inventory', 'purchases', 'services']),
    );
    expect(configurationActivity(withPurchases)).toBe('mixed');
    expect(toggleTool(withPurchases, 'inventory', false).tools).toEqual(original.tools);
    expect(original.tools).not.toContain('inventory');
  });
  it('presenta una elección explícita, vista previa y combinación de herramientas', () => {
    function Picker() {
      const [value, setValue] = useState<BusinessConfiguration | null>(null);
      return <ProfilePicker value={value} onChange={setValue} />;
    }
    render(<Picker />);
    expect(
      screen.queryByRole('region', { name: 'Vista previa del perfil' }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tipo de negocio'), { target: { value: 'services' } });
    expect(screen.getByRole('region', { name: 'Vista previa del perfil' })).toHaveTextContent(
      'precios y costos directos',
    );
    expect(screen.getByLabelText('Inventario')).not.toBeChecked();
    fireEvent.click(screen.getByLabelText('Compras'));
    expect(screen.getByLabelText('Inventario')).toBeChecked();
    fireEvent.click(screen.getByLabelText('Inventario'));
    expect(screen.getByLabelText('Compras')).not.toBeChecked();
  });
});
