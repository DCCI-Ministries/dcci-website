# Contact form — recovery & full independence plan

**Status:** Urgent — contact form submissions were saved in Firestore but **not emailed to Hatun** while the Google App Password for `admin@accessiblewebmedia.com` was invalid (likely revoked when that account’s main password changed).

**Goals:**

1. **Recover** every stored contact message and get it to Hatun.
2. **Fix** live contact form delivery to Hatun **today or before the meeting**.
3. **Remove Alicia’s email** from sending, receiving, and password-rotation risk.
4. **Stop storing message bodies** in Firestore (metadata only) after recovery.
5. **Delete** recovered contact documents from Firestore so a database breach does not expose visitor messages.

---

## What broke (plain language)

| Piece | What happened |
|-------|----------------|
| **Visitor** | Saw “message sent” (success) |
| **Firestore** | Full messages were saved in `contacts` |
| **Hatun’s inbox** | **Nothing** — Gmail rejected the website’s send password (`535 BadCredentials`) |
| **Cause** | Website sends mail using an **App Password** on `admin@accessiblewebmedia.com`. Changing the **main** Google password usually **revokes** all App Passwords. |

The admin dashboard only shows **counts**, not message text. Missed mail is in **Firestore → `contacts`**, not in anyone’s inbox.

---

## Target end state (no dependency on Alicia)

| Role | Address | Notes |
|------|---------|--------|
| **Contact form → Hatun** | `hatun@dcciministries.com` or `info@` → forward to Hatun | Visitor never sees her address on the form |
| **SMTP sender (`mail.user`)** | Ministry-owned account (`info@` or dedicated ministry Gmail) | **Dedicated App Password** only for the website — not anyone’s day-to-day login password |
| **Public ministry email** | `info@dcciministries.com` | Shown on legal/contact pages only |
| **Technical / website problems** | `technicalAdminEmail` → future EU maintainer | Not Alicia long-term; see [technical-contact-handoff.md](./technical-contact-handoff.md) |
| **Firestore `contacts`** | Timestamp + newsletter opt-in **only** | No names, emails, or message bodies |

**Rule:** The person who **owns** the sending mailbox creates and stores the App Password in Firebase. If they change their **login** password, they must create a **new App Password** for the website (or use a mailbox nobody logs into except for this).

---

## Phase 1 — Today (recover + stop the bleeding)

### 1A. See what’s in Firestore (5 min)

