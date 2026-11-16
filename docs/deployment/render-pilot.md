# KhypuPyme 1.0 · Piloto privado en Render

Usa el plan **Free** de Render y **Spark** en Firebase. Firestore sigue guardando los datos del proyecto `khypupyme-piloto`. Empieza con datos ficticios. El simulador de tarjeta aprueba o rechaza el pago, permite cancelarlo y simula un reembolso. Los planes de 30 días, 6 meses y 1 año conservan sus precios y vigencias. Los datos del emulador no se importan al piloto.

## Firebase

1. Abre `khypupyme-piloto` en Firebase. En **Firestore Database**, crea la base Standard `(default)` en modo producción si sigue pendiente. Mantén Spark.
2. En **Authentication → Sign-in method**, habilita **Correo electrónico/contraseña**. En **Users**, crea tu cuenta de prueba y copia su **UID**. Verificarás tu correo desde el botón **Verificar correo** del panel del plan. El piloto usa el enlace de Firebase para esa cuenta. El registro público por código permanece en la simulación local y en la configuración prevista de producción con correo propio.
3. En **Configuración del proyecto → General → Tus apps**, registra una aplicación **Web** y toma `apiKey` y `appId`. Usa la configuración del proyecto piloto.
4. En **Google Cloud → IAM y administración → Cuentas de servicio**, crea una cuenta de servicio exclusiva de este proyecto. Otórgale **Cloud Datastore User** (`roles/datastore.user`) y **Firebase Authentication Viewer** (`roles/firebaseauth.viewer`). En **Claves → Agregar clave → Crear clave nueva**, genera el JSON. Guárdalo directamente en Render como variable secreta. El JSON no va en GitHub, correo ni chat.
5. Para aplicar las reglas privadas e índices, desde la carpeta del proyecto ejecuta `pnpm exec firebase login` y `pnpm exec firebase deploy --only firestore --config firebase.pilot.json --project khypupyme-piloto`. Espera que los índices terminen de construirse antes de probar listas e informes. La configuración publica únicamente las reglas e índices de Firestore.

## Render

1. Abre el panel de Render, entra con GitHub y elige **New → Blueprint**. Conecta el repositorio `Ramiro-sakv/khypupyme-app`. Selecciona la rama `feat/piloto-render` y el archivo `render.yaml`. Confirma que el servicio indique **Free**. El Blueprint ya incluye compilación, arranque, verificación y la configuración del proyecto. Puedes desactivar también **Auto Sync** en los ajustes del Blueprint para controlar sus cambios manualmente.
2. Completa los cuatro valores solicitados. No añadas un método de pago.

| Campo de Render | Dato |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | `apiKey` de la aplicación Web en Firebase |
| `VITE_FIREBASE_APP_ID` | `appId` de esa misma aplicación |
| `KHYPU_PILOT_UID` | UID exacto de tu usuario de prueba |
| `KHYPU_FIREBASE_SERVICE_ACCOUNT` | Contenido JSON completo de la clave privada de servicio |

3. Aplica el Blueprint y espera a que el servicio esté **Live**. Abre su dirección `https://…onrender.com`. La web se puede abrir desde Android y Windows. El servidor comercial verifica el token y exige que corresponda al único UID configurado. Después de 15 minutos sin uso, el primer acceso puede tardar alrededor de un minuto.
4. Ingresa, crea un negocio y abre **Plan del negocio**. Elige **Verificar correo** si todavía no lo hiciste. Abre el enlace recibido, vuelve y pulsa el mismo botón para actualizar tu sesión. Prueba un pase, la tarjeta ficticia y un reembolso. Para probar ventas y caja usa productos y personas inventados.

Para habilitar **Continuar con Google** en el navegador, añade la dirección de Render a los dominios autorizados de Firebase Auth, activa Google y configura `VITE_KHYPU_AUTH_PORTAL_ORIGIN` con esa URL HTTPS en Render. El acceso a los datos sigue limitado al UID configurado. El flujo nativo de Google y la entrega de códigos por un remitente propio corresponden al perfil alojado de producción.

## Instaladores para este piloto

Usa los valores públicos del Blueprint y fija `VITE_KHYPU_PILOT_ORIGIN` a la URL HTTPS definitiva de Render en la terminal local. Con esa configuración, `pnpm windows:build:hosted` genera el instalador de Windows y `pnpm android:build` genera el APK de prueba. La credencial JSON solo la usa el servidor. La publicación en tiendas y los cobros reales requieren sus cuentas y pruebas independientes.
