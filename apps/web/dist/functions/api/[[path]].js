// Cloudflare Pages Function to proxy /api/* requests to the Worker
export async function onRequest(context) {
  try {
    console.log('Pages Function invoked:', context.request.url);
    const { request, env } = context;
    const url = new URL(request.url);
    
    // Get the path after /api/
    const apiPath = url.pathname.replace(/^\/api/, '');
    console.log('API path:', apiPath);
    
    // Construct the Worker URL
    const workerUrl = `https://quickstage-worker.nbramia.workers.dev${apiPath}${url.search}`;
    console.log('Proxying to:', workerUrl);
    console.log('Request method:', request.method);
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));
    
    // Forward the request to the Worker
    const workerRequest = new Request(workerUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    
    // Get response from Worker
    const response = await fetch(workerRequest);
    console.log('Worker response status:', response.status);
    console.log('Worker response headers:', Object.fromEntries(response.headers.entries()));
    
    // Return the response with CORS headers
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers),
        'Access-Control-Allow-Origin': url.origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
    
    return newResponse;
  } catch (error) {
    console.error('Pages Function error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  }
}

// Handle CORS preflight
export async function onRequestOptions(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': url.origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
