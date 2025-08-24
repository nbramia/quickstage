// Cloudflare Pages Worker for routing
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    console.log('Pages Worker invoked:', pathname);
    
    // Handle /api/* routes - proxy to Worker
    if (pathname.startsWith('/api/')) {
      try {
        console.log('Proxying API request to Worker:', pathname);
        
        // Get the path after /api/
        const apiPath = pathname.replace(/^\/api/, '');
        const workerUrl = `https://quickstage-worker.nbramia.workers.dev${apiPath}${url.search}`;
        
        console.log('Proxying to Worker URL:', workerUrl);
        
        // Forward the request to the Worker
        const workerRequest = new Request(workerUrl, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        });
        
        // Get response from Worker
        const response = await fetch(workerRequest);
        console.log('Worker response status:', response.status);
        
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
        console.error('Error proxying to Worker:', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    }
    
    // Handle /s/* routes - redirect to Worker
    if (pathname.startsWith('/s/')) {
      try {
        console.log('Handling /s/* route:', pathname);
        
        // Extract snapshot ID
        const pathParts = pathname.split('/');
        const snapshotId = pathParts[2];
        
        if (snapshotId) {
          // Redirect to Worker
          const workerUrl = `https://quickstage-worker.nbramia.workers.dev${pathname}`;
          console.log('Redirecting to Worker:', workerUrl);
          
          return Response.redirect(workerUrl, 302);
        } else {
          return new Response('Invalid snapshot URL', { status: 400 });
        }
      } catch (error) {
        console.error('Error handling /s/* route:', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    }
    
    // For all other routes, let Pages handle normally
    console.log('Letting Pages handle route:', pathname);
    return env.ASSETS.fetch(request);
  }
};
