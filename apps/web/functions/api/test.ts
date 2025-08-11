// Simple test function to verify Pages Functions are working
export async function onRequest(): Promise<Response> {
  return new Response(JSON.stringify({ 
    message: 'Pages Function working!',
    timestamp: new Date().toISOString()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
