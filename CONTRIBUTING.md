# Contribuir

Leer `AGENTS.md` y las decisiones antes de modificar el alcance. Crear una rama `feat/…`, `fix/…` o `chore/…`. Mantener cambios acotados y commits Conventional Commits.

Instalar con `pnpm install --frozen-lockfile`. Antes de commit: `pnpm check`, pruebas de emuladores según el cambio, revisión de diff y secretos. No incluir `.env.local`, datos de emuladores, PDF privado, capturas con datos reales ni credenciales. GitHub Actions contiene solo validación, sin despliegue.

Mantener la matriz de trazabilidad y el informe de validación con resultados reales. No rebajar tests ni abrir reglas por comodidad. El código comercial requiere la revisión previa del propietario prevista en Fase 1. Sin autorización no se hace push ni despliegue.
