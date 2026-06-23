import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { CONTACT_BLOCKLIST } from './contact-blocklist';

/** How long we remember prior messages when checking for duplicates (ms). */
export const REPEAT_MESSAGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Minimum wait between submissions from the same email or IP (ms). */
export const CONTACT_COOLDOWN_MS = 5 * 60 * 1000;

export type ContactRejectionCode =
  | 'blocked'
  | 'cooldown'
  | 'repeat_message';

export interface ContactRejection {
  code: ContactRejectionCode;
  message: string;
  retryAfter?: number;
}

export function normalizeEmailForBlocklist(email: string): string {
  return email.trim().toLowerCase();
}

export function isBlockedSender(email: string, clientIP: string): ContactRejection | null {
  const normalizedEmail = normalizeEmailForBlocklist(email);
  const blockedEmails = (CONTACT_BLOCKLIST.blockedEmails || []).map(normalizeEmailForBlocklist);
  const blockedIps = (CONTACT_BLOCKLIST.blockedIps || []).map((ip) => ip.trim());

  if (blockedEmails.includes(normalizedEmail)) {
    return {
      code: 'blocked',
      message:
        'This contact form cannot accept messages from your email address. If you believe this is a mistake, please contact the ministry through another channel.',
    };
  }

  if (clientIP && clientIP !== 'unknown' && blockedIps.includes(clientIP)) {
    return {
      code: 'blocked',
      message:
        'This contact form cannot accept messages from your network connection. If you believe this is a mistake, please contact the ministry through another channel.',
    };
  }

  return null;
}

/** Collapse whitespace and case for duplicate detection — does not censor words. */
export function normalizeForRepeatCheck(subject: string, message: string): string {
  return `${subject}\n${message}`.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function isRepeatMessage(
  subject: string,
  message: string,
  priorSubmissions: FirebaseFirestore.QueryDocumentSnapshot[]
): boolean {
  const fingerprint = normalizeForRepeatCheck(subject, message);
  if (!fingerprint) {
    return false;
  }

  const cutoff = Date.now() - REPEAT_MESSAGE_WINDOW_MS;

  return priorSubmissions.some((doc) => {
    const data = doc.data();
    const submittedAt = data.submittedAt as admin.firestore.Timestamp | undefined;
    const submittedMs = submittedAt?.toMillis?.() ?? 0;
    if (submittedMs && submittedMs < cutoff) {
      return false;
    }
    const priorSubject = (data.subject as string) || '';
    const priorMessage = (data.message as string) || '';
    return normalizeForRepeatCheck(priorSubject, priorMessage) === fingerprint;
  });
}

export function formatWaitDuration(totalSeconds: number): string {
  const seconds = Math.max(1, Math.ceil(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  if (minutes <= 0) {
    return remainder === 1 ? '1 second' : `${remainder} seconds`;
  }
  if (remainder === 0) {
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }
  const minuteLabel = minutes === 1 ? '1 minute' : `${minutes} minutes`;
  const secondLabel = remainder === 1 ? '1 second' : `${remainder} seconds`;
  return `${minuteLabel} and ${secondLabel}`;
}

export function buildCooldownRejection(retryAfterSeconds: number): ContactRejection {
  const waitLabel = formatWaitDuration(retryAfterSeconds);
  return {
    code: 'cooldown',
    message: `Please wait ${waitLabel} before sending another message. This short pause helps reduce spam while still letting you send a follow-up if you need to.`,
    retryAfter: retryAfterSeconds,
  };
}

export function buildRepeatMessageRejection(): ContactRejection {
  return {
    code: 'repeat_message',
    message:
      'This message looks the same as one you already sent recently. If you need to add something new, please update your message and try again after a few minutes.',
  };
}

export function getLatestSubmissionMs(
  docs: FirebaseFirestore.QueryDocumentSnapshot[]
): number {
  let latest = 0;
  for (const doc of docs) {
    const submittedAt = doc.data().submittedAt as admin.firestore.Timestamp | undefined;
    const ms = submittedAt?.toMillis?.() ?? 0;
    if (ms > latest) {
      latest = ms;
    }
  }
  return latest;
}

/** Common disposable / throwaway email domains (subset — blocks bulk spam, not legit providers). */
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'sharklasers.com',
  'grr.la',
  'pokemail.net',
  'spam4.me',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.io',
  'throwaway.email',
  'getnada.com',
  'maildrop.cc',
  'dispostable.com',
  '10minutemail.com',
  '10minutemail.net',
  'trashmail.com',
  'trashmail.me',
  'fakeinbox.com',
  'mintemail.com',
  'mailnesia.com',
  'spamgourmet.com',
  'mytemp.email',
  'emailondeck.com',
  'getairmail.com',
  'mailcatch.com',
  'mohmal.com',
  'tmpmail.org',
  'tmpmail.net',
  'burnermail.io'
]);

/** URL shorteners often used to hide phishing destinations. */
const BLOCKED_LINK_HOSTS = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'adf.ly',
  'cutt.ly',
  'shorturl.at',
  'rb.gy',
  's.id',
  'lc.chat',
  'rebrand.ly'
]);

export const MAX_MESSAGE_LINKS = 3;

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;

export function getEmailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 0) {
    return '';
  }
  return email.slice(at + 1).toLowerCase().trim();
}

export function isDisposableEmail(email: string): boolean {
  const domain = getEmailDomain(email);
  if (!domain) {
    return false;
  }
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return true;
  }
  // Block obvious temp-mail subdomains without blocking every .tk/.ml domain.
  return /^(temp|trash|disposable|throwaway|fake|spam|guerrilla)/i.test(domain.split('.')[0] || '');
}

export function extractUrls(text: string): string[] {
  if (!text) {
    return [];
  }
  return text.match(URL_PATTERN) || [];
}

export function normalizeUrlForCheck(rawUrl: string): string | null {
  try {
    const withProtocol = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    return new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function validateMessageLinks(text: string): { isValid: boolean; error?: string } {
  const urls = extractUrls(text);
  if (urls.length > MAX_MESSAGE_LINKS) {
    return {
      isValid: false,
      error: `Please include at most ${MAX_MESSAGE_LINKS} links in your message.`
    };
  }

  for (const rawUrl of urls) {
    const host = normalizeUrlForCheck(rawUrl);
    if (!host) {
      continue;
    }
    if (BLOCKED_LINK_HOSTS.has(host)) {
      return {
        isValid: false,
        error: 'Please use full website addresses instead of link shorteners.'
      };
    }
    if (/^(javascript|data|vbscript):/i.test(rawUrl)) {
      return {
        isValid: false,
        error: 'Message contains an unsupported link type.'
      };
    }
  }

  return { isValid: true };
}

export function shouldEnforceAppCheck(): boolean {
  return functions.config().security?.enforce_app_check === 'true';
}

export async function verifyAppCheckToken(
  req: functions.https.Request
): Promise<{ ok: boolean; enforced: boolean }> {
  const enforced = shouldEnforceAppCheck();
  const token = req.header('X-Firebase-AppCheck');

  if (!token) {
    return { ok: !enforced, enforced };
  }

  try {
    await admin.appCheck().verifyToken(token);
    return { ok: true, enforced };
  } catch (error) {
    console.warn('App Check verification failed:', error);
    return { ok: false, enforced };
  }
}
