import * as functions from "firebase-functions";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

/** Default until Brevo migration — matches current production Gmail App Password setup. */
export const DEFAULT_SMTP_HOST = "smtp.gmail.com";
export const DEFAULT_SMTP_PORT = 465;

export interface SmtpAuth {
  user: string;
  pass: string;
}

export interface SmtpConnectionConfig {
  host: string;
  port: number;
  secure: boolean;
}

type SmtpConfigSource = {
  host?: string;
  port?: string | number;
  secure?: string | boolean;
};

/** Resolve host/port/secure from Firebase mail.* or plain objects (scripts). */
export function resolveSmtpConnection(source?: SmtpConfigSource): SmtpConnectionConfig {
  const host = (source?.host && String(source.host).trim()) || DEFAULT_SMTP_HOST;
  const portRaw = source?.port;
  const port =
    portRaw !== undefined && portRaw !== "" && !Number.isNaN(Number(portRaw))
      ? Number(portRaw)
      : DEFAULT_SMTP_PORT;

  let secure: boolean;
  if (source?.secure !== undefined && source.secure !== "") {
    secure = source.secure === true || source.secure === "true";
  } else {
    // 465 = implicit TLS; 587 and others use STARTTLS (secure: false).
    secure = port === 465;
  }

  return { host, port, secure };
}

/** Read SMTP connection from Firebase Functions config (`mail.host`, `mail.port`, optional `mail.secure`). */
export function getSmtpSettings(): SmtpConnectionConfig {
  const mail = (functions.config().mail || {}) as SmtpConfigSource;
  return resolveSmtpConnection(mail);
}

export function createMailTransport(auth: SmtpAuth, connection?: SmtpConnectionConfig): Transporter {
  const smtp = connection || getSmtpSettings();
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: auth.user,
      pass: auth.pass.replace(/\s/g, ""),
    },
  });
}
