# Firebase Functions

Cloud Functions for the DCCI Ministries website: contact form, newsletter, analytics, YouTube sync, and admin utilities.

## Setup

```bash
cd functions
npm install
npm run build
```

### Email credentials (contact form + newsletter)

```bash
firebase functions:config:set mail.user="your-sender@gmail.com"
firebase functions:config:set mail.pass="your-app-password"
```

Use a Google **App Password**, not your regular password.

### Optional: enforce App Check on contact form

```bash
firebase functions:config:set security.enforce_app_check="true"
```

Requires `appCheckRecaptchaSiteKey` in the Angular production environment and App Check registration in Firebase Console. See [CONTACT_FORM_SETUP.md](../CONTACT_FORM_SETUP.md).

### Deploy

```bash
firebase deploy --only functions
```

## Key functions

| Function | Purpose |
|----------|---------|
| `submitContactForm` | Contact form → email to configured `contactFormRecipientEmail`; metadata-only Firestore log |
| `submitWebsiteProblemReport` | Problem reports → configured `technicalAdminEmail` |
| `subscribeToNewsletter` | Newsletter signups |
| `unsubscribeFromNewsletter` | Newsletter unsubscribe |
| `getContactStats` | Admin dashboard message/subscriber counts |
| `trackPageView` | Visitor analytics |
| `getStorageUsage` | Admin storage stats |
| `onArticleUpdate` | Triggers Astro rebuild when articles change |
| `onWelcomePageUpdate` | Triggers Astro rebuild when welcome page content changes |
| `testContactForm` | Health check for mail config |

Full contact form behaviour, security layers, and privacy: **[CONTACT_FORM_SETUP.md](../CONTACT_FORM_SETUP.md)**.

## Security (contact form)

Implemented in `functions/src/sanitization.ts` and `functions/src/contact-security.ts`:

- Honeypot, timing check, HTML sanitization, spam keywords
- Disposable email blocking, link limits, rate limiting
- Optional Firebase App Check verification

Message bodies are **not** stored in Firestore.

## Local development

```bash
npm run serve
```

Uses `.env` in `functions/` when present (see dotenv loading in `src/index.ts`).
