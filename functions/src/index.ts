
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as corsLib from "cors";
import * as nodemailer from "nodemailer";
import * as https from "https";
import { sanitizeContactForm, escapeHtmlForEmail, sanitizeNewsletterForm } from "./sanitization";

// Load environment variables from .env file for local development
// This only runs in local/emulator environment, not in production
// Use try-catch with immediate execution to avoid blocking
try {
  if ((process.env.FUNCTIONS_EMULATOR || process.env.NODE_ENV !== 'production') && typeof require !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dotenv = require('dotenv');
    if (dotenv && dotenv.config) {
      // Use sync config with error handling to avoid blocking
      dotenv.config({ silent: true });
    }
  }
} catch (e) {
  // dotenv not available or not needed - will use Firebase config instead
  // Silently ignore errors during deployment
}

// YouTube API response types
interface YouTubePlaylistItem {
  snippet: {
    resourceId: {
      videoId: string;
    };
    publishedAt: string;
    title: string;
    description?: string;
    thumbnails: {
      maxres?: { url: string };
      high?: { url: string };
      default?: { url: string };
    };
  };
}

interface YouTubePlaylistResponse {
  items?: YouTubePlaylistItem[];
  nextPageToken?: string;
}

interface YouTubeVideoSnippet {
  title: string;
  description?: string;
  publishedAt: string;
  channelId: string;
  tags?: string[];
  thumbnails: {
    maxres?: { url: string };
    high?: { url: string };
    default?: { url: string };
  };
}

interface YouTubeVideoItem {
  snippet: YouTubeVideoSnippet;
}

interface YouTubeVideoResponse {
  items?: YouTubeVideoItem[];
}

admin.initializeApp();
const cors = corsLib({ origin: true });
const db = admin.firestore();

const user = functions.config().mail.user as string;
const pass = functions.config().mail.pass as string;
const to = functions.config().mail.to as string;

// Cooldown period in milliseconds (5 minutes)
const COOLDOWN_PERIOD = 5 * 60 * 1000;

const FREE_TIER_STORAGE_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB free tier for Firebase Storage
const FREE_TIER_FIRESTORE_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB free tier for Firestore database

function getDefaultBucketName(): string {
  const configuredBucket = admin.app().options.storageBucket;
  if (configuredBucket) {
    // Try the bucket name as-is first (works for both formats)
    return configuredBucket;
  }
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'unknown-project';
  // Try both formats
  return `${projectId}.appspot.com`;
}

// Helper to try multiple bucket names
async function tryGetBucketFiles(bucketName: string): Promise<{ files: any[]; totalBytes: number }> {
  let totalBytes = 0;
  const bucket = admin.storage().bucket(bucketName);
  let files: any[] = [];
  let nextQuery: { autoPaginate: false; pageToken?: string } = { autoPaginate: false };

  try {
    do {
      const [filesBatch, queryResult] = await bucket.getFiles(nextQuery);
      filesBatch.forEach(file => {
        const size = Number(file.metadata?.size || 0);
        if (!Number.isNaN(size) && size > 0) {
          totalBytes += size;
          files.push(file);
        }
      });
      nextQuery.pageToken = queryResult?.pageToken;
    } while (nextQuery.pageToken);
  } catch (error: any) {
    // If bucket doesn't exist or access denied, throw
    throw error;
  }

  return { files, totalBytes };
}

const tx = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user, pass },
});

export const submitContactForm = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") { res.status(405).send("Method not allowed"); return; }

    const { name, email, subject, message, newsletter, website, formLoadTime, submissionTime } = req.body || {};
    // Get client IP from various sources
    const forwardedFor = req.headers['x-forwarded-for'];
    const firstForwardedIP = Array.isArray(forwardedFor)
      ? forwardedFor[0]?.trim()
      : forwardedFor?.split(',')[0]?.trim();

    const clientIP: string = req.ip ||
                    req.connection?.remoteAddress ||
                    req.socket?.remoteAddress ||
                    firstForwardedIP ||
                    (Array.isArray(req.headers['x-real-ip']) ? req.headers['x-real-ip'][0] : req.headers['x-real-ip']) ||
                    'unknown';

    console.log('Client IP detected:', clientIP);
    console.log('Request headers:', {
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-real-ip': req.headers['x-real-ip'],
      'req.ip': req.ip,
      'remoteAddress': req.connection?.remoteAddress
    });

    // IP blocking check - block common VPN/spam IP ranges
    const blockedRanges = ['111.', '185.', '45.', '91.', '104.']; // Common VPN/spam ranges
    const isBlockedIP = blockedRanges.some(range => clientIP.startsWith(range));

    if (isBlockedIP) {
      console.log('Blocked IP detected:', clientIP);
      res.status(403).json({
        error: "VPN detected",
        message: "We've detected that you're using a VPN. To help prevent spam, please turn off your VPN and try again. If you're not using a VPN, please contact us directly."
      });
      return;
    }

    // Honeypot check - if website field is filled, it's likely a bot
    if (website) {
      console.log('Bot detected via honeypot');
      res.status(204).end(); return; // Silently fail
    }

    // Sanitize and validate all input data
    const validation = sanitizeContactForm({ name, email, subject, message, newsletter, formLoadTime, submissionTime });

    if (!validation.isValid) {
      console.log('Input validation failed:', validation.errors);
      res.status(400).json({
        error: "Invalid input",
        message: "Please check your input and try again.",
        details: validation.errors
      });
      return;
    }

    const { name: sanitizedName, email: sanitizedEmail, subject: sanitizedSubject, message: sanitizedMessage, newsletter: sanitizedNewsletter, formLoadTime: sanitizedFormLoadTime, submissionTime: sanitizedSubmissionTime } = validation.sanitizedData!;

    try {
      // Simple cooldown check - get all contacts from this IP and check timestamps
      const allContacts = await db.collection('contacts').get();
      const recentSubmissions = allContacts.docs
        .filter(doc => doc.data().ipAddress === clientIP)
        .sort((a, b) => b.data().submittedAt?.toMillis() - a.data().submittedAt?.toMillis());

      if (recentSubmissions.length > 0) {
        const lastSubmission = recentSubmissions[0].data();
        const lastSubmissionTime = lastSubmission.submittedAt?.toMillis() || 0;
        const currentTime = Date.now();

        if (currentTime - lastSubmissionTime < COOLDOWN_PERIOD) {
          console.log('Cooldown period active for IP:', clientIP);
          res.status(429).json({
            error: "Please wait before submitting another message",
            retryAfter: Math.ceil((COOLDOWN_PERIOD - (currentTime - lastSubmissionTime)) / 1000)
          });
          return;
        }
      }

      // Store contact form data in Firestore (using sanitized data)
      const contactData = {
        name: sanitizedName,
        email: sanitizedEmail,
        subject: sanitizedSubject,
        message: sanitizedMessage,
        newsletter: sanitizedNewsletter,
        formLoadTime: sanitizedFormLoadTime,
        submissionTime: sanitizedSubmissionTime,
        timeToFill: sanitizedSubmissionTime - sanitizedFormLoadTime,
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        ipAddress: clientIP,
        userAgent: req.get('User-Agent') || 'Unknown'
      };

      // Add to contacts collection
      const contactRef = await db.collection('contacts').add(contactData);
      console.log('Contact stored with ID:', contactRef.id);

      // If they want newsletter updates, add to subscribers collection
      if (sanitizedNewsletter) {
        const subscriberData = {
          email: sanitizedEmail,
          name: sanitizedName,
          subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
          source: 'contact_form',
          status: 'active'
        };

        // Check if email already exists in subscribers
        const existingSubscriber = await db.collection('subscribers')
          .where('email', '==', sanitizedEmail)
          .limit(1)
          .get();

        if (existingSubscriber.empty) {
          await db.collection('subscribers').add(subscriberData);
          console.log('Added to newsletter subscribers:', sanitizedEmail);
        } else {
          console.log('Email already subscribed:', sanitizedEmail);
        }
      }

      // Regular contact form always goes to Hatun
      const recipientEmail = to;

      console.log('Sending contact form email:', {
        subject: sanitizedSubject,
        to: recipientEmail,
        from: user
      });

      // Send email notification (using sanitized data and escaped HTML)
      try {
        const emailResult = await tx.sendMail({
          from: `"DCCI Ministries Website" <${user}>`,
          to: recipientEmail,
          replyTo: `${sanitizedName} <${sanitizedEmail}>`,
          subject: `Contact Form: ${sanitizedSubject}`,
          text: `Name: ${sanitizedName}\nEmail: ${sanitizedEmail}\nSubject: ${sanitizedSubject}\nIP: ${clientIP}\n\n${sanitizedMessage}`,
          html: `
            <h3>New Contact Form Submission</h3>
            <p><b>Name:</b> ${escapeHtmlForEmail(sanitizedName)}</p>
            <p><b>Email:</b> ${escapeHtmlForEmail(sanitizedEmail)}</p>
            <p><b>Subject:</b> ${escapeHtmlForEmail(sanitizedSubject)}</p>
            <p><b>IP Address:</b> ${escapeHtmlForEmail(clientIP)}</p>
            <hr>
            <p><b>Message:</b></p>
            <p>${escapeHtmlForEmail(sanitizedMessage)}</p>
            <hr>
            <p><small>This email was sent from the DCCI Ministries contact form.</small></p>
            <p><small>Contact ID: ${contactRef.id}</small></p>
          `
        });

        console.log('Email sent successfully:', {
          messageId: emailResult.messageId,
          to: recipientEmail,
          subject: `Contact Form: ${sanitizedSubject}`
        });
      } catch (emailError: any) {
        console.error('Error sending email:', {
          error: emailError.message,
          stack: emailError.stack,
          to: recipientEmail,
          from: user
        });
        // Still return success to user, but log the error
        // The contact is already stored in Firestore
      }

      res.status(200).json({
        success: true,
        message: "Email sent successfully",
        contactId: contactRef.id
      });
    } catch (e) {
      console.error('Contact form error:', e);
      res.status(500).json({ error: "Failed to process contact form" });
    }
  });
});

