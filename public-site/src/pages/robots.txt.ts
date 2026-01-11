import type { APIRoute } from 'astro';
import { absoluteUrl } from '../lib/seo';

export const GET: APIRoute = () => {
  const robotsTxt = `User-agent: *
Allow: /
Allow: /welcome/
Allow: /articles/
Allow: /articles/*
Allow: /privacy/
Allow: /terms/
Allow: /disclaimer/
Allow: /accessibility/
Allow: /contact/

# Disallow admin routes
Disallow: /admin/
Disallow: /admin/*

# Disallow API routes (if any)
Disallow: /api/

# Disallow report-problem (internal tool)
Disallow: /report-problem/

# Sitemap location
Sitemap: ${absoluteUrl('/sitemap.xml')}
`;

  return new Response(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400'
    }
  });
};

