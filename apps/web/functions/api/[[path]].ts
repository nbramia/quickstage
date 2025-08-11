// Cloudflare Pages Function to proxy /api/* requests to the Worker
export async function onRequest(context: any): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // Get the path after /api/
  const apiPath = url.pathname.replace(/^\/api/, '');
  
  // Construct the Worker URL
  const workerUrl = `https://quickstage-worker.nbramia.workers.dev${apiPath}${url.search}`;
  
  // Forward the request to the Worker
  const workerRequest = new Request(workerUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });
  
  // Get response from Worker
  const response = await fetch(workerRequest);
  
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
}

// Handle CORS preflight
export async function onRequestOptions(context: any): Promise<Response> {
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
