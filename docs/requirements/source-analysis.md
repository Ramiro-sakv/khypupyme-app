# Análisis documental y alcance

Fuente leída íntegramente: **KhypuPyme: Dossier Final de Startup Tecnológica, Final V2**, 30/06/2026, Ramiro Huarachi y Paulo Sevilla, UPB. PDF de 21 páginas aportado por el propietario. SHA-256: `D8E82573E652ECEB231DADCEDC23DC5F72F21951BC4B45A66B13E476A3B3B0E6`. No se copia el PDF al repositorio público.

## Evidencia por páginas

| Páginas | Contenido y conclusiones documentadas |
| --- | --- |
| 1 | Control v1, v2, Final V2 y resumen del problema: registros dispersos. |
| 2 | Cuaderno digital; no ERP. Entrevistas preliminares descritas: rechazo del vocabulario contable y abandono sobre un minuto. No hay muestra, tiempos cronometrados ni datos primarios anexos para certificar esos hallazgos. |
| 3 | Dueños/encargados, propietario comprador, familia/personal y contador externo. Early adopters: ya usan celular/WhatsApp. |
| 4–5 | Valor: registro rápido, gastos visibles, reposición, cobro de fiados y tablero. Lean Canvas: WhatsApp, mercados y redes; freemium/básico/pro y apoyo de configuración. Costos de desarrollo, dominio, Firebase y soporte. |
| 6–7 | MVP: perfil, venta/gasto con monto/fecha/descripción, stock mínimo, fiados, tablero, periodos y exportación limitada. RF-01 a RF-07. |
| 8 | RNF-01, 02, 03, 05 y 06; PB-01 a PB-04. El original omite RNF-04. |
| 9–10 | PB-05 a PB-08 y cinco historias: ventas, gastos, stock, fiados y reportes, con criterios Dado/Cuando/Entonces. Arquitectura preliminar. |
| 11–12 | Responsabilidades de PWA, Auth, Firestore, Storage y reglas. Android/iOS/escritorio, objetivos responsive; dominio/HTTPS, términos, privacidad y QA antes del lanzamiento. |
| 13–14 | Plan gratuito limitado, básico con respaldos, Pro multiusuario/reportes avanzados y apoyo puntual. Sin intermediación de dinero, facturación oficial no certificada ni comercialización de bases de clientes; exportación y baja. Son límites del dossier, no una auditoría legal concluida. |
| 14–17 | Riesgos: abandono, inflación del alcance, fuga de información, mala configuración, incompatibilidad responsive, costos, dependencia de IA y lenguaje ajeno al comerciante. Responsables de producto, técnico, UX/QA y negocio. |
| 17–18 | Sprint 1: prototipo validado y Firebase; Sprint 2: ventas/gastos/stock; Sprint 3: aislamiento, fiados y CSV. Métricas piloto propuestas. |
| 19–20 | Roles del equipo y declaración de IA: se descartó cobro bancario QR y modelo relacional con joins. No constituyen pruebas del código actual. |
| 20–21 | Evidencia del prototipo es **descriptiva**: dashboard, ticket de productos/monto libre, efectivo/QR/transferencia y reportes. No hay capturas ni enlace del prototipo adjuntos. Cifras Bs 0/Bs 32 son ejemplos del prototipo, no registros reales. Referencias INE, ATT, SIN, materia y documentación técnica sin URLs precisas. |

## Historias y aceptación originales (sin inventar identificadores oficiales)

- **Venta:** monto válido → guardado → historial y saldo del tablero actualizados (RF-02/06, RNF-01).
- **Gasto:** categoría → confirmación → reduce saldo estimado (RF-03/06, RNF-05, relación documental conservada aunque RNF-05 trate respaldos).
- **Stock:** existencias debajo del mínimo → abrir tablero → alerta (RF-04/06).
- **Fiado:** nombre e importe → pendiente → pagado solo por confirmación explícita (RF-05, RNF-03).
- **Reporte:** rango → desglose consolidado y exportación (RF-07, RNF-06).

## Contradicciones y precisiones

1. Exportación: tabla MVP dice CSV/JSON (p. 7); RF-07 dice CSV o PDF (pp. 7–8); PB-07 CSV/PDF y Sprint 3 CSV (pp. 9,18). Se prepara CSV primero según instrucción del propietario; JSON/PDF son extensiones pendientes, no requisitos implementados.
2. RNF-05/PB-08 requieren almacenamiento asíncrono de reportes/respaldos en nube. No se eliminan de trazabilidad: **diferidos**, pues Storage y costos requieren aprobación. Un CSV no equivale a respaldo/restauración completa.
3. El Sprint 1 original propone infraestructura de producción. El propietario ordena emuladores primero y prohíbe despliegue automático. Se respeta ese cambio explícito.
4. El dossier describe coincidencia con un “token businessId”; un ID enviado por cliente no autoriza. Se propone verificar UID autenticado contra propietario inmutable en reglas.
5. RF-02/03 piden editar/eliminar; futura anulación lógica conservará evidencia, pero su equivalencia funcional y las devoluciones deben revisarse antes de desarrollar.
6. RNF-01 no se acredita con tests automáticos: requiere participantes reales, cronometraje y errores de flujo. RNF-02/06 tampoco se declaran conformes en hardware real solo por emulación.
7. “Saldo neto estimado” de la historia de gastos no se llamará ganancia neta. Ver definiciones propuestas en arquitectura.
8. La baja inmediata documentada (p.14) necesita política de conservación y tratamiento de datos, aún sin implementar; el borrado de negocio está bloqueado para no destruir historia futura.

## Backlog conservado y adaptación

| Original | Prioridad | Destino técnico |
| --- | --- | --- |
| PB-01 Perfil + administrador | Must | Fase 1 local; registro, ingreso y perfil |
| PB-02 Ventas CRUD | Must | Fase 2, después del punto de revisión |
| PB-03 Gastos CRUD | Must | Fase 2 |
| PB-04 Catálogo + stock | Must | Fase 2 |
| PB-05 Fiados + cobro | Must | Fase 3 |
| PB-06 Tablero | Must | Fases 2–3 |
| PB-07 Reportes | Should | Fase 3; CSV primero |
| PB-08 Respaldo nube | Should | Pendiente de autorización cloud y restauración |

Fase 0: auditoría y requisitos. Fase 1: base actual. Fases 2–3 mantienen los sprints comerciales originales; seguridad se incorpora desde Fase 1. Fase 4 añade estabilización y evaluación de accesibilidad/PWA. Fase 5 piloto autorizado; no hay participantes invitados ni datos reales.

Métricas futuras, sin seguimiento invasivo: tiempos reales de venta/gasto, errores, abandono, uso del tablero/fiados, operaciones semanales, retención y reportes. Para costos: lecturas/escrituras por flujo y negocio, índices y rangos, sin descargar historial completo. Registro de mediciones con participantes y consentimiento antes del piloto; no hay telemetría instalada.
