import { expect, it } from 'vitest';
import { validateCredentials } from './validation';
it('acepta registro con correo y contraseña suficientes', () => expect(validateCredentials(' prueba@example.invalid ', 'una-frase-segura', true)).toBeNull());
it('rechaza correo inválido', () => expect(validateCredentials('prueba', 'una-frase-segura', true)).not.toBeNull());
it('rechaza contraseñas cortas al registrar', () => expect(validateCredentials('a@example.invalid', 'corta', true)).not.toBeNull());
it('permite ingresar con una contraseña existente más corta', () => expect(validateCredentials('a@example.invalid', 'anterior', false)).toBeNull());
