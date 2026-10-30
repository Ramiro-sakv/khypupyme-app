export function errorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : '';
  switch (code) {
    case 'auth/email-already-in-use': return 'Ese correo ya tiene una cuenta. Intenta ingresar o recuperar tu contraseña.';
    case 'auth/invalid-email': return 'Revisa el correo electrónico.';
    case 'auth/weak-password': return 'Usa una contraseña de al menos 12 caracteres.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password': return 'No pudimos ingresar con esos datos. Revisa tu correo y contraseña.';
    case 'auth/too-many-requests': return 'Hubo demasiados intentos. Espera un momento y vuelve a intentar.';
    case 'permission-denied': return 'No tienes permiso para realizar esta operación.';
    case 'unavailable':
    case 'auth/network-request-failed': return 'No se confirmó la operación. Comprueba la conexión y que los emuladores estén encendidos.';
    default: return 'No pudimos completar la operación. Vuelve a consultar antes de intentarlo otra vez.';
  }
}
