/**
 * SMTP settings for local scripts (test-smtp, forward-firestore-contacts-to-hatun).
 * Defaults to Gmail — same as production when mail.host / mail.port are not set in Firebase.
 *
 * Override via env before Brevo migration:
 *   MAIL_HOST=smtp-relay.brevo.com MAIL_PORT=587 node scripts/test-smtp.js
 */

const nodemailer = require('../../functions/node_modules/nodemailer');

const DEFAULT_SMTP_HOST = 'smtp.gmail.com';
const DEFAULT_SMTP_PORT = 465;

function resolveSmtpConnection(source = {}) {
  const host = (source.host && String(source.host).trim()) || DEFAULT_SMTP_HOST;
  const portRaw = source.port;
  const port =
    portRaw !== undefined && portRaw !== '' && !Number.isNaN(Number(portRaw))
      ? Number(portRaw)
      : DEFAULT_SMTP_PORT;

  let secure;
  if (source.secure !== undefined && source.secure !== '') {
    secure = source.secure === true || source.secure === 'true';
  } else {
    secure = port === 465;
  }

  return { host, port, secure };
}

function getSmtpSettingsFromEnv() {
  return resolveSmtpConnection({
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    secure: process.env.MAIL_SECURE
  });
}

function createMailTransport(auth, connection) {
  const smtp = connection || getSmtpSettingsFromEnv();
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: auth.user,
      pass: auth.pass.replace(/\s/g, '')
    }
  });
}

module.exports = {
  DEFAULT_SMTP_HOST,
  DEFAULT_SMTP_PORT,
  resolveSmtpConnection,
  getSmtpSettingsFromEnv,
  createMailTransport
};
