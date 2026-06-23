# Contact Form Setup Guide

This guide covers the DCCI Ministries contact form: email delivery, privacy, security, and deployment.

## Overview

| Item | Detail |
|------|--------|
| **Component** | `src/app/components/contact-form.component.*` |
| **Service** | `src/app/services/contact.service.ts` |
| **Cloud Function** | `submitContactForm` in `functions/src/index.ts` |
| **Recipient** | `config/site-contacts.json` → `contactFormRecipientEmail` |
| **Sender (SMTP)** | Gmail via `mail.user` / `mail.pass` in Firebase config |
| **Problem reports** | Separate function → `config/site-contacts.json` → `technicalAdminEmail` |

## Email flow

1. Visitor submits the form on `/welcome` or `/contact`
2. Cloud Function validates and sanitizes input
3. Email is sent to **Hatun** with `Reply-To` set to the visitor's address
4. A **metadata-only** record is written to Firestore (`contacts` collection)
5. Hatun replies using **Reply** in her mail client

**No admin/monitor inbox shield** — messages go straight to Hatun.

## Design philosophy: privacy, access, and the “bind”

The contact form balances three goals:

1. **Global access** — Visitors in restrictive countries may need VPNs or strict privacy tools; we do not block them for that.
2. **Direct ministry contact** — Mail goes to Hatun; the site manager does not read her inbox.
3. **Minimal data retention** — Full message text is **not** stored in Firestore (only timestamps for counts). Storing messages in the database would help spam review but creates a privacy risk if the database is ever accessed wrongly.

**Hatun is the front line.** She reports spam, abuse, or form failures to the site manager. See **[Contact Form — Privacy and Reporting](./docs/contact-form-privacy-and-reporting.md)** for her training guide.

### Why we do not use Google reCAPTCHA (default)

reCAPTCHA and Firebase App Check (reCAPTCHA v3) can block or frustrate legitimate users — VPN users, privacy browsers, regions where Google is restricted, and people with accessibility needs. That conflicts with reaching Christians under surveillance. We use **server-side** protections instead (honeypot, timing, rate limits, disposable-email blocking, link rules). App Check remains **optional and off** unless spam justifies the tradeoff.

### Why we do not block VPN IP addresses

Blanket VPN blocking was removed in June 2026. It rejected many legitimate visitors who use VPNs for safety. See deprecated [IP_BLOCKING_SETUP.md](./IP_BLOCKING_SETUP.md).

## Firestore logging (privacy)

Message content is **not** stored. Each successful submission creates:

```json
{
  "submittedAt": "<timestamp>",
  "newsletterOptIn": true | false
}
```

- **Dashboard → Messages** counts documents in `contacts`
- **Recent Activity** shows “Contact form submission received” (no names or message text)
- **Newsletter opt-ins** from the contact form still save to `subscribers` when checked

Rate-limit metadata (no message content) uses:
- `contactRateLimits` — per-IP cooldown
- `contactEmailRateLimits` — per-email daily cap

## Setup

### 1. Install dependencies

```bash
cd functions && npm install
```

### 2. Configure Gmail SMTP

