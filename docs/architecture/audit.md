# Auditoría inicial Windows y Git

Fecha: 30/10/2026. Directorio autorizado: `C:\Users\ramir\OneDrive\Documentos\ChatGPT\Proyecto de Grado`.

- Antes de cambios: carpeta vacía (0 elementos), sin `.git`. Git devolvía “not a git repository”; no había README, package.json, licencias, workflows, configuraciones, archivos aprovechables ni cambios locales que sobrescribir.
- GitHub conectado identificó `Ramiro-sakv/khypupyme-app`; la API de commits devolvió 409 “Git Repository is empty”. El propietario confirmó el repositorio y autorizó clonar/reconstruir. Se clonó directamente en la carpeta vacía y se comprobó origin fetch/push igual a `https://github.com/Ramiro-sakv/khypupyme-app.git`.
- Rama anunciada por el remoto: main; no existían commits ni ramas con historia. Se creó rama huérfana `chore/project-setup` por ser un repositorio aún sin primer commit. No hubo git init, reset, clean, borrado, push, cambio de permisos ni recreación de repositorio.
- Estrategia: primer commit local verificable, conservar todo historial desde ahora y respaldo remoto únicamente cuando se autorice push. El remoto vacío no permite recuperar código perdido anteriormente; revisar otras copias/ramas/repositorios sería otra búsqueda autorizada si se dispone de pistas.
- No se impuso licencia de terceros al producto; no existía licencia previa. `private: true` evita publicación accidental en npm; no cambia la visibilidad pública del repositorio.

| Herramienta | Evidencia | Resultado |
| --- | --- | --- |
| Git | ejecutable de Windows, `--version` | 2.53.0.windows.1 |
| Node | runtime de Codex, ejecutable comprobado directamente | 24.22.1 |
| npm | `npm.cmd --version`, `Get-Command npm*`, rutas Program Files, Roaming/npm y runtime | No disponible; instrucciones de reparación en README |
| pnpm | runtime Codex `bin/fallback/pnpm.cmd --version` | 11.25.0, utilizado sin instalación global |
| VS Code | instalación de usuario comprobada en auditoría previa | 1.133.0 |
| GitHub CLI | instalación de Windows comprobada | 2.91.0; no se usó para publicar |
| Java | inicialmente fuera del PATH; búsqueda acotada de JDK | `.jdks/openjdk-26.0.2.1`, `java -version` aprobado |
| Firebase CLI | no había instalación global | 15.34.2 como dependencia local del proyecto |
| PDF | pypdf + Poppler incluidos en runtime | 21 páginas extraídas completas con UTF-8; p.8 renderizada e inspeccionada para RF/RNF |

Riesgos antes de modificar: no había trabajo ajeno que preservar, pero faltaban dossier y confirmación de remoto; ambos recibidos antes de la reconstrucción. No se guarda el dossier ni información personal en el repositorio público. Java y Node del entorno no estaban resueltos de forma uniforme en PATH: `scripts/local.ps1` prepara únicamente el proceso local.
