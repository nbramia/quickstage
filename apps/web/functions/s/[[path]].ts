// Cloudflare Pages Function to handle /s/* routes and proxy to the Worker
export async function onRequest(context: any): Promise<Response> {
  try {
    const { request } = context;
    const url = new URL(request.url);
    
    console.log('🚀 Pages Function /s/[[path]] invoked:', {
      fullUrl: request.url,
      pathname: url.pathname,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries())
    });

    // Get the full path after /s/
    const fullPath = url.pathname;
    const queryString = url.search;
    
    // Construct the Worker URL
    const workerUrl = `https://quickstage-worker.nbramia.workers.dev${fullPath}${queryString}`;
    console.log('🔄 Proxying to worker:', workerUrl);

    // Create headers for the worker request, excluding problematic ones
    const headers = new Headers();
    for (const [key, value] of request.headers.entries()) {
      // Skip headers that might cause issues with the proxy
      if (!['host', 'origin', 'referer'].includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    }
    
    // Add our own headers
    headers.set('x-forwarded-for', request.headers.get('cf-connecting-ip') || 'unknown');
    headers.set('x-forwarded-proto', url.protocol.replace(':', ''));
    headers.set('x-forwarded-host', url.host);

    // Forward the request to the Worker
    const workerRequest = new Request(workerUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'manual',
    });

    console.log('📤 Sending request to worker...');
    
    // Get response from Worker with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      const response = await fetch(workerRequest, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log('📥 Worker response received:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      // Return the response directly
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Worker request timed out');
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('❌ Pages Function error (/s/ proxy):', error);
    
    // Return a more helpful error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Full error details:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Proxy error',
        message: errorMessage,
        timestamp: new Date().toISOString(),
        path: context?.request?.url || 'unknown'
      }),
      {
        status: 502,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
      }
    );
  }
}
