export function validateCredentials(email: string, password: string, registering: boolean): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Escribe un correo electrónico válido.';
  if (!password || (registering && password.length < 12)) return 'Usa una contraseña de al menos 12 caracteres.';
  return null;
}
