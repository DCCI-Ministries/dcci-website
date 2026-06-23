/**
 * Firebase Admin SDK integration for server-side Firestore access
 * Used only during Astro build time to fetch published articles
 */

import { getFirestoreAdmin } from './firebaseAdmin';
import { DEFAULT_WELCOME_CONTENT, mergeWelcomeContent, WelcomePageContent } from './welcomeContent';

/**
 * Article interface matching Firestore schema
 */
export interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  status: 'draft' | 'published';
  authorId: string;
  authorEmail: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  oldSlugs?: string[];
  tags?: string[];
  featuredImage?: string;
}

/**
 * Get all published articles
 */
export async function getPublishedArticles(): Promise<Article[]> {
  const db = getFirestoreAdmin();
  
  try {
    const articlesRef = db.collection('content');
    const snapshot = await articlesRef
      .where('status', '==', 'published')
      .orderBy('publishedAt', 'desc')
      .get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        slug: data.slug || '',
        excerpt: data.excerpt,
        content: data.content,
        status: data.status,
        authorId: data.authorId,
        authorEmail: data.authorEmail,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        publishedAt: data.publishedAt?.toDate(),
        oldSlugs: data.oldSlugs || [],
        tags: data.tags || [],
        featuredImage: data.featuredImage,
      } as Article;
    });
  } catch (error) {
    console.error('Error fetching published articles:', error);
    // If orderBy fails (index missing), try without it
    try {
      const articlesRef = db.collection('content');
      const snapshot = await articlesRef
        .where('status', '==', 'published')
        .get();

      const articles = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          slug: data.slug || '',
          excerpt: data.excerpt,
          content: data.content,
          status: data.status,
          authorId: data.authorId,
          authorEmail: data.authorEmail,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          publishedAt: data.publishedAt?.toDate(),
          oldSlugs: data.oldSlugs || [],
          tags: data.tags || [],
          featuredImage: data.featuredImage,
        } as Article;
      });

      // Sort by publishedAt descending
      return articles.sort((a, b) => {
        const aDate = a.publishedAt || a.createdAt;
        const bDate = b.publishedAt || b.createdAt;
        return bDate.getTime() - aDate.getTime();
      });
    } catch (fallbackError) {
      console.error('Error in fallback query:', fallbackError);
      return [];
    }
  }
}

/**
 * Get article by slug
 * Also checks oldSlugs for redirects
 */
export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const db = getFirestoreAdmin();
  
  try {
    // First, try to find by current slug
    const articlesRef = db.collection('content');
    const snapshot = await articlesRef
      .where('slug', '==', slug)
      .where('status', '==', 'published')
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        slug: data.slug || '',
        excerpt: data.excerpt,
        content: data.content,
        status: data.status,
        authorId: data.authorId,
        authorEmail: data.authorEmail,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        publishedAt: data.publishedAt?.toDate(),
        oldSlugs: data.oldSlugs || [],
        tags: data.tags || [],
        featuredImage: data.featuredImage,
      } as Article;
    }

    // If not found, check oldSlugs for redirects
    const allArticlesSnapshot = await articlesRef
      .where('status', '==', 'published')
      .get();

    for (const doc of allArticlesSnapshot.docs) {
      const data = doc.data();
      const oldSlugs = data.oldSlugs || [];
      if (oldSlugs.includes(slug)) {
        // Found in oldSlugs - return the article (caller should handle redirect)
        return {
          id: doc.id,
          title: data.title,
          slug: data.slug || '',
          excerpt: data.excerpt,
          content: data.content,
          status: data.status,
          authorId: data.authorId,
          authorEmail: data.authorEmail,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          publishedAt: data.publishedAt?.toDate(),
          oldSlugs: data.oldSlugs || [],
          tags: data.tags || [],
          featuredImage: data.featuredImage,
        } as Article;
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching article by slug:', error);
    return null;
  }
}

/**
 * Get welcome page content for static SEO page generation
 */
export async function getWelcomePageContent(): Promise<WelcomePageContent> {
  const db = getFirestoreAdmin();

  try {
    const doc = await db.collection('siteSettings').doc('welcome').get();
    if (!doc.exists) {
      return DEFAULT_WELCOME_CONTENT;
    }
    return mergeWelcomeContent(doc.data() as Partial<WelcomePageContent>);
  } catch (error) {
    console.error('Error fetching welcome page content:', error);
    return DEFAULT_WELCOME_CONTENT;
  }
}