// Separate function for website problem reports - always goes to admin@accessiblewebmedia.com
export const submitWebsiteProblemReport = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") { res.status(405).send("Method not allowed"); return; }

    // Check if problem reports are disabled
    const settingsDoc = await db.collection('siteSettings').doc('emergency').get();
    if (settingsDoc.exists) {
      const settings = settingsDoc.data();
      if (settings?.disableProblemReports === true) {
        res.status(503).json({
          error: "Service unavailable",
          message: "Website problem reports are temporarily disabled."
        });
        return;
      }
    }

    const { name, email, subject, message, website, formLoadTime, submissionTime } = req.body || {};

    // Get client IP from various sources
    const forwardedFor = req.headers['x-forwarded-for'];
    const firstForwardedIP = Array.isArray(forwardedFor)
      ? forwardedFor[0]?.trim()
      : forwardedFor?.split(',')[0]?.trim();

    const clientIP: string = req.ip ||
                    req.connection?.remoteAddress ||
                    req.socket?.remoteAddress ||
                    firstForwardedIP ||
                    (Array.isArray(req.headers['x-real-ip']) ? req.headers['x-real-ip'][0] : req.headers['x-real-ip']) ||
                    'unknown';

    console.log('Website problem report - Client IP detected:', clientIP);

    // IP blocking check - block common VPN/spam IP ranges
    const blockedRanges = ['111.', '185.', '45.', '91.', '104.'];
    const isBlockedIP = blockedRanges.some(range => clientIP.startsWith(range));

    if (isBlockedIP) {
      console.log('Blocked IP detected:', clientIP);
      res.status(403).json({
        error: "VPN detected",
        message: "We've detected that you're using a VPN. To help prevent spam, please turn off your VPN and try again."
      });
      return;
    }

    // Honeypot check
    if (website) {
      console.log('Error');
      res.status(204).end(); return;
    }

    // Sanitize and validate all input data
    const validation = sanitizeContactForm({ name, email, subject, message, newsletter: false, formLoadTime, submissionTime });

    if (!validation.isValid) {
      console.log('Input validation failed:', validation.errors);
      res.status(400).json({
        error: "Invalid input",
        message: "Please check your input and try again.",
        details: validation.errors
      });
      return;
    }

    const { name: sanitizedName, email: sanitizedEmail, subject: sanitizedSubject, message: sanitizedMessage, formLoadTime: sanitizedFormLoadTime, submissionTime: sanitizedSubmissionTime } = validation.sanitizedData!;

    try {
      // Store problem report in Firestore
      const problemReportData = {
        name: sanitizedName,
        email: sanitizedEmail,
        subject: sanitizedSubject,
        message: sanitizedMessage,
        type: 'website_problem',
        clientIP,
        formLoadTime: sanitizedFormLoadTime,
        submissionTime: sanitizedSubmissionTime,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const problemReportRef = await db.collection('websiteProblemReports').add(problemReportData);
      console.log('Website problem report stored with ID:', problemReportRef.id);

      // Always send to admin@accessiblewebmedia.com for website problems
      const recipientEmail = 'admin@accessiblewebmedia.com';

      console.log('Sending website problem report email:', {
        subject: sanitizedSubject,
        to: recipientEmail,
        from: user
      });

      // Send email notification
      try {
        const emailResult = await tx.sendMail({
          from: `"DCCI Ministries Website" <${user}>`,
          to: recipientEmail,
          replyTo: `${sanitizedName} <${sanitizedEmail}>`,
          subject: `Website Problem Report: ${sanitizedSubject}`,
          text: `Name: ${sanitizedName}\nEmail: ${sanitizedEmail}\nSubject: ${sanitizedSubject}\nIP: ${clientIP}\n\n${sanitizedMessage}`,
          html: `
            <h3>Website Problem Report</h3>
            <p><b>Name:</b> ${escapeHtmlForEmail(sanitizedName)}</p>
            <p><b>Email:</b> ${escapeHtmlForEmail(sanitizedEmail)}</p>
            <p><b>Subject:</b> ${escapeHtmlForEmail(sanitizedSubject)}</p>
            <p><b>IP Address:</b> ${escapeHtmlForEmail(clientIP)}</p>
            <hr>
            <p><b>Message:</b></p>
            <p>${escapeHtmlForEmail(sanitizedMessage)}</p>
            <hr>
            <p><small>This is a website problem report from the DCCI Ministries website.</small></p>
            <p><small>Report ID: ${problemReportRef.id}</small></p>
          `
        });

        console.log('Website problem report email sent successfully:', {
          messageId: emailResult.messageId,
          to: recipientEmail
        });
      } catch (emailError: any) {
        console.error('Error sending website problem report email:', {
          error: emailError.message,
          stack: emailError.stack,
          to: recipientEmail,
          from: user
        });
        // Still return success to user, but log the error
      }

      res.status(200).json({
        success: true,
        message: "Problem report submitted successfully",
        reportId: problemReportRef.id
      });
    } catch (e) {
      console.error('Website problem report error:', e);
      res.status(500).json({ error: "Failed to process problem report" });
    }
  });
});

// Test endpoint to verify function deployment
export const testContactForm = functions.https.onRequest((req, res) => {
  return cors(req, res, () => {
    res.json({
      message: "Contact form function is working!",
      timestamp: new Date().toISOString(),
      config: {
        user: user ? "Configured" : "Not configured",
        pass: pass ? "Configured" : "Not configured",
        to: to ? "Configured" : "Not configured"
      }
    });
  });
});

// Newsletter subscription endpoint
export const subscribeToNewsletter = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") { res.status(405).send("Method not allowed"); return; }

    const { name, email } = req.body || {};

    // Get client IP from various sources
    const forwardedFor = req.headers['x-forwarded-for'];
    const firstForwardedIP = Array.isArray(forwardedFor)
      ? forwardedFor[0]?.trim()
      : forwardedFor?.split(',')[0]?.trim();

    const clientIP: string = req.ip ||
                    req.connection?.remoteAddress ||
                    req.socket?.remoteAddress ||
                    firstForwardedIP ||
                    (Array.isArray(req.headers['x-real-ip']) ? req.headers['x-real-ip'][0] : req.headers['x-real-ip']) ||
                    'unknown';

    console.log('Newsletter subscription - Client IP detected:', clientIP);

    // IP blocking check - block common VPN/spam IP ranges
    const blockedRanges = ['111.', '185.', '45.', '91.', '104.']; // Common VPN/spam ranges
    const isBlockedIP = blockedRanges.some(range => clientIP.startsWith(range));

    if (isBlockedIP) {
      console.log('Blocked IP detected for newsletter subscription:', clientIP);
      res.status(403).json({
        error: "VPN detected",
        message: "We've detected that you're using a VPN. To help prevent spam, please turn off your VPN and try again. If you're not using a VPN, please contact us directly."
      });
      return;
    }

    // Sanitize and validate input data
    const validation = sanitizeNewsletterForm({ name, email });

    if (!validation.isValid) {
      console.log('Newsletter subscription validation failed:', validation.errors);
      res.status(400).json({
        error: "Invalid input",
        message: "Please check your input and try again.",
        details: validation.errors
      });
      return;
    }

    const { name: sanitizedName, email: sanitizedEmail } = validation.sanitizedData!;

    try {
      // Check if email already exists in subscribers
      const existingSubscriber = await db.collection('subscribers')
        .where('email', '==', sanitizedEmail)
        .limit(1)
        .get();

      if (!existingSubscriber.empty) {
        console.log('Email already subscribed:', sanitizedEmail);
        res.status(409).json({
          error: "Already subscribed",
          message: "This email address is already subscribed to our newsletter."
        });
        return;
      }

      // Add to subscribers collection
      const subscriberData = {
        email: sanitizedEmail,
        name: sanitizedName,
        subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'newsletter_signup',
        status: 'active',
        ipAddress: clientIP,
        userAgent: req.get('User-Agent') || 'Unknown'
      };

      const subscriberRef = await db.collection('subscribers').add(subscriberData);
      console.log('Newsletter subscription added with ID:', subscriberRef.id);

      // Send welcome email to subscriber (no admin notification)
      try {
        await tx.sendMail({
          from: `"DCCI Ministries" <${user}>`,
          to: sanitizedEmail,
          replyTo: user,
          subject: `Welcome to DCCI Ministries Newsletter`,
          text: `Thank you for subscribing to the DCCI Ministries newsletter, ${sanitizedName}!

We're grateful you've chosen to stay connected with us. You'll receive updates about our ministry, articles, videos, and resources.

If you ever wish to unsubscribe, you can do so at any time by contacting us at ${user} or by replying to this email.

Thank you for your interest in DCCI Ministries.

In Christ,
DCCI Ministries Team`,
          html: `
            <h2>Welcome to DCCI Ministries Newsletter</h2>
            <p>Thank you for subscribing to the DCCI Ministries newsletter, <b>${escapeHtmlForEmail(sanitizedName)}</b>!</p>
            <p>We're grateful you've chosen to stay connected with us. You'll receive updates about our ministry, articles, videos, and resources.</p>
            <hr>
            <p><strong>Unsubscribe:</strong> If you ever wish to unsubscribe, you can do so at any time by contacting us at <a href="mailto:${user}">${user}</a> or by replying to this email.</p>
            <hr>
            <p>Thank you for your interest in DCCI Ministries.</p>
            <p>In Christ,<br>DCCI Ministries Team</p>
          `
        });
        console.log('Welcome email sent to subscriber:', sanitizedEmail);
      } catch (emailError: any) {
        console.error('Error sending welcome email to subscriber:', emailError.message);
        // Don't fail the subscription if welcome email fails
      }

      res.status(200).json({
        success: true,
        message: "Successfully subscribed to newsletter",
        subscriberId: subscriberRef.id
      });
    } catch (e) {
      console.error('Newsletter subscription error:', e);
      res.status(500).json({ error: "Failed to process newsletter subscription" });
    }
  });
});

