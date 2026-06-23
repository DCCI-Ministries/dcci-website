# Technical Contact Handoff — For New Developers

This guide explains how to **safely replace the website/technical contact email** when a new developer takes over the site, while keeping ministry content contacts unchanged and meeting **UK/EU transparency expectations** for who visitors can reach about the website itself.

---

## Why this matters (UK / EU)

Visitors in the UK and EU have the right to know **who operates the website** and **how to contact someone** about:

- Website errors, accessibility barriers, and technical problems  
- How their data is handled on the site (privacy policy questions that are technical, not theological)  
- Security or abuse issues with the site infrastructure  

That contact is **not** the same as the ministry’s main content inbox. DCCI Ministries uses **three separate addresses** on purpose:

| Role | Config field | Typical use | Change on dev handoff? |
|------|----------------|-------------|------------------------|
| **Ministry / content** | `ministryInfoEmail` | Theology, articles, general ministry questions | **No** — unless ministry leadership decides |
| **Visitor contact form** | `contactFormRecipientEmail` | Messages submitted through the website contact form (Hatun’s ministry inbox) | **No** — unless ministry leadership decides |
| **Website / technical** | `technicalAdminEmail` | Bug reports, accessibility, privacy-policy technical contact, problem-report form, developer alerts | **Yes** — this is what you update |
| **Previous maintainer (private)** | `technicalSuccessionContactEmail` | Email the **outgoing** developer for help — **not** published on the site | **Yes** — set to outgoing dev’s email when you take over |

The public **Privacy Policy**, **Terms**, **Contact**, **Accessibility**, and **Disclaimer** pages all show `ministryInfoEmail` and `technicalAdminEmail` in separate sections so visitors know which address to use. `technicalSuccessionContactEmail` is **developers only** — see [Succession chain](../config/succession-chain.md).

---

## Single source of truth

All three addresses live in one file:

**[`config/site-contacts.json`](../config/site-contacts.json)**

```json
{
  "technicalAdminEmail": "admin@accessiblewebmedia.com",
  "ministryInfoEmail": "info@dcciministries.com",
  "contactFormRecipientEmail": "hatun@dcciministries.com",
  "technicalSuccessionContactEmail": "admin@accessiblewebmedia.com"
}
```

The Angular app, Astro SEO pages, Cloud Functions, and admin email guard all read from this file (or a **bundled copy** in `functions/` — see below). **You should not hunt through the codebase for hardcoded emails** — change the JSON, sync both copies, then rebuild and deploy.

### Two copies — keep them identical

Cloud Functions cannot read the repo-root `config/` folder at runtime. They bundle JSON from:

| File | Used by |
|------|---------|
| [`config/site-contacts.json`](../config/site-contacts.json) | Angular app, Astro SEO pages, admin guard |
| [`functions/src/config/site-contacts.json`](../functions/src/config/site-contacts.json) | `submitContactForm`, `submitWebsiteProblemReport`, `recoverContactEmails`, Hatun “report to developer” mailto links |

**When you change any contact address, update both files**, then `firebase deploy --only functions` (and `npm run build:all` + hosting if public pages change).

### SMTP credentials are separate (Firebase config only)

| Setting | Where | Purpose |
|---------|--------|---------|
| `mail.user` / `mail.pass` | `firebase functions:config:set` | Gmail (or Brevo) **sender** credentials only |
| `contactFormRecipientEmail` | `site-contacts.json` | Who receives **visitor** contact form mail |
| `technicalAdminEmail` | `site-contacts.json` | Who receives **website problem reports** |

**`mail.to` is not used** for the contact form or problem reports. Do not rely on it — recipients come from `site-contacts.json` only.

See also: [`config/README.md`](../config/README.md) and [`config/succession-chain.md`](../config/succession-chain.md)

---

## Succession chain — keep the previous developer reachable

You are not expected to figure out everything alone. **Document who came before you** and keep their email somewhere safe (this repo, a password manager, or your handoff notes).

### What to maintain

1. **[`config/succession-chain.md`](../config/succession-chain.md)** — human-readable table of maintainers (add yourself when you take over).  
2. **`technicalSuccessionContactEmail`** in `site-contacts.json` — the **immediate predecessor** for private technical questions.  
3. Your own copy of that email outside the repo if you prefer (do not lose it when cloning on a new machine).

### When you take over

1. Note the current `technicalAdminEmail` — that person is your succession contact.  
2. Set `technicalSuccessionContactEmail` to their email **before or when** you change `technicalAdminEmail` to yours.  
3. Add a row to `succession-chain.md`.  
4. Email them if you are stuck — use a clear subject so they recognize it is this project:

