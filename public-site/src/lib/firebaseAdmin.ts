/**
 * Firebase Admin SDK initializer (server-only)
 * 
 * This module initializes Firebase Admin SDK using credentials from process.env.
 * It is designed to work only in server-side contexts (Astro build-time, API routes).
 * 
 * DO NOT import this in client-side code.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let firestoreAdminInstance: Firestore | null = null;

/**
 * Initialize Firebase Admin SDK using credentials from process.env
 * 
 * Reads from:
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_CLIENT_EMAIL
 * - FIREBASE_PRIVATE_KEY (handles escaped newlines)
 * 
 * Initializes only once (checks admin.apps.length)
 */
function initializeFirebaseAdmin(): Firestore {
  // Return existing instance if already initialized
  if (firestoreAdminInstance) {
    return firestoreAdminInstance;
  }

  // Check if Firebase Admin app is already initialized
  const existingApps = getApps();
  if (existingApps.length > 0) {
    firestoreAdminInstance = getFirestore(existingApps[0]);
    return firestoreAdminInstance;
  }

  // Read credentials from process.env
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin credentials missing. Required environment variables: ' +
      'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY'
    );
  }

  // Handle escaped newlines in private key (common in .env files)
  // Replace \\n with actual newlines
  const unescapedPrivateKey = privateKey.replace(/\\n/g, '\n');

  try {
    const app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: unescapedPrivateKey,
      }),
      projectId,
    });

    firestoreAdminInstance = getFirestore(app);
    return firestoreAdminInstance;
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    throw new Error(
      `Failed to initialize Firebase Admin SDK: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Exported Firestore Admin instance
 * 
 * This is initialized on first access and reused for subsequent calls.
 * Safe to import in Astro frontmatter and server-side contexts.
 */
export const firestoreAdmin = initializeFirebaseAdmin();
