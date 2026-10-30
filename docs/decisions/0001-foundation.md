# Decisión 0001: reconstrucción local y punto de revisión

Fecha: 30/10/2026. Estado: base autorizada; revisar antes del núcleo comercial.

**Documentado:** dossier Final V2, PWA, Auth/Firestore/Storage, RF-01–07 y RNF-01/02/03/05/06.

**Confirmado por el propietario:** repositorio único `Ramiro-sakv/khypupyme-app`, reconstrucción desde cero, React/TypeScript/Vite/Firebase, emuladores primero, sin push ni publicaciones. Se clonó el remoto, vacío, sin git init ni sustitución de código. Se creó `chore/project-setup`; no existían commits que recuperar o proteger en el remoto.

**Derivado/propuesto y resuelto técnicamente:** perfil por UID con propietario inmutable, esquema validado, repositorios inyectables, sesión por pestaña, Firestore sin persistencia en disco, BOB/La Paz fijos, CSS propio y PWA sin caché comercial. No se crean cuentas de servicio ni recursos cloud. Se usa pnpm disponible, sin instalar npm/Java globalmente.

**Decisiones pendientes de aprobación/revisión:**

1. Revisar arquitectura, estructura, autorización y resultados locales antes de ventas/inventario/gastos/fiados; este es el punto de control obligatorio.
2. Demostrar integridad comercial con reglas y transacciones acotadas, o autorizar componente confiable y revisar costos. No asumir seguridad por usar Firebase.
3. Autorizar proyecto Firebase de pruebas y servicios reales cuando corresponda; autenticar el propietario en su cuenta, sin proporcionar contraseñas ni claves privadas al agente.
4. RNF-05/PB-08: Storage, presupuesto y política de respaldo/restauración, posibles costos. No activados.
5. Alcance de monto libre, unidades fraccionarias, anulación/edición de operaciones y origen de fiados; validar definiciones de saldo/cobros antes de implementarlas.
6. Correo verificado, exportación/baja, retención, términos y privacidad; evaluación antes de usuarios reales. No se afirma revisión legal.
7. Plan de pruebas de usabilidad, teléfonos físicos y entorno piloto autorizado. Multiusuario Pro, abonos, suscripciones, bancos e IA predictiva siguen fuera del MVP actual.

CSV primero está ordenado por el prompt de ejecución; PDF/JSON se conservan como posibles extensiones sin afirmar cumplimiento de RNF-05. No se modifica el modelo comercial del dossier.
