export interface Business {
  id: string; ownerUid: string; name: string; currency: 'BOB'; timeZone: 'America/La_Paz';
  createdAt: Date; updatedAt: Date;
}
export interface BusinessRepository {
  get: (uid: string) => Promise<Business | null>;
  create: (uid: string, name: string) => Promise<Business>;
  rename: (uid: string, name: string) => Promise<Business>;
}
export function businessName(value: string): string {
  const name = value.trim();
  if (name.length < 2 || name.length > 80 || /[\r\n]/.test(name)) throw new Error('El nombre debe tener entre 2 y 80 caracteres en una sola línea.');
  return name;
}
