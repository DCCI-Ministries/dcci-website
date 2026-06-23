# Site contact configuration

**Change contact addresses in one place:** [`site-contacts.json`](./site-contacts.json)

## New developer taking over the website?

Read **[Technical Contact Handoff](../docs/technical-contact-handoff.md)** — step-by-step guide to replace the **website/technical** email safely (UK/EU compliance), without changing ministry content or contact-form inboxes.

---

## Fields

| Field | Purpose | Change when? |
|-------|---------|--------------|
| `technicalAdminEmail` | Website developer / technical admin — bug reports, accessibility, problem reports, privacy **technical** contact, default admin email guard | **Developer handoff** — new maintainer sets their own inbox |
| `ministryInfoEmail` | General ministry inquiries on legal pages (content, theology) | **Ministry decision only** — not a developer handoff task |
| `contactFormRecipientEmail` | Ministry inbox for visitor contact form messages (Hatun) | **Ministry decision only** — not a developer handoff task |
| `technicalSuccessionContactEmail` | **Previous** maintainer’s private email for dev questions — **not on public pages** | **On handoff** — set to outgoing dev; next dev sets it to you when they replace you |

Also maintain the human-readable history in **[`succession-chain.md`](./succession-chain.md)**.

---

## After editing `site-contacts.json`

**Update both copies** (`config/site-contacts.json` and `functions/src/config/site-contacts.json`), then redeploy:

| Change affects | Deploy |
|----------------|--------|
| Public pages (privacy, terms, contact, accessibility, disclaimer) | `npm run build:all` + hosting deploy |
| Contact form delivery (`contactFormRecipientEmail`) | `firebase deploy --only functions:submitContactForm` |
| Website problem report emails (`technicalAdminEmail`) | `firebase deploy --only functions:submitWebsiteProblemReport` |
| Contact form “report to developer” buttons in Hatun’s emails | Same as above (uses `technicalAdminEmail` in functions copy) |
| Admin dashboard / User Management guard | Angular build + hosting deploy |

**SMTP sender** (`mail.user` / `mail.pass`) is set in Firebase config only — not in these JSON files. **`mail.to` is not used** for recipients.

---

## Harasser block list — `contact-blocklist.json`

When Hatun reports someone abusing the contact form, add their email and/or IP:

| File | Used by |
|------|---------|
| [`contact-blocklist.json`](./contact-blocklist.json) | Documentation / human reference |
| [`functions/src/config/contact-blocklist.json`](../functions/src/config/contact-blocklist.json) | `submitContactForm` (bundled at deploy) |

```bash
firebase deploy --only functions:submitContactForm
```

Does **not** block words or opinions — only listed emails/IPs and automatic repeat-message detection. See [Technical Contact Handoff](../docs/technical-contact-handoff.md#contact-form-abuse--block-list-and-repeat-protection).

---

## Wired in code

- `src/app/config/site-contacts.ts` — Angular pages  
- `public-site/src/lib/siteContacts.ts` — Astro SEO pages  
- `functions/src/site-contacts.ts` — `submitContactForm`, `submitWebsiteProblemReport`, `recoverContactEmails`, `contact-dev-report.ts`  
- `functions/src/contact-blocklist.ts` — harasser email/IP block list  
- `src/app/services/user-management.service.ts` — `technicalAdminEmail` + `contactFormRecipientEmail` in email guard  

Documentation references this file instead of hardcoding addresses.
