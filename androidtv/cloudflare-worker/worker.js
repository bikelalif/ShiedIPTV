// ShieldIPTV CORS Proxy Worker
// Deploy this on Cloudflare Workers to proxy HTTP IPTV API calls and streams through HTTPS

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing ?url= parameter' }), {
        status: 400,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
      });
    }

    try {
      const targetResponse = await fetch(targetUrl, {
        method: request.method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      // Stream the response back with CORS headers
      const responseHeaders = new Headers(targetResponse.headers);
      Object.entries(corsHeaders()).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });

      return new Response(targetResponse.body, {
        status: targetResponse.status,
        headers: responseHeaders
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
      });
    }
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400'
  };
}