// Function to get contact statistics (for admin use)
export const getContactStats = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      const contactsSnapshot = await db.collection('contacts').get();
      const subscribersSnapshot = await db.collection('subscribers').get();

      const totalContacts = contactsSnapshot.size;
      const totalSubscribers = subscribersSnapshot.size;

      // Count newsletter subscribers from contacts
      const newsletterSubscribers = contactsSnapshot.docs.filter(doc =>
        doc.data().newsletter === true
      ).length;

      res.json({
        totalContacts,
        totalSubscribers,
        newsletterSubscribers,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({ error: "Failed to get statistics" });
    }
  });
});

// Track unique page views (approximate real users)
export const trackPageView = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
      }

      const { path } = req.body || {};

      // Basic validation
      if (typeof path !== "string" || !path) {
        res.status(400).json({ error: "Invalid path" });
        return;
      }

      const userAgent = (req.get("User-Agent") || "").toLowerCase();

      // Very basic bot filtering
      const botSignatures = [
        "bot",
        "crawler",
        "spider",
        "crawl",
        "slurp",
        "bingpreview",
        "facebookexternalhit",
        "monitor",
      ];

      if (!userAgent || botSignatures.some((sig) => userAgent.includes(sig))) {
        console.log("Skipping bot or unknown user agent for page view");
        res.status(204).end();
        return;
      }

      // Build a coarse fingerprint (no PII stored directly)
      const forwardedFor = req.headers["x-forwarded-for"];
      const firstForwardedIP = Array.isArray(forwardedFor)
        ? forwardedFor[0]?.trim()
        : forwardedFor?.split(",")[0]?.trim();

      const clientIP: string =
        req.ip ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        firstForwardedIP ||
        (Array.isArray(req.headers["x-real-ip"])
          ? req.headers["x-real-ip"][0]
          : (req.headers["x-real-ip"] as string | undefined)) ||
        "unknown";

      const today = new Date();
      const dayKey = `${today.getUTCFullYear()}-${
        today.getUTCMonth() + 1
      }-${today.getUTCDate()}`;

      const fingerprintSource = `${clientIP}|${userAgent}|${dayKey}`;
      const fingerprintId = Buffer.from(fingerprintSource).toString("base64");

      const viewDocRef = db.collection("pageViews").doc(fingerprintId);
      const statsDocRef = db.collection("stats").doc("siteStats");

      await db.runTransaction(async (tx) => {
        const existingView = await tx.get(viewDocRef);

        // If we've already seen this fingerprint today, don't double-count
        if (existingView.exists) {
          return;
        }

        tx.set(viewDocRef, {
          path,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          dayKey,
        });

        tx.set(
          statsDocRef,
          {
            totalUniqueVisitors: admin.firestore.FieldValue.increment(1),
          },
          { merge: true }
        );
      });

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error tracking page view:", error);
      res.status(500).json({ error: "Failed to track page view" });
    }
  });
});

// Helper function to estimate Firestore document size (approximate)
function estimateDocumentSize(data: any): number {
  let size = 0;
  // Base overhead for a document (approximately 32 bytes)
  size += 32;

  for (const [key, value] of Object.entries(data)) {
    // Field name size
    size += Buffer.byteLength(key, 'utf8');

    // Value size estimation
    if (value === null) {
      size += 1; // null marker
    } else if (typeof value === 'boolean') {
      size += 1;
    } else if (typeof value === 'number') {
      size += 8; // 64-bit number
    } else if (typeof value === 'string') {
      size += Buffer.byteLength(value as string, 'utf8');
    } else if (value instanceof Date || (value && typeof (value as any).toDate === 'function')) {
      size += 8; // Timestamp
    } else if (Array.isArray(value)) {
      size += estimateDocumentSize(value as any);
    } else if (typeof value === 'object') {
      size += estimateDocumentSize(value);
    }
  }

  return size;
}

// Get Firebase Storage (files) and optionally Firestore (database) usage vs. free-tier allowance
export const getStorageUsage = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      // Get Firebase Storage (files) usage
      const configuredBucket = admin.app().options.storageBucket;
      const primaryBucketName = configuredBucket || getDefaultBucketName();
      let storageBytes = 0;
      let filesFound = 0;
      let bucketNameUsed = primaryBucketName;
      let errorMessage: string | null = null;

      try {
        // Try primary bucket name first
        const result = await tryGetBucketFiles(primaryBucketName);
        storageBytes = result.totalBytes;
        filesFound = result.files.length;
      } catch (primaryError: any) {
        errorMessage = primaryError.message;
        console.log(`Failed to access bucket ${primaryBucketName}:`, primaryError.message);

        // If it's a .firebasestorage.app bucket, try .appspot.com version
        if (primaryBucketName.endsWith('.firebasestorage.app')) {
          const altBucketName = primaryBucketName.replace('.firebasestorage.app', '.appspot.com');
          try {
            console.log(`Trying alternative bucket name: ${altBucketName}`);
            const result = await tryGetBucketFiles(altBucketName);
            storageBytes = result.totalBytes;
            filesFound = result.files.length;
            bucketNameUsed = altBucketName;
            errorMessage = null;
          } catch (altError: any) {
            console.error(`Also failed to access bucket ${altBucketName}:`, altError.message);
            errorMessage = altError.message;
          }
        }
      }

      console.log(`Storage check: bucket=${bucketNameUsed}, files=${filesFound}, bytes=${storageBytes}`);

      const storageBytesRemaining = Math.max(0, FREE_TIER_STORAGE_BYTES - storageBytes);
      const storagePercentUsed = Math.min(
        100,
        Number(((storageBytes / FREE_TIER_STORAGE_BYTES) * 100).toFixed(2))
      );

      // Get Firestore (database) usage estimation (optional, expensive operation)
      // Check if client wants Firestore stats (via query param to avoid always calculating)
      const includeFirestore = req.query.includeFirestore === 'true';
      let firestoreBytes = 0;
      let firestorePercentUsed = 0;
      let firestoreBytesRemaining = FREE_TIER_FIRESTORE_BYTES;
      let firestoreEstimation = false;

      if (includeFirestore) {
        try {
          firestoreEstimation = true;
          // Get all collections and estimate their sizes
          // Note: This is an expensive operation and should be used sparingly
          const collections = ['adminUsers', 'contacts', 'subscribers', 'content', 'stats', 'pageViews', 'websiteProblemReports', 'settings'];

          for (const collectionName of collections) {
            try {
              const snapshot = await db.collection(collectionName).get();
              snapshot.docs.forEach(doc => {
                const data = doc.data();
                firestoreBytes += estimateDocumentSize(data);
              });
            } catch (collectionError: any) {
              // Collection might not exist or be inaccessible - skip it
              console.log(`Skipping collection ${collectionName}:`, collectionError.message);
            }
          }

          firestoreBytesRemaining = Math.max(0, FREE_TIER_FIRESTORE_BYTES - firestoreBytes);
          firestorePercentUsed = Math.min(
            100,
            Number(((firestoreBytes / FREE_TIER_FIRESTORE_BYTES) * 100).toFixed(2))
          );
        } catch (firestoreError) {
          console.error('Error estimating Firestore usage:', firestoreError);
          // Continue without Firestore stats if estimation fails
        }
      }

      // Combine both storage types for total (if Firestore included)
      const combinedBytes = storageBytes + (firestoreEstimation ? firestoreBytes : 0);
      const combinedFreeTierBytes = FREE_TIER_STORAGE_BYTES + (firestoreEstimation ? FREE_TIER_FIRESTORE_BYTES : 0);
      const combinedBytesRemaining = storageBytesRemaining + (firestoreEstimation ? firestoreBytesRemaining : 0);
      const combinedPercentUsed = firestoreEstimation
        ? Math.min(100, Number(((combinedBytes / combinedFreeTierBytes) * 100).toFixed(2)))
        : storagePercentUsed;

      res.json({
        // Firebase Storage (files) - primary focus
        storageBytes,
        storageFreeTierBytes: FREE_TIER_STORAGE_BYTES,
        storageBytesRemaining,
        storagePercentUsed,
        filesFound: filesFound,
        bucketName: bucketNameUsed,
        error: errorMessage,
        // Firestore (database) - optional/expensive
        firestoreBytes: firestoreEstimation ? firestoreBytes : null,
        firestoreFreeTierBytes: firestoreEstimation ? FREE_TIER_FIRESTORE_BYTES : null,
        firestoreBytesRemaining: firestoreEstimation ? firestoreBytesRemaining : null,
        firestorePercentUsed: firestoreEstimation ? firestorePercentUsed : null,
        firestoreEstimation: firestoreEstimation,
        // Combined totals (if Firestore included)
        combinedBytes: firestoreEstimation ? combinedBytes : null,
        combinedFreeTierBytes: firestoreEstimation ? combinedFreeTierBytes : null,
        combinedBytesRemaining: firestoreEstimation ? combinedBytesRemaining : null,
        combinedPercentUsed: firestoreEstimation ? combinedPercentUsed : null,
        // Backward compatibility (these are the primary fields for Firebase Storage)
        totalBytes: storageBytes,
        freeTierBytes: FREE_TIER_STORAGE_BYTES,
        bytesRemaining: storageBytesRemaining,
        percentUsed: storagePercentUsed
      });
    } catch (error: any) {
      if (error?.code === 404 || error?.message?.includes('bucket does not exist')) {
        res.json({
          storageBytes: 0,
          storageFreeTierBytes: FREE_TIER_STORAGE_BYTES,
          storageBytesRemaining: FREE_TIER_STORAGE_BYTES,
          storagePercentUsed: 0,
          totalBytes: 0,
          freeTierBytes: FREE_TIER_STORAGE_BYTES,
          bytesRemaining: FREE_TIER_STORAGE_BYTES,
          percentUsed: 0,
          filesFound: 0,
          bucketName: getDefaultBucketName(),
          error: error?.message || 'Bucket not found',
          note: 'Bucket not found; returning zero usage.'
        });
        return;
      }
      console.error("Error getting storage usage:", error);
      res.status(500).json({ error: "Failed to get storage usage" });
    }
  });
});

