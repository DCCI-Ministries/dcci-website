import type { APIRoute } from 'astro';
import { getPublishedArticles, type Article } from '../lib/firestore';
import { absoluteUrl } from '../lib/seo';

export const GET: APIRoute = async () => {
  // Fetch all published articles at build time
  const articles: Article[] = await getPublishedArticles();

  const currentDate = new Date().toISOString().split('T')[0];

  // Build sitemap XML
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Homepage / Welcome -->
  <url>
    <loc>${absoluteUrl('/welcome/')}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>

  <!-- Articles Index -->
  <url>
    <loc>${absoluteUrl('/articles/')}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>

  <!-- Individual Articles -->
  ${articles.map((article: Article) => {
    const lastmod = article.updatedAt || article.publishedAt || article.createdAt;
    const lastmodDate = lastmod instanceof Date
      ? lastmod.toISOString().split('T')[0]
      : currentDate;

    return `  <url>
    <loc>${absoluteUrl(`/articles/${article.slug}/`)}</loc>
    <lastmod>${lastmodDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
  }).join('\n')}

  <!-- Privacy Policy -->
  <url>
    <loc>${absoluteUrl('/privacy/')}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>

  <!-- Terms of Service -->
  <url>
    <loc>${absoluteUrl('/terms/')}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>

  <!-- Disclaimer -->
  <url>
    <loc>${absoluteUrl('/disclaimer/')}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>

  <!-- Accessibility Statement -->
  <url>
    <loc>${absoluteUrl('/accessibility/')}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>

  <!-- Contact -->
  <url>
    <loc>${absoluteUrl('/contact/')}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};