1. [Firebase Console → Firestore](https://console.firebase.google.com/project/dcci-ministries/firestore/data/~2Fcontacts)
2. Open collection **`contacts`**
3. Sort by **`submittedAt`** (newest first)
4. Note how many documents exist and the date range

**Manual option:** Open each document, copy name / email / subject / message into one email to Hatun (or a spreadsheet), then continue to 1C.

### 1B. Forward stored contacts to Hatun (script — recommended)

After SMTP works (step 2), run the one-time recovery script:

```bash
# Service account: Firebase Console → Project settings → Service accounts → Generate new private key
# Save JSON outside the repo; set path:
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/dcci-ministries-service-account.json"

# Ministry or temporary sender (see Phase 2)
export MAIL_USER="sender@example.com"
export MAIL_PASS="google-app-password-here"
export MAIL_TO="hatun@dcciministries.com"

# Preview what will be sent (no email, no delete)
node scripts/forward-firestore-contacts-to-hatun.js --dry-run

# Only messages from when email broke (avoid duplicates she already got in inbox)
node scripts/forward-firestore-contacts-to-hatun.js --dry-run --since 2026-06-11

# Send one summary email per stored contact to Hatun
node scripts/forward-firestore-contacts-to-hatun.js --send --since 2026-06-11

# After Hatun confirms she received them — remove those documents from Firestore
node scripts/forward-firestore-contacts-to-hatun.js --send --delete --since 2026-06-11
```

`--delete` removes each `contacts` document **only after** its email was sent successfully. Use **`--since YYYY-MM-DD`** to skip older submissions Hatun already received by email (e.g. before your Google password change on 11 June 2026).

### 1C. Confirm with Hatun

Ask Hatun to confirm she received:

- All recovered messages from Firestore
- A new test submission from the live site (Phase 2)

---

## Phase 2 — Fix live form (ministry-owned mail, not Alicia)

Pick **one** path. Goal: `mail.user` is **not** `admin@accessiblewebmedia.com`.

### Path A — Quick bridge (today only, if meeting is later)

If you need the form working **before** ministry email is ready:

1. New App Password on `admin@accessiblewebmedia.com` (temporary)
2. `npx firebase functions:config:set mail.pass="new-app-password"`
3. Test: `MAIL_PASS="..." node scripts/test-smtp.js`
4. Submit live contact form → Hatun receives mail
5. Run Phase 1B recovery script
6. **Revoke** that App Password and switch to Path B as soon as ministry mail exists

**Do not treat this as the long-term fix.**

### Path B — Ministry Gmail (free, good if no Workspace)

1. Create **`dcciministries.contact@gmail.com`** (or similar) — ministry-owned, Hatun has login
2. Enable 2FA → create App Password **`DCCI Website SMTP`** (never changes unless they revoke it)
3. Firebase:
   ```bash
   npx firebase functions:config:set mail.user="dcciministries.contact@gmail.com"
   npx firebase functions:config:set mail.pass="ministry-app-password"
   npx firebase functions:config:set mail.to="hatun@dcciministries.com"
   ```
4. Test SMTP + live form
5. Hatun can read that Gmail **or** set Gmail to forward everything to her usual inbox

### Path C — `info@` + Cloudflare + **Brevo** (see meeting agenda)

Best public face (`info@`) and reliable sending without Gmail passwords. Full steps: **[meeting-agenda-hatun-email-setup.md](./meeting-agenda-hatun-email-setup.md)** (Part 4 — Brevo account owned by Hatun).

---

## Phase 3 — Deploy code changes (privacy + no Alicia in config)

After Hatun has all recovered mail and live delivery works:

### 3A. Update `config/site-contacts.json`

```json
{
  "technicalAdminEmail": "<future-EU-maintainer-or-ministry-tech@>",
  "ministryInfoEmail": "info@dcciministries.com",
  "contactFormRecipientEmail": "hatun@dcciministries.com",
  "technicalSuccessionContactEmail": "<outgoing-dev-for-private-handoff>"
}
```

Remove `admin@accessiblewebmedia.com` from **contact form** paths. Succession email can stay until handoff is documented in [config/succession-chain.md](../config/succession-chain.md).

### 3B. Redeploy functions (metadata-only storage)

Re-apply the improved `submitContactForm` (on your branch / after merge):

- Recipient from `site-contacts.json` → Hatun
- **No** full message in Firestore (metadata only)
- Email failure returns error to visitor (so you know immediately if SMTP breaks again)
- Optional: Hatun “report to developer” links in email footer

```bash
npm run deploy:functions
```

Ensure `functions/tsconfig.json` `include` lists all needed `src/*.ts` files before deploy (see dev notes in git history).

### 3C. Verify Firestore is clean

1. Collection **`contacts`** — only documents with `submittedAt` (+ optional `newsletterOptIn`), **no** `message` / `email` / `name`
2. Re-run recovery script with `--dry-run` — should report **0** documents with message bodies

### 3D. Revoke Alicia’s access to sending

1. Google → `admin@accessiblewebmedia.com` → App Passwords → **revoke** any “DCCI” / website passwords
2. Confirm Firebase `mail.user` is ministry account only:
   ```bash
   npx firebase functions:config:get
   ```

---

## Phase 4 — Hatun meeting (finish independence)

Use **[meeting-agenda-hatun-email-setup.md](./meeting-agenda-hatun-email-setup.md)**.

| # | Task | Owner |
|---|------|--------|
| 1 | Ministry sending mailbox + App Password **only for website** | Hatun + you |
| 2 | `info@` → Hatun’s inbox (Google alias or Cloudflare) | You |
| 3 | Gmail “Send as `info@`” so replies look official | Hatun |
| 4 | **Brevo account** (Hatun’s ministry email) + domain auth + SMTP key → Firebase | Hatun + you |
| 5 | Live test + recovery confirmed | Both |
| 6 | Alicia App Password revoked; no mail to `admin@` for contact form | You |

---

## Phase 5 — Ongoing (so this never surprises you again)

### Monitoring

- [ ] After any password change on the **sending** Google account → new App Password → update `mail.pass`
- [ ] Monthly: submit test message on live site; Hatun confirms receipt
- [ ] `npx firebase functions:log --only submitContactForm` if anyone reports form issues

### If SMTP breaks again

Symptoms: visitors see error **or** (on old code) success but Hatun gets nothing.

1. Check logs for `535` / `BadCredentials`
2. New App Password on **ministry** sender (not personal dev email)
3. `npx firebase functions:config:set mail.pass="..."`
4. Test with `scripts/test-smtp.js`

### Document ownership

| Asset | Owner after handoff |
|-------|---------------------|
| Firebase project | Ministry + named technical contact |
| `mail.user` mailbox | Ministry (Hatun or `info@`) |
| Cloudflare DNS | Ministry |
| App Password in Firebase | Rotated only by mailbox owner |

---

## Checklist (printable)

### Urgent — do first

- [ ] Count documents in Firestore `contacts`
- [ ] Fix SMTP (Path B or temporary Path A)
- [ ] Run `forward-firestore-contacts-to-hatun.js --send`
- [ ] Hatun confirms recovered messages received
- [ ] Run `--send --delete` to remove stored messages
- [ ] Live contact form test → Hatun inbox

### Independence — do next

- [ ] `mail.user` = ministry account (not `admin@accessiblewebmedia.com`)
- [ ] Deploy metadata-only contact function
- [ ] Revoke Alicia website App Password(s)
- [ ] Update `site-contacts.json` / succession docs
- [ ] Hatun meeting: `info@`, Brevo, reply-as-info

### Done when

- [ ] Hatun gets every new form submission by email
- [ ] Firestore has **no** visitor message content
- [ ] Changing Alicia’s Google password does **not** affect the website
- [ ] No contact form mail to or from `admin@accessiblewebmedia.com`

---

## Related docs

- [Meeting agenda — Hatun email setup](./meeting-agenda-hatun-email-setup.md)
- [Contact form setup](../CONTACT_FORM_SETUP.md)
- [Privacy & reporting](./contact-form-privacy-and-reporting.md)
- [Technical contact handoff](./technical-contact-handoff.md)
- [config/succession-chain.md](../config/succession-chain.md)

**Last updated:** June 2026