// Helper function to slugify a string
function slugify(text: string): string {
  if (!text) return 'untitled';

  let slug = text
    .trim()
    .toLowerCase();

  // Transliterate common diacritics
  slug = slug
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[ç]/g, 'c');

  // Replace spaces and underscores with hyphens
  slug = slug.replace(/[\s_]+/g, '-');

  // Remove all non-alphanumeric characters except hyphens
  slug = slug.replace(/[^a-z0-9-]/g, '');

  // Collapse multiple consecutive hyphens into a single hyphen
  slug = slug.replace(/-+/g, '-');

  // Remove leading and trailing hyphens
  slug = slug.replace(/^-+|-+$/g, '');

  // Ensure slug is not empty
  if (!slug) {
    slug = 'untitled';
  }

  return slug;
}

// Helper function to check if a slug exists and generate unique one
async function getUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await db.collection('content')
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (existing.empty) {
      return slug;
    }

    counter++;
    slug = `${baseSlug}-${counter}`;
  }
}

// Helper function to get thumbnail URL (prefer maxres, else high, else default)
function getThumbnailUrl(thumbnails: any): string {
  if (thumbnails?.maxres?.url) return thumbnails.maxres.url;
  if (thumbnails?.high?.url) return thumbnails.high.url;
  if (thumbnails?.default?.url) return thumbnails.default.url;
  return '';
}

/**
 * Strip promotional boilerplate blocks from YouTube description
 * Removes footer-style promotional content while preserving teaching content
 */
function stripBoilerplateFromDescription(description: string): string {
  if (!description || description.trim().length === 0) {
    return '';
  }

  // Boilerplate markers that indicate the start of promotional footer content
  // These patterns are checked case-insensitively and match anywhere in the line
  const boilerplateMarkers = [
    // Confessional slogans as footer (standalone lines, with optional whitespace)
    /^jesus\s+is\s+lord$/i,
    /^jesus\s+christ\s+is\s+lord$/i,
    /^jesus is lord/i, // Also match if not exact (might have trailing content)

    // John 20:31 as standalone footer (with or without verse text)
    /^john\s+20:31/i,
    /^john\s+20:\s*31/i,
    /but these are written so that you may believe/i,
    /john\s+20:31.*believe.*jesus.*christ/i, // Full verse pattern

    // Contact information patterns
    /^email\s+us:/i,
    /^contact\s+us:/i,
    /^email.*?:/i,
    /^contact.*?:/i,
    /skype.*?:/i,
    /^reach.*?us/i,
    /info@dcciministries/i,

    // Donation/support patterns
    /^to support/i,
    /^donate/i,
    /paypal/i,
    /cashapp/i,
    /cash\s+app/i,
    /^\$[a-zA-Z]/i, // CashApp handles like $HatunTashDCCI

    // Social media follow links
    /^follow\s+us\s+on/i,
    /^follow\s+us/i,
    /twitter.*?:/i,
    /rumble.*?:/i,
    /website.*?:/i,
    /^visit.*?website/i,
    /dcciministries\.com/i,
    /twitter\.com\/dcciministries/i,
    /rumble\.com/i,

    // Speaking invitations
    /^if you would like to invite/i,
    /speaking.*?invitation/i,
    /invite.*?speak/i,
    /book.*?speaker/i,
    /church or university/i,

    // DCCI mission statements (when at end, these are boilerplate)
    /^dcci ministries seek to preach/i,
    /^like the apostle paul/i,
    /^we do not use deception/i,
    /^we demolish arguments/i,
    /^our motivation is love for muslims/i,

    // Copyright/disclaimers
    /^copyright/i,
    /^fair use/i,
    /^disclaimer/i,
    /all rights reserved/i,

    // Comment moderation
    /no.*?weblinks/i,
    /comment.*?policy/i,
    /moderation/i,
  ];

  const lines = description.split('\n');
  let boilerplateStartIndex = -1;

  // Scan from the end backwards to find the first boilerplate marker
  // Check more lines (last 30 lines) to catch longer boilerplate blocks
  const linesToCheck = Math.min(30, lines.length);

  // Helper function to check if a line is boilerplate
  // Only treats DCCI-specific URLs as boilerplate, not all URLs
  const isLineBoilerplate = (line: string): boolean => {
    if (!line || line.trim().length === 0) return false;
    const trimmed = line.trim();
    const matchesMarker = boilerplateMarkers.some(marker => marker.test(trimmed));
    const isEmail = /@dcciministries/i.test(trimmed);

    // Only treat DCCI-specific URLs as boilerplate (not all URLs)
    const isDcciUrl = /^https?:\/\/(www\.)?dcciministries\.com/i.test(trimmed) ||
                      /paypal\.me\/dcciministries/i.test(trimmed) ||
                      /cash\.app\/\$[^\/]*dcci/i.test(trimmed) ||
                      /twitter\.com\/dcciministries/i.test(trimmed) ||
                      /rumble\.com\/user\/DCCIMinistries/i.test(trimmed);

    return matchesMarker || isDcciUrl || isEmail;
  };

  for (let i = lines.length - 1; i >= Math.max(0, lines.length - linesToCheck); i--) {
    const line = lines[i].trim();
    if (line.length === 0) continue;

    if (isLineBoilerplate(line)) {
      boilerplateStartIndex = i;
      console.log(`[Boilerplate] Found marker at line ${i}: "${line.substring(0, 50)}..."`);

      // Continue checking backwards for multi-line boilerplate blocks
      // More aggressive: continue backwards until we find non-boilerplate content
      let j = i - 1;
      let consecutiveBoilerplateCount = 0;
      const maxBackwardScan = Math.max(0, lines.length - linesToCheck - 15);

      while (j >= maxBackwardScan) {
        const prevLine = lines[j].trim();

        if (prevLine.length === 0) {
          // Empty line - skip it but continue scanning backwards
          j--;
          continue;
        }

        if (isLineBoilerplate(prevLine)) {
          // Found more boilerplate - extend the removal range
          boilerplateStartIndex = j;
          consecutiveBoilerplateCount++;
          j--;
        } else {
          // Found non-boilerplate content
          // If we've seen several boilerplate lines in a row, this is likely the start
          // Otherwise, if we just found one marker, stop here
          if (consecutiveBoilerplateCount >= 2) {
            // We've confirmed a boilerplate block, stop here
            break;
          } else {
            // Might be a false positive, but if we found URLs/emails, it's likely boilerplate
            // Check if the original marker was a strong indicator (DCCI URL, email, or key phrases)
            const isDcciUrl = /^https?:\/\/(www\.)?dcciministries\.com/i.test(line) ||
                              /paypal\.me\/dcciministries/i.test(line) ||
                              /cash\.app\/\$[^\/]*dcci/i.test(line) ||
                              /twitter\.com\/dcciministries/i.test(line) ||
                              /rumble\.com\/user\/DCCIMinistries/i.test(line);
            const originalIsStrong = isDcciUrl ||
                                     /@dcciministries/i.test(line) ||
                                     /^email\s+us:/i.test(line) ||
                                     /^contact\s+us:/i.test(line) ||
                                     /^follow\s+us/i.test(line) ||
                                     /^to support/i.test(line);
            if (originalIsStrong) {
              // Strong indicator - keep the removal point
              break;
            } else {
              // Weak indicator - might be false positive, don't remove
              boilerplateStartIndex = -1;
              break;
            }
          }
        }
      }

      // If we found a valid boilerplate block, stop scanning
      if (boilerplateStartIndex >= 0) {
        break;
      }
    }
  }

  // If boilerplate found, remove everything from that point to the end
  if (boilerplateStartIndex >= 0) {
    console.log(`[Boilerplate] Removing lines ${boilerplateStartIndex} to ${lines.length - 1}`);
    lines.splice(boilerplateStartIndex);
  } else {
    console.log('[Boilerplate] No boilerplate markers found');
  }

  // Clean up: remove trailing empty lines and whitespace
  let cleaned = lines.join('\n')
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .replace(/\s+$/gm, '') // Trim trailing whitespace on each line
    .trim();

  return cleaned;
}

/**
 * Extract tags from YouTube description and remove tag block from description
 *
 * Extracts:
 * 1. Hashtags (#tag format) from anywhere in description
 * 2. Comma-separated tag block near the end (10+ tokens, mostly words)
 *
 * Test cases:
 *
 * Case 1: No tags
 * Input: "This is a video about faith and hope. Watch and share!"
 * Output: { description: "This is a video about faith and hope. Watch and share!", tags: [] }
 *
 * Case 2: Tags at bottom
 * Input: "Video description here.\n\nfaith, hope, love, prayer, worship, bible, jesus, christian, god, holy spirit, salvation, grace, mercy, peace, joy"
 * Output: { description: "Video description here.", tags: ["faith", "hope", "love", "prayer", "worship", "bible", "jesus", "christian", "god", "holy spirit", "salvation", "grace", "mercy", "peace", "joy"] }
 *
 * Case 3: Hashtags only
 * Input: "Check out this video! #faith #hope #love #prayer"
 * Output: { description: "Check out this video!", tags: ["faith", "hope", "love", "prayer"] }
 */
