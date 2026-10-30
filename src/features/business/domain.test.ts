import { expect, it } from 'vitest';
import { businessName } from './domain';
it('normaliza los bordes del nombre', () => expect(businessName('  Tienda La Paz  ')).toBe('Tienda La Paz'));
it.each(['', ' ', 'A', 'x'.repeat(81), 'Tienda\nNueva'])('rechaza un nombre inválido: %j', (name) => expect(() => businessName(name)).toThrow());
