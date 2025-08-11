// Simple hello function at root level  
export async function onRequest(): Promise<Response> {
  return new Response('Hello from Pages Functions!');
}
