// A simple Worker that serves static assets from the ASSETS binding
// with SPA routing (all paths -> index.html for non-file requests)

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Try to serve the requested path from static assets
    const response = await env.ASSETS.fetch(request);
    
    // If the asset was found, return it
    if (response.status !== 404) {
      return response;
    }
    
    // SPA fallback: serve index.html for all non-file routes
    // Only apply SPA fallback for navigation-like paths (not API calls)
    if (!url.pathname.startsWith('/api/')) {
      const indexResponse = await env.ASSETS.fetch(new Request(
        new URL('/index.html', url),
        request
      ));
      
      if (indexResponse.status === 200) {
        return indexResponse;
      }
    }
    
    // If nothing works, return the original 404
    return response;
  }
};