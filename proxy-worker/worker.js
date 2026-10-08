export default {
  async fetch(request, env) {
    // 1. Validar Método y CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "x-api-key, Content-Type",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
        }
      });
    }

    // 2. Seguridad: Validar API Key secreta
    // El valor de EXPECTED_API_KEY se define en el Dashboard de Cloudflare (Variables de entorno)
    const clientApiKey = request.headers.get("x-api-key");
    const expectedApiKey = env.EXPECTED_API_KEY;

    if (!expectedApiKey || clientApiKey !== expectedApiKey) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid or missing x-api-key" }), { 
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // 3. Procesar la URL
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: "Missing 'url' parameter" }), { 
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    try {
      // Extraer nombre de usuario e ID del tweet
      const tweetRegex = /(?:twitter\.com|x\.com)\/([^/]+)\/status\/(\d+)/;
      const match = targetUrl.match(tweetRegex);

      if (!match) {
        return new Response(JSON.stringify({ error: "Invalid Twitter/X URL" }), { 
          status: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      const username = match[1];
      const tweetId = match[2];

      // Usamos la API pública de vxTwitter como intermediario (disfrazándonos de Telegram)
      const apiUrl = `https://api.vxtwitter.com/${username}/status/${tweetId}`;
      
      const vxResponse = await fetch(apiUrl, {
        headers: {
          "User-Agent": "TelegramBot/1.0" // Requisito para que fxtwitter/vxtwitter devuelva la media
        }
      });

      if (!vxResponse.ok) {
        return new Response(JSON.stringify({ error: "External API failed to fetch tweet" }), { 
          status: 502,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      const data = await vxResponse.json();

      // Buscar si el tweet tiene video
      if (data.media_extended && data.media_extended.length > 0) {
        const video = data.media_extended.find(m => m.type === 'video');
        if (video) {
          return new Response(JSON.stringify({ 
            success: true, 
            title: data.text || "X Video",
            download_url: video.url 
          }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }
      }

      return new Response(JSON.stringify({ error: "No video found in this tweet" }), { 
        status: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  }
};