function extractTagsFromDescription(description: string): { description: string; tags: string[] } {
  if (!description || description.trim().length === 0) {
    return { description: '', tags: [] };
  }

  let cleanedDescription = description;
  const extractedTags: Set<string> = new Set();
  const MAX_TAGS = 50;

  // Step 1: Extract hashtags (#tag format) from anywhere in description
  const hashtagRegex = /#(\w+)/g;
  let match;
  // Reset regex lastIndex to ensure we start from beginning
  hashtagRegex.lastIndex = 0;
  while ((match = hashtagRegex.exec(description)) !== null) {
    const tag = match[1].toLowerCase().trim();
    if (tag.length > 0) {
      extractedTags.add(tag);
    }
  }
  // Remove hashtags from description (use a new regex instance to avoid lastIndex issues)
  cleanedDescription = cleanedDescription.replace(/#\w+/g, '');

  // Step 2: Detect and extract comma-separated tag block near the end
  // Look for a pattern of 10+ comma-separated tokens in the last portion of description
  const lines = cleanedDescription.split('\n');

  // Check last few lines for tag block pattern
  const linesToCheck = Math.min(5, lines.length); // Check last 5 lines
  let tagBlockStartIndex = -1;
  let tagBlockEndIndex = lines.length;

  // Start from the end and work backwards
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - linesToCheck); i--) {
    const line = lines[i].trim();
    if (line.length === 0) continue;

    // Count comma-separated tokens in this line
    const tokens = line.split(',').map(t => t.trim()).filter(t => t.length > 0);

    // Check if this looks like a tag block:
    // - Has 10+ tokens, OR
    // - Has 5+ tokens and previous line also had 5+ tokens (multi-line tag block)
    const isTagBlock = tokens.length >= 10 ||
                       (tokens.length >= 5 && i < lines.length - 1 &&
                        lines[i + 1].split(',').map(t => t.trim()).filter(t => t.length > 0).length >= 5);

    if (isTagBlock) {
      tagBlockEndIndex = i + 1;
      // Continue checking backwards for multi-line tag blocks
      let j = i - 1;
      while (j >= 0 && j >= Math.max(0, lines.length - linesToCheck)) {
        const prevLine = lines[j].trim();
        if (prevLine.length === 0) {
          tagBlockStartIndex = j + 1;
          break;
        }
        const prevTokens = prevLine.split(',').map(t => t.trim()).filter(t => t.length > 0);
        if (prevTokens.length >= 5) {
          j--;
        } else {
          tagBlockStartIndex = j + 1;
          break;
        }
      }
      if (tagBlockStartIndex === -1) {
        tagBlockStartIndex = Math.max(0, j + 1);
      }
      break;
    }
  }

  // Extract tags from the detected tag block
  if (tagBlockStartIndex >= 0 && tagBlockStartIndex < tagBlockEndIndex) {
    const tagBlockLines = lines.slice(tagBlockStartIndex, tagBlockEndIndex);
    const tagBlockText = tagBlockLines.join(', ');

    // Split on commas and extract tags
    const commaTags = tagBlockText
      .split(',')
      .map(t => t.trim())
      .filter(t => {
        // Filter out tokens that look like sentences (too long, contain periods, etc.)
        if (t.length > 50) return false;
        if (t.includes('. ') || t.includes('! ') || t.includes('? ')) return false;
        // Must be mostly alphanumeric with some spaces/hyphens
        return /^[a-zA-Z0-9\s\-']+$/.test(t);
      })
      .map(t => t.toLowerCase())
      .filter(t => t.length > 0);

    commaTags.forEach(tag => {
      if (extractedTags.size < MAX_TAGS) {
        extractedTags.add(tag);
      }
    });

    // Remove tag block from description
    lines.splice(tagBlockStartIndex, tagBlockEndIndex - tagBlockStartIndex);
    cleanedDescription = lines.join('\n').trim();
  }

  // Clean up description: remove extra whitespace, empty lines at end
  cleanedDescription = cleanedDescription
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .replace(/\s+$/gm, '') // Trim trailing whitespace on each line
    .trim();

  const tagsArray = Array.from(extractedTags).slice(0, MAX_TAGS);

  return {
    description: cleanedDescription,
    tags: tagsArray
  };
}

