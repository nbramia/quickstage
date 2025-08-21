// Cloudflare Pages Worker for handling routing
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    console.log('🔄 Pages Worker: Request received:', {
      url: request.url,
      pathname: url.pathname,
      method: request.method
    });
    
    // Handle /s/* routes by proxying to the main worker
    if (url.pathname.startsWith('/s/')) {
      console.log('🔄 Pages Worker: Proxying /s/* request to main worker');
      
      // Construct the worker URL
      const workerUrl = `https://quickstage-worker.nbramia.workers.dev${url.pathname}${url.search}`;
      console.log('🔄 Pages Worker: Worker URL:', workerUrl);
      
      try {
        // Create a simple request to the worker
        const workerResponse = await fetch(workerUrl, {
          method: request.method,
          headers: {
            'User-Agent': request.headers.get('User-Agent') || 'QuickStage-Pages-Worker',
            'Accept': request.headers.get('Accept') || '*/*',
            'Accept-Language': request.headers.get('Accept-Language') || 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache'
          }
        });
        
        console.log('📥 Pages Worker: Response from main worker:', {
          status: workerResponse.status,
          statusText: workerResponse.statusText,
          headers: Object.fromEntries(workerResponse.headers.entries())
        });
        
        // Return the response directly
        return new Response(workerResponse.body, {
          status: workerResponse.status,
          statusText: workerResponse.statusText,
          headers: workerResponse.headers,
        });
      } catch (error) {
        console.error('❌ Pages Worker: Error proxying to main worker:', error);
        
        return new Response(
          JSON.stringify({
            error: 'Proxy error',
            message: error.message || 'Unknown error',
            timestamp: new Date().toISOString(),
            path: url.pathname
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
    
    // For all other routes, let Pages handle normally
    console.log('🔄 Pages Worker: Letting Pages handle normal route:', url.pathname);
    return env.ASSETS.fetch(request);
  }
};