| Priority | Subject line |
|----------|----------------|
| **Urgent** (site down, security, broken deploy) | `Urgent: Hatun Website Question` |
| Normal (how-to, architecture, “why was it done this way?”) | `Hatun Website Question` |

**Do not** use these subjects for Hatun’s visitor contact-form mail or ministry content — those go to `ministryInfoEmail` / `contactFormRecipientEmail`.

### When you hand off to the next developer

Tell them to:

- Update `technicalAdminEmail` to their inbox  
- Set `technicalSuccessionContactEmail` to **your** email  
- Append a row to `succession-chain.md`  
- Use **`Urgent: Hatun Website Question`** if they need you quickly  

---

## Safe handoff: change only `technicalAdminEmail`

### Before you start

- [ ] You have **Firebase project access** (Console admin or equivalent)  
- [ ] You have **GitHub** access to deploy  
- [ ] Your replacement email is a **real inbox you monitor** (not `noreply@…`)  
- [ ] Ministry leadership knows Hatun will report site issues to the **new** technical address (see [Contact Form — Privacy and Reporting](./contact-form-privacy-and-reporting.md))  

### Step 1 — Edit the config

Open `config/site-contacts.json` **and** `functions/src/config/site-contacts.json` (same content in both):

1. Set **`technicalSuccessionContactEmail`** to the **outgoing** developer’s email (e.g. `admin@accessiblewebmedia.com` today).  
2. Change **`technicalAdminEmail`** to your inbox:

```json
"technicalAdminEmail": "your-new-dev@example.com",
"technicalSuccessionContactEmail": "admin@accessiblewebmedia.com"
```

3. Add yourself to [`config/succession-chain.md`](../config/succession-chain.md).

**Do not change** `ministryInfoEmail` or `contactFormRecipientEmail` unless the ministry explicitly asks.

### Step 2 — Admin access (if you need the dashboard)

1. Ministry adds you as an admin in Firestore `adminUsers` (see [Admin Access and Email Guard](./admin-access-and-email-guard.md)).  
2. Sign in with the **same email** you put in `technicalAdminEmail` (recommended).  
3. `technicalAdminEmail` is already included in the User Management email guard via `SITE_CONTACTS` — no code edit needed for the default two guarded addresses.

If your login email is **different** from `technicalAdminEmail`, you can still be an admin, but add your login email to `ALLOWED_EMAILS` in `src/app/services/user-management.service.ts` if you need User Management.

### Step 3 — Build and deploy

From the project root:

```bash
npm run build:all
```

Then deploy hosting and functions (adjust to your usual pipeline):

```bash
firebase deploy --only hosting,functions
```

**Why both matter:**

| Part | What updates |
|------|----------------|
| **Full build** (`build:all`) | Angular app + Astro static legal/contact pages |
| **Functions deploy** | Contact form → `contactFormRecipientEmail`; problem reports → `technicalAdminEmail`; Hatun report buttons → `technicalAdminEmail` |

Contact form visitor mail goes to `contactFormRecipientEmail` (Hatun), not to you, unless ministry changes that field in **both** `site-contacts.json` copies.

### Step 4 — Verify on the live site

Check that the **new** technical email appears on:

- `/privacy/` and `/app/privacy` — “Website, technical, or bug reports”  
- `/terms/` and `/app/terms`  
- `/contact/` and `/app/contact` — “Website, Technical, or Bug Reports”  
- `/accessibility/` and `/app/accessibility`  
- `/disclaimer/` and `/app/disclaimer`  

Ministry address (`ministryInfoEmail`) should still show as **content / theological** contact, unchanged.

### Step 5 — Functional tests

- [ ] Submit a **website problem report** (not the main contact form) — mail arrives at your new inbox  
- [ ] Submit the **contact form** as a test — mail still goes to the ministry inbox (`contactFormRecipientEmail`), not yours  
- [ ] Confirm you can sign in to `/admin/dashboard` if you are set up as admin  

### Step 6 — Outgoing developer cleanup

- [ ] Remove outgoing dev from Firebase / GitHub access as appropriate  
- [ ] Tell Hatun the new address for reporting spam or form issues ([owner’s guide](./owners-guide.md))  
- [ ] Update any **external** accounts still using the old email (Firebase billing alerts, GitHub org notifications, domain registrar — these are **outside** `site-contacts.json`)  

---

## What each technical touchpoint uses

| Feature | Email used | Config source |
|---------|------------|---------------|
| Public legal pages (technical line) | `technicalAdminEmail` | `config/site-contacts.json` |
| Website problem report form | `technicalAdminEmail` | `functions/src/config/site-contacts.json` → `submitWebsiteProblemReport` |
| Visitor contact form (delivery) | `contactFormRecipientEmail` | `functions/src/config/site-contacts.json` → `submitContactForm` |
| Hatun “report to developer” buttons in contact emails | `technicalAdminEmail` | `contact-dev-report.ts` |
| User Management email guard (default) | `technicalAdminEmail` + `contactFormRecipientEmail` | Angular `site-contacts.json` |
| Hatun reports spam/abuse to developer (manual email) | `technicalAdminEmail` | Documented in reporting guide |

