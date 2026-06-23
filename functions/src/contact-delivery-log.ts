import * as admin from 'firebase-admin';

const COLLECTION = 'contactDeliveryFailures';

export interface ContactDeliveryFailureRecord {
  contactId: string;
  recipientEmail: string;
  smtpUser: string;
  failedAt: admin.firestore.FieldValue;
  errorCode: string | null;
  errorSummary: string;
  failureReason: string;
}

const SMTP_FAILURE_REASONS: Record<string, string> = {
  '535': 'SMTP login rejected — App Password invalid, expired, or revoked (often after a Google password change).',
  '534': 'SMTP authentication mechanism not accepted.',
  '550': 'Recipient rejected or mailbox unavailable.',
  '451': 'Temporary server error — retry later.',
  '452': 'Mailbox full or storage limit exceeded.',
  '421': 'SMTP service temporarily unavailable.'
};

/** Sanitize nodemailer/Gmail error for Firestore (no stack traces). */
export function summarizeEmailError(error: unknown): {
  errorCode: string | null;
  errorSummary: string;
  failureReason: string;
} {
  const message = error instanceof Error ? error.message : String(error);
  const firstLine = message.split('\n')[0].trim().slice(0, 500);
  const codeMatch = firstLine.match(/\b(535|534|550|451|452|421)\b/);
  const errorCode = codeMatch ? codeMatch[1] : null;

  let failureReason = SMTP_FAILURE_REASONS[errorCode ?? ''] ?? (firstLine || 'Unknown email delivery error');

  if (errorCode === '535' || /BadCredentials/i.test(firstLine)) {
    failureReason = SMTP_FAILURE_REASONS['535'];
  }

  return {
    errorCode,
    errorSummary: firstLine || 'Unknown email error',
    failureReason
  };
}

export async function logContactDeliveryFailure(
  db: admin.firestore.Firestore,
  params: {
    contactId: string;
    recipientEmail: string;
    smtpUser: string;
    error: unknown;
  }
): Promise<void> {
  const { errorCode, errorSummary, failureReason } = summarizeEmailError(params.error);

  const record: ContactDeliveryFailureRecord = {
    contactId: params.contactId,
    recipientEmail: params.recipientEmail,
    smtpUser: params.smtpUser,
    failedAt: admin.firestore.FieldValue.serverTimestamp(),
    errorCode,
    errorSummary,
    failureReason
  };

  await db.collection(COLLECTION).add(record);

  await db.collection('contacts').doc(params.contactId).update({
    emailDelivered: false,
    emailDeliveryFailedAt: admin.firestore.FieldValue.serverTimestamp(),
    emailDeliveryErrorCode: errorCode,
    emailDeliveryErrorSummary: errorSummary,
    emailDeliveryFailureReason: failureReason
  });
}
