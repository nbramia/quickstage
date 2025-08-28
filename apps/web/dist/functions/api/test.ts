// Simple test function to verify Pages Functions are working
export async function onRequest(context: any): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);
  
  console.log('Test function invoked:', request.url);
  console.log('Request method:', request.method);
  console.log('Request headers:', Object.fromEntries(request.headers.entries()));
  
  return new Response(JSON.stringify({ 
    message: 'Pages Function working!',
    timestamp: new Date().toISOString(),
    url: request.url,
    method: request.method,
    pathname: url.pathname,
    headers: Object.fromEntries(request.headers.entries())
  }), {
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    }
  });
}
