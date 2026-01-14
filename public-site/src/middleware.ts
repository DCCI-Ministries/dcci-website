import type { MiddlewareHandler } from 'astro';

/**
 * Middleware to handle trailing slash redirects for Astro preview
 * 
 * Redirects paths without trailing slashes to paths with trailing slashes
 * (except root, files with extensions, and special paths)
 */
export const onRequest: MiddlewareHandler = (context, next) => {
  const { request, url } = context;
  const { method, url: requestUrl } = request;
  const pathname = new URL(requestUrl).pathname;

  // Only handle GET and HEAD requests
  if (method !== 'GET' && method !== 'HEAD') {
    return next();
  }

  // Don't redirect root path
  if (pathname === '/') {
    return next();
  }

  // Don't redirect if path already ends with slash
  if (pathname.endsWith('/')) {
    return next();
  }

  // Don't redirect files with extensions (assets)
  // Check if pathname contains a dot followed by common file extensions
  const hasFileExtension = /\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2|eot|ttf|otf|xml|txt|json|pdf|zip|mp4|webm|mp3|wav)$/i.test(pathname);
  if (hasFileExtension) {
    return next();
  }

  // Don't redirect special paths
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml') {
    return next();
  }
  
  // Don't redirect /_astro/* paths
  if (pathname.startsWith('/_astro/')) {
    return next();
  }
  
  // Don't redirect /favicon* paths (e.g., /favicon.svg)
  if (pathname.startsWith('/favicon')) {
    return next();
  }

  // Redirect to pathname with trailing slash, preserving query string
  const urlObj = new URL(requestUrl);
  urlObj.pathname = pathname + '/';
  const redirectUrl = urlObj.toString();

  return new Response(null, {
    status: 301,
    headers: {
      'Location': redirectUrl
    }
  });
};