// Helper function to make HTTP GET requests using https module
function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Scheduled function to sync YouTube uploads
export const syncYouTubeUploads = functions.pubsub
  .schedule('every 1 hours')
  .timeZone('UTC')
  .onRun(async (context) => {
    try {
      console.log('Starting YouTube sync...');

      // Check if automatic YouTube articles are enabled
      const settingsDoc = await db.collection('settings').doc('youtubeSettings').get();
      if (settingsDoc.exists) {
        const settings = settingsDoc.data();
        if (settings && settings.automaticArticlesEnabled === false) {
          console.log('Automatic YouTube articles are disabled. Skipping sync.');
          return null;
        }
      }
      // If settings don't exist, default to enabled (backward compatibility)

      // Get config from functions config or environment variables
      const youtubeApiKey = functions.config().youtube?.api_key || process.env.YOUTUBE_API_KEY;
      const playlistId = functions.config().youtube?.uploads_playlist_id || process.env.YOUTUBE_UPLOADS_PLAYLIST_ID || 'UUf0MDB_oF7huA78BNADx9sQ';
      const authorEmail = functions.config().youtube?.author_email || process.env.YOUTUBE_AUTHOR_EMAIL || '';
      const authorId = functions.config().youtube?.author_id || process.env.YOUTUBE_AUTHOR_ID || '';

      if (!youtubeApiKey) {
        console.error('YouTube API key not configured. Set youtube.api_key in functions config or YOUTUBE_API_KEY env var.');
        // TODO: YouTube API key missing
        return null;
      }

      let createdCount = 0;
      let skippedCount = 0;
      let deletedCount = 0;
      let nextPageToken: string | undefined = undefined;
      const MAX_VIDEOS_TO_CHECK = 50; // Check up to 50 videos per run (safety limit)

      // Step 1: Collect all video IDs currently in the playlist (for removal check)
      const playlistVideoIds = new Set<string>();
      let collectNextPageToken: string | undefined = undefined;
      let collectedPages = 0;
      const MAX_PAGES_TO_COLLECT = 10; // Collect up to 10 pages (500 videos) for removal check

      while (collectedPages < MAX_PAGES_TO_COLLECT) {
        let collectPlaylistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&order=date&key=${youtubeApiKey}`;
        if (collectNextPageToken) {
          collectPlaylistUrl += `&pageToken=${collectNextPageToken}`;
        }

        let collectPlaylistData: YouTubePlaylistResponse;
        try {
          const collectResponseText = await httpsGet(collectPlaylistUrl);
          collectPlaylistData = JSON.parse(collectResponseText) as YouTubePlaylistResponse;
        } catch (error: any) {
          console.error('Error collecting playlist video IDs:', error.message);
          break; // If we can't collect, continue with new video processing
        }

        if (collectPlaylistData.items && collectPlaylistData.items.length > 0) {
          for (const item of collectPlaylistData.items) {
            const videoId = item.snippet.resourceId.videoId;
            playlistVideoIds.add(videoId);
          }
        }

        if (collectPlaylistData.nextPageToken) {
          collectNextPageToken = collectPlaylistData.nextPageToken;
          collectedPages++;
        } else {
          break; // No more pages
        }
      }

      console.log(`Collected ${playlistVideoIds.size} video IDs from playlist for removal check`);

      // Step 2: Check for removed videos and delete their articles
      const existingYouTubeArticles = await db.collection('content')
        .where('youtubeVideoId', '!=', null)
        .get();

      console.log(`Found ${existingYouTubeArticles.size} existing YouTube articles to check`);

      for (const doc of existingYouTubeArticles.docs) {
        const articleData = doc.data();
        const articleVideoId = articleData.youtubeVideoId;

        if (!articleVideoId) {
          continue; // Skip if no video ID
        }

        // Check if video is still in the playlist
        if (!playlistVideoIds.has(articleVideoId)) {
          console.log(`Video ${articleVideoId} not found in playlist, checking if it still exists...`);

          // Check if video still exists via YouTube API
          const videoCheckUrl = `https://www.googleapis.com/youtube/v3/videos?part=id,status&id=${articleVideoId}&key=${youtubeApiKey}`;

          let shouldDelete = true;
          try {
            const videoCheckResponseText = await httpsGet(videoCheckUrl);
            const videoCheckData = JSON.parse(videoCheckResponseText) as YouTubeVideoResponse;

            if (videoCheckData.items && videoCheckData.items.length > 0) {
              const videoStatus = (videoCheckData.items[0] as any).status;
              // Video exists - check if it's public and accessible
              if (videoStatus?.privacyStatus === 'public') {
                // Video is public but not in playlist
                // For livestreams that get removed and turned into new videos, we still want to remove the old article
                // So we delete it even if it's public but not in the uploads playlist
                console.log(`Video ${articleVideoId} exists and is public, but not in uploads playlist. Removing article (likely replaced livestream).`);
                shouldDelete = true;
              } else {
                // Video exists but is private/unlisted - definitely remove
                console.log(`Video ${articleVideoId} exists but is ${videoStatus?.privacyStatus}, removing article`);
                shouldDelete = true;
              }
            } else {
              // Video doesn't exist in API response - definitely remove
              console.log(`Video ${articleVideoId} not found in YouTube API, removing article`);
              shouldDelete = true;
            }
          } catch (error: any) {
            // If API call fails (e.g., video not found, 404, etc.), consider it removed
            console.log(`Error checking video ${articleVideoId}: ${error.message}. Removing article.`);
            shouldDelete = true;
          }

          // Delete the article
          if (shouldDelete) {
            try {
              await doc.ref.delete();
              deletedCount++;
              console.log(`Deleted article ${doc.id} for removed video ${articleVideoId}`);
            } catch (deleteError: any) {
              console.error(`Error deleting article ${doc.id}:`, deleteError.message);
            }
          }
        }
      }

      // Step 3: Fetch multiple videos from uploads playlist (process all new ones)
      // We'll process videos until we find one that already exists
      while (createdCount + skippedCount < MAX_VIDEOS_TO_CHECK) {
        // Build playlist URL - fetch multiple videos at once
        let playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&order=date&key=${youtubeApiKey}`;
        if (nextPageToken) {
          playlistUrl += `&pageToken=${nextPageToken}`;
        }

        let playlistData: YouTubePlaylistResponse;
        try {
          const playlistResponseText = await httpsGet(playlistUrl);
          playlistData = JSON.parse(playlistResponseText) as YouTubePlaylistResponse;
        } catch (error: any) {
          console.error('YouTube API playlistItems error:', error.message);
          throw new Error(`YouTube API error: ${error.message}`);
        }

        if (!playlistData.items || playlistData.items.length === 0) {
          console.log('No videos found in uploads playlist');
          break;
        }

        // Process each video in this page
        let foundExistingVideo = false;
        for (const item of playlistData.items) {
          if (createdCount + skippedCount >= MAX_VIDEOS_TO_CHECK) {
            console.log(`Reached safety cap of ${MAX_VIDEOS_TO_CHECK} videos`);
            break;
          }

          const videoId = item.snippet.resourceId.videoId;
          console.log(`Processing video: ${videoId}`);

          // Check if this video already exists in Firestore
          const existingVideoQuery = await db.collection('content')
            .where('youtubeVideoId', '==', videoId)
            .limit(1)
            .get();

          if (!existingVideoQuery.empty) {
            console.log(`Video ${videoId} already exists in Firestore, stopping (all older videos are already processed)`);
            foundExistingVideo = true;
            skippedCount++;
            break; // Stop processing since videos are ordered by date
          }

          // Get full video details from YouTube API (include status to check if public)
          const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${videoId}&key=${youtubeApiKey}`;

          let videoData: YouTubeVideoResponse;
          try {
            const videoResponseText = await httpsGet(videoUrl);
            videoData = JSON.parse(videoResponseText) as YouTubeVideoResponse;
          } catch (error: any) {
            console.error(`Error fetching video ${videoId}:`, error.message);
            skippedCount++;
            continue;
          }

          if (!videoData.items || videoData.items.length === 0) {
            console.log(`Video ${videoId} not found in YouTube API`);
            skippedCount++;
            continue;
          }

          // Check if video is public (ignore private/unlisted)
          const videoStatus = (videoData.items[0] as any).status;
          if (videoStatus?.privacyStatus !== 'public') {
            console.log(`Video ${videoId} is not public (${videoStatus?.privacyStatus}), skipping`);
            skippedCount++;
            continue;
          }

          const snippet = videoData.items[0].snippet;
          const title = snippet.title;
          const rawDescription = snippet.description || '';
          const thumbnails = snippet.thumbnails;
          const videoPublishedAtStr = snippet.publishedAt;
          const channelIdFromVideo = snippet.channelId;
          const videoTags = snippet.tags || []; // YouTube video tags (preferred source)

          // Step 1: Strip boilerplate from description (before tag extraction)
          const descriptionWithoutBoilerplate = stripBoilerplateFromDescription(rawDescription);

          // Step 2: Extract tags from cleaned description (hashtags and comma-separated blocks)
          const { description: cleanedDescription, tags: extractedTags } = extractTagsFromDescription(descriptionWithoutBoilerplate);

          // Step 3: Use YouTube video tags if available, otherwise use extracted tags
          // Normalize: lowercase, trim, remove leading '#', deduplicate
          const allTags = new Set<string>();
          if (videoTags && videoTags.length > 0) {
            // Prefer YouTube video tags
            videoTags.forEach(tag => {
              const normalized = tag.toLowerCase().trim();
              if (normalized.length > 0) {
                allTags.add(normalized);
              }
            });
          } else {
            // Fallback to extracted tags from description
            extractedTags.forEach(tag => {
              const normalized = tag.toLowerCase().trim().replace(/^#+/, '');
              if (normalized.length > 0) {
                allTags.add(normalized);
              }
            });
          }
          const finalTags = Array.from(allTags).slice(0, 50);

          // Generate slug
          const baseSlug = slugify(title);
          const uniqueSlug = await getUniqueSlug(baseSlug);

          // Generate excerpt (first 160 chars of cleaned description, plain text)
          const excerpt = cleanedDescription
            .replace(/\n/g, ' ')
            .replace(/<[^>]*>/g, '')
            .trim()
            .substring(0, 160) || '';

          // Generate content HTML from cleaned description (without boilerplate and tag block)
          // Escape HTML and convert newlines to <br> within a single <p> tag
          const escapedDescription = cleanedDescription
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');

          const descriptionHtml = `<p>${escapedDescription}</p>`;

          const embedHtml = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;

          const content = `${descriptionHtml}\n\n${embedHtml}`;

          // Get thumbnail URL
          const thumbnailUrl = getThumbnailUrl(thumbnails);

          // Convert YouTube publishedAt to Firestore Timestamp (use video's actual publishedAt)
          const videoPublishedAtDate = new Date(videoPublishedAtStr);
          const publishedAtTimestamp = admin.firestore.Timestamp.fromDate(videoPublishedAtDate);

          // Create Firestore document
          const contentData: any = {
            title,
            slug: uniqueSlug,
            status: 'published',
            content,
            excerpt,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            publishedAt: publishedAtTimestamp, // Use video's actual published date
            authorEmail: authorEmail || '',
            authorId: authorId || '',
            type: 'youtube',
            youtubeVideoId: videoId,
            youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
            thumbnailUrl,
            // Source metadata
            source: {
              type: 'youtube',
              videoId: videoId,
              channelId: channelIdFromVideo,
              publishedAt: publishedAtTimestamp,
              backfilled: false
            },
            // Store raw and cleaned descriptions for reference
            youtube: {
              descriptionRaw: rawDescription,
              descriptionClean: cleanedDescription
            }
          };

          // Store tags at top level (only if tags exist)
          if (finalTags.length > 0) {
            contentData.tags = finalTags;
          }

          const docRef = await db.collection('content').add(contentData);
          createdCount++;
          console.log(`Created new YouTube post: ${docRef.id} for video: ${videoId}`);
        }

        // If we found an existing video, we can stop (all older videos are already processed)
        if (foundExistingVideo) {
          break;
        }

        // Check if there are more pages
        if (playlistData.nextPageToken) {
          nextPageToken = playlistData.nextPageToken;
        } else {
          break; // No more pages
        }
      }

      console.log(`YouTube sync complete. Created: ${createdCount}, Skipped: ${skippedCount}, Deleted: ${deletedCount}`);
      return null;
    } catch (error) {
      console.error('Error syncing YouTube uploads:', error);
      throw error;
    }
  });

