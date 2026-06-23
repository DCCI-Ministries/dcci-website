#!/usr/bin/env node
/**
 * One-time recovery: email stored Firestore contact form messages to Hatun,
 * then optionally delete those documents.
 *
 * Prerequisites:
 *   - GOOGLE_APPLICATION_CREDENTIALS pointing to a Firebase service account JSON
 *   - Working SMTP (MAIL_USER + MAIL_PASS App Password)
 *
 * Usage:
 *   node scripts/forward-firestore-contacts-to-hatun.js --dry-run
 *   node scripts/forward-firestore-contacts-to-hatun.js --dry-run --since 2026-06-11
 *   node scripts/forward-firestore-contacts-to-hatun.js --dry-run --after 2026-04-25
 *   node scripts/forward-firestore-contacts-to-hatun.js --send --after 2026-04-25
 *   node scripts/forward-firestore-contacts-to-hatun.js --send --delete --after 2026-04-25
 */

const admin = require('../functions/node_modules/firebase-admin');
const { createMailTransport, getSmtpSettingsFromEnv } = require('./lib/smtp-config');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'dcci-ministries';
const MAIL_USER = process.env.MAIL_USER;
const MAIL_PASS = process.env.MAIL_PASS;
const MAIL_TO = process.env.MAIL_TO || 'hatun@dcciministries.com';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const send = args.has('--send');
const deleteAfter = args.has('--delete');

if (!dryRun && !send) {
  console.error('Specify --dry-run and/or --send (optional: --delete after successful send).');
  process.exit(1);
}

if (send && (!MAIL_USER || !MAIL_PASS)) {
  console.error('For --send, set MAIL_USER and MAIL_PASS (Google App Password).');
  process.exit(1);
}

if (deleteAfter && !send) {
  console.error('--delete requires --send.');
  process.exit(1);
}

function formatTimestamp(ts) {
  if (!ts) return 'unknown date';
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
  if (ts._seconds) return new Date(ts._seconds * 1000).toISOString();
  return String(ts);
}

function hasMessageBody(data) {
  return Boolean(data.message || data.email || data.name);
}

function parseDateArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || !process.argv[idx + 1]) return null;
  const raw = process.argv[idx + 1];
  const d = new Date(raw.includes('T') ? raw : `${raw}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    console.error(`Invalid ${flag} date: ${raw} (use YYYY-MM-DD)`);
    process.exit(1);
  }
  return d;
}

function cutoffMs(since, after) {
  if (after) {
    const d = new Date(after);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.getTime();
  }
  if (since) return since.getTime();
  return null;
}

function submittedAtMs(data) {
  const ts = data.submittedAt;
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts._seconds) return ts._seconds * 1000;
  return null;
}

function buildEmail(doc) {
  const data = doc.data();
  const submitted = formatTimestamp(data.submittedAt);
  const subject = data.subject || '(no subject)';
  return {
    from: `"DCCI Ministries Website Recovery" <${MAIL_USER}>`,
    to: MAIL_TO,
    replyTo: data.email ? `${data.name || 'Visitor'} <${data.email}>` : undefined,
    subject: `[Recovered contact form] ${subject}`,
    text: [
      'This message was recovered from the website database because email delivery had failed.',
      '',
      `Firestore document ID: ${doc.id}`,
      `Submitted at: ${submitted}`,
      '',
      `Name: ${data.name || '(none)'}`,
      `Email: ${data.email || '(none)'}`,
      `Subject: ${subject}`,
      `Newsletter opt-in: ${data.newsletter ? 'yes' : 'no'}`,
      '',
      'Message:',
      data.message || '(empty)',
      '',
      '---',
      'After Hatun has read this, run the recovery script with --delete to remove it from Firestore.'
    ].join('\n')
  };
}

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }
  const db = admin.firestore();

  let snapshot;
  try {
    snapshot = await db.collection('contacts').orderBy('submittedAt', 'asc').get();
  } catch {
    console.warn('orderBy submittedAt failed — loading all contacts unsorted');
    snapshot = await db.collection('contacts').get();
  }
  const since = parseDateArg('--since');
  const after = parseDateArg('--after');
  if (since && after) {
    console.error('Use only one of --since or --after.');
    process.exit(1);
  }
  const minMs = cutoffMs(since, after);
  const withBodies = snapshot.docs.filter((doc) => hasMessageBody(doc.data()));
  const toRecover = minMs
    ? withBodies.filter((doc) => {
        const ms = submittedAtMs(doc.data());
        return ms === null || ms >= minMs;
      })
    : withBodies;

  console.log(`Total contacts documents: ${snapshot.size}`);
  console.log(`Documents with message content: ${withBodies.length}`);
  if (after) {
    console.log(`Strictly after ${after.toISOString().slice(0, 10)} (from next day): ${toRecover.length}`);
  } else if (since) {
    console.log(`On or after --since ${since.toISOString().slice(0, 10)}: ${toRecover.length}`);
  }
  console.log(`Will recover: ${toRecover.length}`);

  if (toRecover.length === 0) {
    console.log('Nothing to recover.');
    return;
  }

  if (dryRun) {
    toRecover.forEach((doc) => {
      const d = doc.data();
      console.log(`- ${doc.id} | ${formatTimestamp(d.submittedAt)} | ${d.email || '?'} | ${d.subject || '?'}`);
    });
    if (!send) return;
  }

  const transport = createMailTransport({ user: MAIL_USER, pass: MAIL_PASS });
  const smtp = getSmtpSettingsFromEnv();

  await transport.verify();
  console.log('SMTP OK — sending to', MAIL_TO, `via ${smtp.host}:${smtp.port}`);

  let sent = 0;
  let deleted = 0;

  for (const doc of toRecover) {
    const mail = buildEmail(doc);
    if (dryRun && !send) continue;

    const info = await transport.sendMail(mail);
    console.log(`Sent ${doc.id} → ${info.messageId}`);
    sent++;

    if (deleteAfter) {
      await doc.ref.delete();
      console.log(`Deleted ${doc.id} from Firestore`);
      deleted++;
    }
  }

  console.log(`Done. Sent: ${sent}, deleted: ${deleted}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
