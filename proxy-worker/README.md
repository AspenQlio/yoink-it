# YoinkIt: Twitter/X Proxy Worker 🛡️

Dado que X (Twitter) bloquea las peticiones de extracción (como las de `yt-dlp`) para contenido restringido (+18 o cuentas limitadas) si no se provee una cookie de inicio de sesión, la mejor forma de evadir esto **sin comprometer tu cuenta real** es usar un intermediario.

Para proteger tu dirección IP y evitar incrustar el intermediario directamente en el código de YoinkIt (lo que agotaría cuotas gratuitas si se hace público), puedes desplegar tu propio escudo 100% gratuito usando **Cloudflare Workers**.

## Guía de Instalación (5 minutos)

### 1. Crear el Worker en Cloudflare
1. Entra a [dash.cloudflare.com](https://dash.cloudflare.com) y crea una cuenta gratuita.
2. En el menú lateral izquierdo, ve a **Workers & Pages**.
3. Haz clic en **Create Application** y luego en **Create Worker**.
4. Ponle un nombre (por ejemplo: `yoink-x-proxy`) y dale a **Deploy**.

### 2. Subir el Código
1. Haz clic en el botón **Edit code** del Worker recién creado.
2. Borra todo el código que aparece ahí y pega el contenido completo del archivo `worker.js` que está en esta carpeta.
3. Haz clic arriba a la derecha en **Deploy** (Guardar y desplegar).

### 3. Configurar tu API Key Secreta (Seguridad)
Para evitar que cualquiera use tu proxy, le hemos puesto un cerrojo.
1. Sal del editor de código y vuelve a la página de detalles de tu Worker.
2. Ve a la pestaña **Settings** -> **Variables and Secrets**.
3. Añade una nueva variable:
   * **Name:** `EXPECTED_API_KEY`
   * **Value:** *(Inventa una contraseña secreta, ej: `YoinkItSuperSecret2026!+`)*
   * Dale a **Encrypt** para que quede como secreto, y guárdalo.

### 4. Conectar YoinkIt a tu Escudo
1. Copia la URL pública de tu Worker (Suele ser algo como `https://yoink-x-proxy.tu-usuario.workers.dev`).
2. En la carpeta raíz del proyecto React Native (`yoink-it/`), abre (o crea) tu archivo `.env`.
3. Añade estas dos líneas usando tu URL y tu clave inventada:

```env
EXPO_PUBLIC_X_PROXY_URL=https://yoink-x-proxy.tu-usuario.workers.dev
EXPO_PUBLIC_X_PROXY_KEY=YoinkItSuperSecret2026!+
```

¡Listo! A partir de ahora, cuando pegues un link de X en YoinkIt, la app detectará automáticamente tus credenciales en el `.env`, interceptará la descarga, y le pedirá a tu servidor de Cloudflare que consiga el archivo MP4 crudo. Si tus variables `.env` están vacías, YoinkIt usará `yt-dlp` como siempre de forma nativa (con las limitaciones que conlleva).