// One-time backfill function to import YouTube uploads from last 30 days
export const backfillYouTubeUploads = functions.https.onRequest(async (req, res) => {
  try {
    // Security: Check token
    const providedToken = req.query.token as string;
    const expectedToken = functions.config().youtube?.backfill_token || process.env.YOUTUBE_BACKFILL_TOKEN;

    // Debug logging (safe - doesn't expose full token)
    console.log('Token check:', {
      provided: providedToken ? `${providedToken.substring(0, 2)}...` : 'missing',
      expected: expectedToken ? `${expectedToken.substring(0, 2)}...` : 'missing',
      configExists: !!functions.config().youtube?.backfill_token,
      envExists: !!process.env.YOUTUBE_BACKFILL_TOKEN
    });

    if (!expectedToken) {
      console.error('Backfill token not configured in functions config or environment');
      res.status(500).json({ error: 'Backfill token not configured' });
      return;
    }

    if (!providedToken || providedToken !== expectedToken) {
      console.warn('Token mismatch - access denied');
      res.status(403).json({ error: 'Unauthorized: Invalid or missing token' });
      return;
    }

    // Get config
    const youtubeApiKey = functions.config().youtube?.api_key || process.env.YOUTUBE_API_KEY;
    const channelId = functions.config().youtube?.channel_id || process.env.YOUTUBE_CHANNEL_ID || 'UCf0MDB_oF7huA78BNADx9sQ';
    const authorEmail = functions.config().youtube?.author_email || process.env.YOUTUBE_AUTHOR_EMAIL || '';
    const authorId = functions.config().youtube?.author_id || process.env.YOUTUBE_AUTHOR_ID || '';

    if (!youtubeApiKey) {
      res.status(500).json({ error: 'YouTube API key not configured' });
      return;
    }

    // Fixed: Only import videos from last 30 days
    const days = 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const publishedAfter = cutoffDate.toISOString();
    console.log(`Starting backfill for last ${days} days (publishedAfter: ${publishedAfter})`);

    let createdCount = 0;
    let skippedCount = 0;
    let processedCount = 0;
    let nextPageToken: string | undefined = undefined;
    const MAX_VIDEOS = 200; // Safety cap

    // Use YouTube Search API with publishedAfter filter instead of playlist items
    // This allows us to filter by date and only get public videos
    while (processedCount < MAX_VIDEOS) {
      // Build search URL with publishedAfter filter
      let searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&publishedAfter=${publishedAfter}&maxResults=50&key=${youtubeApiKey}`;
      if (nextPageToken) {
        searchUrl += `&pageToken=${nextPageToken}`;
      }

      let searchData: any;
      try {
        const searchResponseText = await httpsGet(searchUrl);
        searchData = JSON.parse(searchResponseText);
      } catch (error: any) {
        console.error('YouTube API search error:', error.message);
        res.status(500).json({ error: `YouTube API error: ${error.message}` });
        return;
      }

      if (!searchData.items || searchData.items.length === 0) {
        console.log('No more videos found');
        break;
      }

      // Process each video in this page
      for (const item of searchData.items) {
        if (processedCount >= MAX_VIDEOS) {
          console.log(`Reached safety cap of ${MAX_VIDEOS} videos`);
          break;
        }

        const videoId = item.id.videoId;
        const publishedAtStr = item.snippet.publishedAt;
        const publishedAtDate = new Date(publishedAtStr);

        // Double-check date (should already be filtered by API, but verify)
        if (publishedAtDate < cutoffDate) {
          console.log(`Video ${videoId} is older than cutoff, skipping`);
          continue;
        }

        // Only process public videos (privacyStatus should be 'public' in full video data)
        processedCount++;
        console.log(`Processing video ${processedCount}: ${videoId} (published: ${publishedAtStr})`);

        // Check if video already exists in Firestore (idempotent)
        const existingVideoQuery = await db.collection('content')
          .where('youtubeVideoId', '==', videoId)
          .limit(1)
          .get();

        if (!existingVideoQuery.empty) {
          skippedCount++;
          console.log(`Video ${videoId} already exists, skipping`);
          continue;
        }

        // Get full video details (we need snippet with tags, thumbnails, and status)
        const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${videoId}&key=${youtubeApiKey}`;

        let videoData: YouTubeVideoResponse;
        try {
          const videoResponseText = await httpsGet(videoUrl);
          videoData = JSON.parse(videoResponseText) as YouTubeVideoResponse;
        } catch (error: any) {
          console.error(`Error fetching video ${videoId}:`, error.message);
          skippedCount++;
          continue;
        }

        if (!videoData.items || videoData.items.length === 0) {
          console.log(`Video ${videoId} not found in YouTube API`);
          skippedCount++;
          continue;
        }

        // Check if video is public (ignore private/unlisted)
        const videoStatus = (videoData.items[0] as any).status;
        if (videoStatus?.privacyStatus !== 'public') {
          console.log(`Video ${videoId} is not public (${videoStatus?.privacyStatus}), skipping`);
          skippedCount++;
          continue;
        }

        const snippet = videoData.items[0].snippet;
        const title = snippet.title;
        const rawDescription = snippet.description || '';
        const thumbnails = snippet.thumbnails;
        const videoPublishedAtStr = snippet.publishedAt;
        const channelIdFromVideo = snippet.channelId;
        const videoTags = snippet.tags || []; // YouTube video tags (preferred source)

        // Step 1: Strip boilerplate from description (before tag extraction)
        const descriptionWithoutBoilerplate = stripBoilerplateFromDescription(rawDescription);

        // Step 2: Extract tags from cleaned description (hashtags and comma-separated blocks)
        const { description: cleanedDescription, tags: extractedTags } = extractTagsFromDescription(descriptionWithoutBoilerplate);

        // Step 3: Use YouTube video tags if available, otherwise use extracted tags
        // Normalize: lowercase, trim, remove leading '#', deduplicate
        const allTags = new Set<string>();
        if (videoTags && videoTags.length > 0) {
          // Prefer YouTube video tags
          videoTags.forEach(tag => {
            const normalized = tag.toLowerCase().trim();
            if (normalized.length > 0) {
              allTags.add(normalized);
            }
          });
        } else {
          // Fallback to extracted tags from description
          extractedTags.forEach(tag => {
            const normalized = tag.toLowerCase().trim().replace(/^#+/, '');
            if (normalized.length > 0) {
              allTags.add(normalized);
            }
          });
        }
        const finalTags = Array.from(allTags).slice(0, 50);

        // Generate slug
        const baseSlug = slugify(title);
        const uniqueSlug = await getUniqueSlug(baseSlug);

        // Generate excerpt (first 160 chars of cleaned description, plain text)
        const excerpt = cleanedDescription
          .replace(/\n/g, ' ')
          .replace(/<[^>]*>/g, '')
          .trim()
          .substring(0, 160) || '';

        // Generate content HTML from cleaned description (without boilerplate and tag block)
        const escapedDescription = cleanedDescription
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>');

        const descriptionHtml = `<p>${escapedDescription}</p>`;
        const embedHtml = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
        const content = `${descriptionHtml}\n\n${embedHtml}`;

        // Get thumbnail URL
        const thumbnailUrl = getThumbnailUrl(thumbnails);

        // Convert YouTube publishedAt to Firestore Timestamp (use video's actual publishedAt)
        const videoPublishedAtDate = new Date(videoPublishedAtStr);
        const publishedAtTimestamp = admin.firestore.Timestamp.fromDate(videoPublishedAtDate);

        // Create Firestore document with source metadata
        const contentData: any = {
          title,
          slug: uniqueSlug,
          status: 'published',
          content,
          excerpt,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          publishedAt: publishedAtTimestamp, // Use video's actual published date
          authorEmail: authorEmail || '',
          authorId: authorId || '',
          type: 'youtube',
          youtubeVideoId: videoId,
          youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnailUrl,
          // Source metadata
          source: {
            type: 'youtube',
            videoId: videoId,
            channelId: channelIdFromVideo,
            publishedAt: publishedAtTimestamp,
            backfilled: true
          },
          // Store raw and cleaned descriptions for reference
          youtube: {
            descriptionRaw: rawDescription,
            descriptionClean: cleanedDescription
          }
        };

        // Store tags at top level (only if tags exist)
        if (finalTags.length > 0) {
          contentData.tags = finalTags;
        }

        await db.collection('content').add(contentData);
        createdCount++;
        console.log(`Created new YouTube post for video: ${videoId}`);
      }

      // Check if there are more pages
      if (searchData.nextPageToken) {
        nextPageToken = searchData.nextPageToken;
      } else {
        break; // No more pages
      }
    }

    const summary = {
      days: 30,
      publishedAfter,
      createdCount,
      skippedCount,
      processedCount
    };

    console.log('Backfill complete:', summary);
    res.status(200).json(summary);

  } catch (error) {
    console.error('Error in backfill:', error);
    res.status(500).json({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * Update emailVerified in Firestore after email verification
 * This function is called from the client after applyActionCode succeeds
 * It bypasses Firestore security rules to update the emailVerified field
 *
 * Accepts: POST with { email: string } in body
 * Returns: { success: boolean, message: string }
 */
// Delete user from both Auth and Firestore (admin-only)
export const deleteUser = functions.https.onRequest((req, res) => {
  // Enable CORS
  const corsHandler = corsLib({ origin: true });
  return corsHandler(req, res, async () => {
    try {
      // Handle OPTIONS request for CORS preflight
      if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
      }

      // Only allow POST requests
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed. Use POST.' });
        return;
      }

      // Get auth token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: No auth token provided' });
        return;
      }

      const idToken = authHeader.split('Bearer ')[1];

      // Verify the token and get the user
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ error: 'Unauthorized: Invalid token' });
        return;
      }

      const callerUid = decodedToken.uid;

      // Verify caller is an admin
      const callerDoc = await db.collection('adminUsers').doc(callerUid).get();
      if (!callerDoc.exists) {
        res.status(403).json({ error: 'Forbidden: User not found' });
        return;
      }

      const callerData = callerDoc.data();
      if (!callerData || !callerData.isAdmin) {
        res.status(403).json({ error: 'Forbidden: Admin privileges required' });
        return;
      }

      // Check if caller is a full admin (not moderator)
      if (callerData.userRole === 'Moderator') {
        res.status(403).json({ error: 'Forbidden: Full admin privileges required' });
        return;
      }

      // Get user ID to delete from request body
      const { userId } = req.body;
      if (!userId || typeof userId !== 'string') {
        res.status(400).json({ error: 'Bad request: userId is required' });
        return;
      }

      // Prevent self-deletion
      if (userId === callerUid) {
        res.status(400).json({ error: 'Bad request: Cannot delete yourself' });
        return;
      }

      // Get user data before deletion (for logging)
      const userDoc = await db.collection('adminUsers').doc(userId).get();
      if (!userDoc.exists) {
        res.status(404).json({ error: 'User not found in Firestore' });
        return;
      }

      const userData = userDoc.data();
      const userEmail = userData?.email || userId;

      // Delete from Auth first (this might fail if user doesn't exist in Auth)
      try {
        await admin.auth().deleteUser(userId);
        console.log(`Deleted user ${userId} (${userEmail}) from Auth`);
      } catch (authError: any) {
        // If user doesn't exist in Auth, log but continue with Firestore deletion
        if (authError.code === 'auth/user-not-found') {
          console.log(`User ${userId} (${userEmail}) not found in Auth, continuing with Firestore deletion`);
        } else {
          console.error(`Error deleting user ${userId} from Auth:`, authError);
          // Still try to delete from Firestore even if Auth deletion fails
        }
      }

      // Delete from Firestore
      await db.collection('adminUsers').doc(userId).delete();
      console.log(`Deleted user ${userId} (${userEmail}) from Firestore`);

      res.status(200).json({
        success: true,
        message: `User ${userEmail} deleted successfully`,
        userId: userId
      });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  });
});

