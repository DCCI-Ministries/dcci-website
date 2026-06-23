import * as admin from "firebase-admin";
import type { Firestore } from "firebase-admin/firestore";
import type { SendMailOptions } from "nodemailer";
import { createMailTransport, type SmtpConnectionConfig } from "./mail-transport";

export interface RecoveryOptions {
  /** Inclusive — submissions on or after this date (UTC midnight). */
  since?: Date;
  /** Exclusive — only submissions after this calendar day (from next day UTC). */
  after?: Date;
  dryRun: boolean;
  deleteAfter: boolean;
  mailUser: string;
  mailPass: string;
  mailTo: string;
  /** Optional override; defaults to Firebase mail.host / mail.port when omitted. */
  smtp?: SmtpConnectionConfig;
}

export interface RecoveryResult {
  totalDocuments: number;
  withMessageContent: number;
  toRecover: number;
  sent: number;
  deleted: number;
  preview: Array<{ id: string; submittedAt: string; email: string; subject: string; ipAddress?: string }>;
}

function formatTimestamp(ts: admin.firestore.Timestamp | undefined | null): string {
  if (!ts) return "unknown date";
  if (typeof ts.toDate === "function") return ts.toDate().toISOString();
  return String(ts);
}

function submittedAtMs(data: FirebaseFirestore.DocumentData): number | null {
  const ts = data.submittedAt as admin.firestore.Timestamp | undefined;
  if (!ts) return null;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  return null;
}

function hasMessageBody(data: FirebaseFirestore.DocumentData): boolean {
  return Boolean(data.message || data.email || data.name);
}

function cutoffMs(options: RecoveryOptions): number | null {
  if (options.after) {
    const d = new Date(options.after);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.getTime();
  }
  if (options.since) return options.since.getTime();
  return null;
}

function buildEmail(
  doc: FirebaseFirestore.QueryDocumentSnapshot,
  mailUser: string,
  mailTo: string
): SendMailOptions {
  const data = doc.data();
  const submitted = formatTimestamp(data.submittedAt);
  const subject = (data.subject as string) || "(no subject)";
  const name = (data.name as string) || "Visitor";
  const email = data.email as string | undefined;

  return {
    from: `"DCCI Ministries Website Recovery" <${mailUser}>`,
    to: mailTo,
    replyTo: email ? `${name} <${email}>` : undefined,
    subject: `[Recovered contact form] ${subject}`,
    text: [
      "This message was recovered from the website database because email delivery had failed or was missed.",
      "",
      `Firestore document ID: ${doc.id}`,
      `Submitted at: ${submitted}`,
      "",
      `Name: ${data.name || "(none)"}`,
      `Email: ${data.email || "(none)"}`,
      `Subject: ${subject}`,
      `Newsletter opt-in: ${data.newsletter ? "yes" : "no"}`,
      data.ipAddress ? `IP address: ${data.ipAddress}` : "",
      "",
      "Message:",
      (data.message as string) || "(empty)",
      "",
      "---",
      "After Hatun has read this, run recovery again with delete=true to remove it from Firestore.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export async function recoverContacts(
  db: Firestore,
  options: RecoveryOptions
): Promise<RecoveryResult> {
  let snapshot: FirebaseFirestore.QuerySnapshot;
  try {
    snapshot = await db.collection("contacts").orderBy("submittedAt", "asc").get();
  } catch {
    snapshot = await db.collection("contacts").get();
  }

  const minMs = cutoffMs(options);
  const withBodies = snapshot.docs.filter((doc) => hasMessageBody(doc.data()));
  const toRecover = minMs
    ? withBodies.filter((doc) => {
        const ms = submittedAtMs(doc.data());
        return ms === null || ms >= minMs;
      })
    : withBodies;

  const preview = toRecover.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      submittedAt: formatTimestamp(d.submittedAt),
      email: (d.email as string) || "?",
      subject: (d.subject as string) || "?",
      ipAddress: (d.ipAddress as string) || undefined,
    };
  });

  const result: RecoveryResult = {
    totalDocuments: snapshot.size,
    withMessageContent: withBodies.length,
    toRecover: toRecover.length,
    sent: 0,
    deleted: 0,
    preview,
  };

  if (toRecover.length === 0 || options.dryRun) {
    return result;
  }

  const transport = createMailTransport(
    { user: options.mailUser, pass: options.mailPass },
    options.smtp
  );

  await transport.verify();

  for (const doc of toRecover) {
    const mail = buildEmail(doc, options.mailUser, options.mailTo);
    await transport.sendMail(mail);
    result.sent++;

    if (options.deleteAfter) {
      await doc.ref.delete();
      result.deleted++;
    }
  }

  return result;
}

export function parseRecoveryDate(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw.includes("T") ? raw : `${raw}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${raw} (use YYYY-MM-DD)`);
  }
  return d;
}