---

## Contact form abuse — block list and repeat protection

When Hatun reports a **repeat harasser** (same person spamming the form), add them to the block list — **not** by censoring words like “wtf” (free speech stays allowed).

**Files (keep in sync):**

- [`config/contact-blocklist.json`](../config/contact-blocklist.json)
- [`functions/src/config/contact-blocklist.json`](../functions/src/config/contact-blocklist.json)

```json
{
  "blockedEmails": ["harasser@example.com"],
  "blockedIps": ["203.0.113.42"]
}
```

Find the sender’s IP in Firebase Console → Firestore → `contacts` (field `ipAddress` on older records) or from Hatun’s contact email headers / the recovery preview API.

Then deploy:

```bash
firebase deploy --only functions:submitContactForm
```

**Also active (no config edit needed):**

| Protection | Behavior | User sees |
|------------|----------|-----------|
| **5-minute pause** | Same email or IP must wait between sends | Exact wait time (“Please wait 4 minutes…”) |
| **Repeat message** | Same email + same subject/body within 30 days | “This message looks the same as one you already sent…” |
| **Block list** | Listed email or IP | “This contact form cannot accept messages from your email address…” |

Legitimate visitors can still send a **different** follow-up after a few minutes.

Full detail: [Contact Form — Privacy and Reporting](./contact-form-privacy-and-reporting.md) and [CONTACT_FORM_SETUP.md](../CONTACT_FORM_SETUP.md).

---

## Common mistakes (avoid these)

| Mistake | Why it’s bad |
|---------|----------------|
| Editing only root `config/site-contacts.json` and skipping `functions/src/config/` | Live contact form / problem reports still use old addresses |
| Relying on Firebase `mail.to` for recipients | **Not used** — only `site-contacts.json` controls who receives mail |
| Changing `contactFormRecipientEmail` during a dev handoff | Visitor mail goes to the wrong ministry inbox |
| Changing `ministryInfoEmail` | Breaks the public “content/theology” contact; not a developer task |
| Deploying Angular only, skipping Astro rebuild | Google-indexed `/privacy/`, `/terms/`, etc. still show the old technical email |
| Skipping `firebase deploy --only functions` | Problem reports still email the old address |
| Using an unmonitored alias | EU/UK expectation is a reachable contact for site and privacy questions |

---

## Privacy policy wording

The privacy policy already separates:

- **Theological / content** → `ministryInfoEmail`  
- **Website, technical, or bug reports** → `technicalAdminEmail`  

After handoff, no privacy-policy *text* change is required if only the address in `site-contacts.json` changes — the pages render the new email automatically. If the **legal entity** or **data controller** description changes (not just the developer), coordinate with ministry leadership and update the policy prose in `src/app/privacy/privacy.page.html` and `public-site/src/pages/privacy.astro`, then bump the “Last updated” date.

---

## Quick checklist (printable)

**Incoming developer**

1. Set `technicalSuccessionContactEmail` to outgoing dev; set `technicalAdminEmail` to yours **in both** `site-contacts.json` files  
2. Update [`config/succession-chain.md`](../config/succession-chain.md)  
3. `npm run build:all`  
4. `firebase deploy --only hosting,functions`  
5. Verify legal/contact pages show your email under **technical** headings only  
6. Test problem report email; confirm contact form still goes to ministry inbox (`testContactForm` endpoint shows configured addresses)  
7. Save predecessor contact; use subject **`Urgent: Hatun Website Question`** only when urgent  
8. Know how to update [`contact-blocklist.json`](../config/contact-blocklist.json) if Hatun reports a harasser

**Outgoing developer**

1. Hand off Firebase, GitHub, and domain access  
2. Confirm deploy completed with new `technicalAdminEmail`  
3. Notify Hatun / site owner of new reporting address  
4. Tell incoming dev your email is in `technicalSuccessionContactEmail` and succession-chain.md  

---

## Related documentation

- [`config/succession-chain.md`](../config/succession-chain.md) — maintainer history and email subject lines  
- [Admin Access and Email Guard](./admin-access-and-email-guard.md)  
- [Contact Form Setup](../CONTACT_FORM_SETUP.md)  
- [Contact Form — Privacy and Reporting](./contact-form-privacy-and-reporting.md)  
- [Project Handoff](./project-handoff.md)  

**Last updated:** June 2026