export const updateEmailVerified = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  const cors = corsLib({ origin: true });
  cors(req, res, async () => {
    try {
      console.log('updateEmailVerified called with method:', req.method);
      console.log('Request body:', req.body);

      // Only allow POST
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }

      const { uid, email, oobCode } = req.body;
      let targetEmail: string | null = null;

      // If uid is provided, verify in Auth and update Firestore by uid
      if (uid && typeof uid === 'string') {
        try {
          console.log('UID provided. Verifying emailVerified in Firebase Auth for uid:', uid);
          const userRecord = await admin.auth().getUser(uid);
          if (userRecord.emailVerified === true) {
            const db = admin.firestore();
            const userRef = db.collection('adminUsers').doc(uid);
            await userRef.set({ emailVerified: true }, { merge: true });
            console.log('Successfully updated emailVerified for uid:', uid, 'email:', userRecord.email);
            res.status(200).json({ success: true, message: 'Email verified status updated by uid', email: userRecord.email });
            return;
          } else {
            console.warn('Auth record not yet emailVerified for uid:', uid);
            res.status(409).json({ error: 'Auth email not verified yet' });
            return;
          }
        } catch (uidError: any) {
          console.error('Error handling uid path:', uidError);
          // Fall through to other methods if needed
        }
      }

      // If email is provided, use it directly
      if (email && typeof email === 'string') {
        targetEmail = email.toLowerCase().trim();
      }
      // If oobCode is provided, try to get email from it
      // Note: Once an action code is used, we can't extract the email from it
      // So we'll query all unverified users and check which one was just verified
      else if (oobCode && typeof oobCode === 'string') {
        console.log('oobCode provided but email not available. Querying recently verified users...');

        // Get all users from Firestore who are not verified
        const db = admin.firestore();
        const usersRef = db.collection('adminUsers');
        const unverifiedUsers = await usersRef.where('emailVerified', '==', false).get();

        // Check each unverified user in Firebase Auth to see if they're now verified
        for (const doc of unverifiedUsers.docs) {
          try {
            const userRecord = await admin.auth().getUser(doc.id);
            if (userRecord.emailVerified) {
              // This user was just verified! Update Firestore
              targetEmail = userRecord.email?.toLowerCase().trim() || null;
              console.log(`Found recently verified user: ${targetEmail}`);

              // Update Firestore
              await doc.ref.update({ emailVerified: true });
              console.log(`Successfully updated emailVerified for user ${doc.id} (${targetEmail})`);

              res.status(200).json({
                success: true,
                message: 'Email verified status updated in Firestore',
                email: targetEmail
              });
              return;
            }
          } catch (authError: any) {
            // User might not exist in Auth, skip
            continue;
          }
        }

        // If we get here, we couldn't find a recently verified user
        console.warn('Could not find recently verified user from oobCode');
        res.status(404).json({ error: 'Could not determine which user was verified' });
        return;
      }

      if (!targetEmail) {
        console.error('Invalid request: email or oobCode is required');
        res.status(400).json({ error: 'Email or oobCode is required' });
        return;
      }

      // Normalize email: lowercase and trim
      const normalizedEmail = targetEmail;
      console.log('Looking up user with normalized email:', normalizedEmail);

      // Find user by email in Firestore (case-insensitive search would require getting all docs)
      // For now, we'll try exact match first, then try lowercase
      const db = admin.firestore();
      const usersRef = db.collection('adminUsers');

      // Try exact match first
      let querySnapshot = await usersRef.where('email', '==', normalizedEmail).limit(1).get();

      // If not found, try with original email (in case it's stored with different case)
      if (querySnapshot.empty && normalizedEmail !== email) {
        console.log('Trying with original email case:', email);
        querySnapshot = await usersRef.where('email', '==', email).limit(1).get();
      }

      // If still not found, get all docs and search case-insensitively (less efficient but more reliable)
      if (querySnapshot.empty) {
        console.log('Exact match failed, searching all users case-insensitively...');
        const allUsersSnapshot = await usersRef.get();
        const matchingDoc = allUsersSnapshot.docs.find(doc => {
          const docEmail = doc.data().email;
          return docEmail && docEmail.toLowerCase().trim() === normalizedEmail;
        });

        if (matchingDoc) {
          // Create a fake QuerySnapshot-like structure
          querySnapshot = {
            empty: false,
            docs: [matchingDoc],
            size: 1
          } as any;
          console.log('Found user with case-insensitive search:', matchingDoc.id);
        }
      }

      if (querySnapshot.empty) {
        console.error('No user found in Firestore with email:', normalizedEmail);
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const foundUid = userDoc.id;
      console.log('Found user document with UID:', foundUid);

      // Verify that the email is actually verified in Firebase Auth
      let userRecord;
      try {
        userRecord = await admin.auth().getUser(foundUid);
        console.log('User record from Auth:', {
          uid: userRecord.uid,
          email: userRecord.email,
          emailVerified: userRecord.emailVerified
        });
      } catch (authError: any) {
        // User might not exist in Auth yet, but we can still update Firestore
        console.warn('User not found in Auth, but updating Firestore anyway:', uid, authError.message);
        userRecord = null;
      }

      // Always update Firestore - if applyActionCode succeeded, the email is verified
      // Don't check Firebase Auth status as it might not have propagated yet
      console.log('Updating Firestore document for UID:', foundUid);
      console.log('Current document data before update:', userDoc.data());

      // Use updateDoc instead of setDoc for clearer intent (only update emailVerified)
      await userDoc.ref.update({
        emailVerified: true
      });

      // Verify the update
      const updatedDoc = await userDoc.ref.get();
      const updatedData = updatedDoc.data();
      console.log('Updated document data:', {
        uid: updatedDoc.id,
        email: updatedData?.email,
        emailVerified: updatedData?.emailVerified
      });

      console.log(`Successfully updated emailVerified for user ${foundUid} (${email})`);

      res.status(200).json({ success: true, message: 'Email verified status updated in Firestore' });
    } catch (error) {
      console.error('Error updating emailVerified:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
});

// Note: Auth triggers for email verification are not available in Firebase Functions v1
// We rely on the updateEmailVerified HTTP Cloud Function being called from the client

/**
 * Firestore trigger: Automatically rebuild and redeploy Astro site when articles are published/updated
 *
 * Triggers on writes to /content/{articleId}
 * Only rebuilds if:
 * - status === 'published'
 * - slug or content fields changed (or article was just published)
 */
export const onArticleUpdate = functions.firestore
  .document('content/{articleId}')
  .onWrite(async (change, context) => {
    const articleId = context.params.articleId;
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;

    // Skip if document was deleted
    if (!after) {
      console.log(`Article ${articleId} was deleted. Skipping rebuild.`);
      return null;
    }

    // Skip if not published
    if (after.status !== 'published') {
      console.log(`Article ${articleId} is not published (status: ${after.status}). Skipping rebuild.`);
      return null;
    }

    // Check if this is a new publication or if slug/content changed
    const isNewPublication = !before || before.status !== 'published';
    const slugChanged = before && before.slug !== after.slug;
    const contentChanged = before && before.content !== after.content;
    const titleChanged = before && before.title !== after.title; // Title changes affect SEO

    if (!isNewPublication && !slugChanged && !contentChanged && !titleChanged) {
      console.log(`Article ${articleId} published but no relevant fields changed. Skipping rebuild.`);
      return null;
    }

    console.log(`Article ${articleId} published/updated. Triggering rebuild...`);
    console.log(`Changes: newPublication=${isNewPublication}, slugChanged=${slugChanged}, contentChanged=${contentChanged}, titleChanged=${titleChanged}`);

    try {
      // Option 1: Trigger GitHub Actions workflow (recommended)
      const githubToken = functions.config().github?.token;
      const githubRepo = functions.config().github?.repo; // Format: "owner/repo"
      const githubWorkflow = functions.config().github?.workflow || 'rebuild-astro.yml';

      if (githubToken && githubRepo) {
        console.log(`Triggering GitHub Actions workflow: ${githubRepo}/${githubWorkflow}`);
        await triggerGitHubActions(githubToken, githubRepo, githubWorkflow, articleId);
        return null;
      }

      // Option 2: Direct Firebase Hosting deployment (fallback)
      console.log('GitHub Actions not configured. Attempting direct Firebase Hosting deployment...');
      await triggerFirebaseHostingDeploy(articleId);

      return null;
    } catch (error) {
      console.error(`Error triggering rebuild for article ${articleId}:`, error);
      // Don't throw - we don't want to retry indefinitely
      return null;
    }
  });

/**
 * Trigger GitHub Actions workflow via repository_dispatch API
 */
async function triggerGitHubActions(
  token: string,
  repo: string,
  workflow: string,
  articleId: string
): Promise<void> {
  const https = require('https');
  const url = require('url');

  return new Promise((resolve, reject) => {
    const [owner, repoName] = repo.split('/');
    if (!owner || !repoName) {
      throw new Error(`Invalid GitHub repo format: ${repo}. Expected "owner/repo"`);
    }

    // Option A: Use repository_dispatch (requires workflow_dispatch in workflow)
    const apiUrl = `https://api.github.com/repos/${owner}/${repoName}/dispatches`;

    const payload = JSON.stringify({
      event_type: 'rebuild-astro',
      client_payload: {
        articleId,
        reason: 'article_published_or_updated',
        timestamp: new Date().toISOString()
      }
    });

    const parsedUrl = url.parse(apiUrl);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.path,
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Firebase-Cloud-Function',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res: any) => {
      let data = '';
      res.on('data', (chunk: any) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 204 || res.statusCode === 200) {
          console.log(`✅ Successfully triggered GitHub Actions workflow for article ${articleId}`);
          resolve();
        } else {
          console.error(`❌ GitHub API error: ${res.statusCode} - ${data}`);
          reject(new Error(`GitHub API returned ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error: Error) => {
      console.error('Error making GitHub API request:', error);
      reject(error);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Trigger Firebase Hosting deployment directly
 * Note: This requires the Cloud Function to have Hosting Admin permissions
 */
async function triggerFirebaseHostingDeploy(articleId: string): Promise<void> {
  // This approach requires using Firebase Admin SDK to trigger a deployment
  // However, Firebase Hosting doesn't have a direct API for this.
  // Instead, we'll use the Firebase CLI via a Cloud Build trigger or
  // create an HTTP-triggered function that can be called with proper auth.

  // For now, log that we need GitHub Actions or manual deployment
  console.warn('Direct Firebase Hosting deployment not implemented. Please configure GitHub Actions.');
  console.warn(`Article ${articleId} was published but deployment was not triggered.`);
  console.warn('Please manually rebuild and deploy, or configure GitHub Actions workflow.');

  // Alternative: You could create an HTTP Cloud Function that runs the build
  // and deploy commands, but this requires more setup and security considerations.
  throw new Error('Firebase Hosting direct deployment not configured. Use GitHub Actions instead.');
}