Generate a [Google App Password](https://myaccount.google.com/) (requires 2FA), then:

```bash
firebase functions:config:set mail.user="your-sender@gmail.com"
firebase functions:config:set mail.pass="your-app-password"
```

Only `mail.user` and `mail.pass` are required. There is no `mail.to` for the contact form.

### 3. Deploy

```bash
npm run deploy:functions
firebase deploy --only firestore:rules   # if rules changed
```

### 4. Environment files

Ensure `firebaseFunctionsUrl` is set in `src/environments/environment*.ts`.

Optional App Check (see Security section):

```typescript
appCheckRecaptchaSiteKey: "your-recaptcha-v3-site-key",
```

## Email format Hatun receives

- **To:** `config/site-contacts.json` → `contactFormRecipientEmail`
- **From:** `DCCI Ministries Website <mail.user>`
- **Reply-To:** Visitor's name and email
- **Subject:** `Contact Form: {visitor subject}`
- **Body:** Name, email, subject, and message (plain + HTML-escaped)
- **Footer for Hatun:** Two mailto links to the current `technicalAdminEmail` — report suspicious or solicitation/spam (pre-filled subject `Urgent: Hatun Website Question — …`). Implemented in `functions/src/contact-dev-report.ts`.

IP addresses are **not** included in the email body.

## Security features

Designed to block abuse while allowing legitimate visitors (including VPN users).

| Layer | Description |
|-------|-------------|
| **Honeypot** | Hidden `website` field; bots are silently rejected |
| **Timing** | Form must be open ≥ 8 seconds before submit |
| **Sanitization** | HTML stripped; scripts/`javascript:` patterns blocked |
| **Email escape** | HTML entities escaped in outbound email |
| **Spam keywords** | Common SEO/crypto/promo phrases rejected |
| **Disposable emails** | Throwaway domains (Mailinator, Guerrilla Mail, etc.) blocked |
| **Link limits** | Max 3 links; URL shorteners (bit.ly, tinyurl, …) blocked |
| **Rate limits** | 5 min per IP + 3 submissions per email per 24 h (after successful send) |
| **App Check** | Optional invisible reCAPTCHA v3 — **off by default** (see Design philosophy above) |

**Removed (2026-06-21):** Blanket VPN IP range blocking — it blocked legitimate users in privacy-sensitive regions.

### Enable Firebase App Check (optional — not recommended unless spam is severe)

App Check uses Google reCAPTCHA v3 and can block some real visitors. Only enable after ministry agreement that the spam problem outweighs access risk.

1. [Google reCAPTCHA admin](https://www.google.com/recaptcha/admin) — create a **v3** key for your domain
2. Firebase Console → **App Check** → register web app with reCAPTCHA v3
3. Add site key to `src/environments/environment.prod.ts`:
   ```typescript
   appCheckRecaptchaSiteKey: "your-recaptcha-v3-site-key",
   ```
4. Deploy the Angular app; test contact form submissions
5. Enforce on the server:
   ```bash
   firebase functions:config:set security.enforce_app_check="true"
   firebase deploy --only functions
   ```
6. Until step 5, the API accepts requests without App Check (dev-friendly).

## Testing

```bash
npm start                    # Angular app
cd functions && npm run serve  # optional local functions
```

1. Open `/welcome` or `/contact`
2. Fill the form (wait at least 8 seconds)
3. Submit — check Hatun's inbox
4. Test endpoint: `https://[region]-[project].cloudfunctions.net/testContactForm`

## Troubleshooting

| Issue | Check |
|-------|--------|
| Failed to send | `firebase functions:log` — verify `mail.user` / `mail.pass`; check Firestore **`contactDeliveryFailures`** (admin dashboard shows count) |
| Disposable email error | Use a normal Gmail/Outlook/etc. address |
| Too many links | Max 3; no shorteners — use full URLs |
| Please wait… | IP cooldown (5 min) or email limit (3/day) |
| Forbidden / verify request | App Check enforced but key missing — configure or disable enforce |
| CORS errors | Redeploy functions; verify `firebaseFunctionsUrl` |

## Customization

- **Styling:** `src/app/components/contact-form.component.scss`
- **Validation rules:** `functions/src/sanitization.ts`, `functions/src/contact-security.ts`
- **Recipient email:** `config/site-contacts.json` → `contactFormRecipientEmail` (sync `functions/src/config/site-contacts.json`)
- **Email template:** `submitContactForm` handler in `functions/src/index.ts`

## Related documentation

- **[Technical Contact Handoff](./docs/technical-contact-handoff.md)** — replace website/technical email on developer handoff (UK/EU)
- **[Contact Form — Privacy and Reporting](./docs/contact-form-privacy-and-reporting.md)** — why no reCAPTCHA/VPN blocking; Hatun reporting guide
- **[Content Management — Editing the Welcome Page](./docs/content-management.md#editing-the-welcome-page)**
- **[Owner's Guide — Contact messages](./docs/owners-guide.md)**
- **[Dev Log — 2026-06-21](./docs/dev-log.md)**
