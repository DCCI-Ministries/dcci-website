# Meeting agenda — Ministry email (`info@`) and contact form

Use this in a live session with Hatun (and anyone who manages the domain). Goal: contact form mail goes to **`info@dcciministries.com`**, Hatun reads it at **`hatun@dcciministries.com`**, and when she **replies**, visitors see **`info@`** — not her personal address.

**Duration:** ~60–75 minutes  
**You need:** Cloudflare login, Firebase login, laptop, test contact form after changes

**Sending (contact form):** We will set up a **[Brevo](https://www.brevo.com)** account (free, ~9,000 emails/month) so the website does **not** depend on anyone’s Gmail password. **Hatun** (ministry) owns the Brevo account — not Alicia’s `admin@accessiblewebmedia.com`.

---

## Before the meeting (you)

- [ ] Confirm domain **`dcciministries.com`** is in [Cloudflare Dashboard](https://dash.cloudflare.com)
- [ ] Confirm whether **`hatun@dcciministries.com`** already uses **Google Workspace** (Gmail for business on the domain)
- [ ] Read **“Choose path A or B”** below and pick the right one
- [ ] Skim **[Contact form — recovery & independence plan](./contact-form-recovery-and-independence-plan.md)** (why we use Brevo instead of Gmail SMTP)

---

## Choose path A, B, or C (decide in first 5 minutes)

### Path A — Hatun already has `hatun@dcciministries.com` on Google Workspace (common)

**Do not move MX records to Cloudflare** — that would break her existing ministry mailbox.

Instead, in **Google Admin** (whoever manages Workspace):

1. Create **`info@dcciministries.com`** as either:
   - **Email alias** on Hatun’s user account, **or**
   - **Google Group** `info@` with Hatun as the only member (mail delivers to her inbox)
2. Skip Cloudflare Email Routing for `info@` (Google already receives `@dcciministries.com` mail).

Then jump to **Part 3 — Replies from `info@`** and **Part 4 — Brevo + contact form**.

### Path B — Use Cloudflare Email Routing (no Google Workspace on the domain)

Use this when ministry mail is **not** on Google Workspace — e.g. Hatun uses **personal Gmail** (`something@gmail.com`), **Outlook**, **Yahoo**, or email from a **hosting/cPanel** provider.

Cloudflare receives mail for `@dcciministries.com` and forwards addresses you define.

**Important:** Enabling Cloudflare Email Routing changes the domain’s **MX records** to Cloudflare. Any existing mailbox like `hatun@dcciministries.com` on GoDaddy/cPanel/another host **stops receiving** unless you add a Cloudflare rule for that address too (e.g. `hatun` → her personal inbox).

### Path C — No Google Workspace (personal email + Brevo for sending)

Same as Path B for **receiving** (Cloudflare `info@` → wherever Hatun actually reads mail).

**For sending the contact form:** use **Brevo** (Part 4) — not a new Gmail account and not Alicia’s email. Brevo uses an **SMTP key** that does **not** break when someone changes a Google login password.

Legacy option if Brevo is blocked: Zoho free mailbox for `info@` — see Part 3b. **Prefer Brevo** for the website.

---

## Part 1 — Cloudflare forwarding (`info@` → Hatun’s real inbox) — Path B / C

1. Log in to **Cloudflare** → select **dcciministries.com**
2. Go to **Email** → **Email Routing**
3. Click **Get started** / **Enable Email Routing**
4. Cloudflare will show **DNS records** (MX and possibly TXT). Click **Add records** / confirm — this points inbound mail for the domain to Cloudflare
5. Under **Routing rules** → **Custom addresses** → **Create address**:
   - **Custom address:** `info`
   - **Action:** Send to an email
   - **Destination:** Hatun’s **actual** inbox — e.g. `hatun@gmail.com`, `hatun@outlook.com`, or `hatun@dcciministries.com` if that mailbox still exists after MX change
6. If she uses other `@dcciministries.com` addresses today, add a forward rule for each (e.g. `hatun` → same destination) **before** you rely on the new MX records
7. Save

**Test (before leaving Cloudflare):**

- Send a normal email from your personal account **to** `info@dcciministries.com`
- Hatun checks **the destination inbox you chose** — message should arrive within a few minutes

If it does not arrive, check spam, DNS propagation (can take up to an hour), and that `hatun@` is the correct destination address.

---

## Part 2 — Path A quick steps (Google Workspace instead of Cloudflare)

1. [Google Admin](https://admin.google.com) → **Users** → Hatun → **User information** → **Alternate email (email alias)** → add `info@dcciministries.com`  
   **Or:** **Groups** → create `info@dcciministries.com` → add Hatun as member → enable mail to group
2. Test: email `info@dcciministries.com` → arrives in Hatun’s Gmail/Workspace inbox

---

## Part 3 — Replies look like they come from `info@` (Hatun — in meeting)

Use whichever app Hatun **actually reads** (personal Gmail, Outlook, Apple Mail, etc.).

### A. Personal Gmail (no Workspace)

1. Gmail → **Settings** → **Accounts and Import** → **Send mail as** → **Add another email address**
2. Name: `DCCI Ministries`, email: **`info@dcciministries.com`**
3. **Next** — verification email goes to `info@` → Cloudflare forwards it to her Gmail → open and confirm
4. If Gmail asks how to send:
   - Try **“Send through Gmail”** first (sometimes works after verification)
   - If Gmail refuses (common without Workspace), use **SMTP** from **Zoho** (Path C): server `smtp.zoho.eu` or `smtp.zoho.com`, port 587, Zoho `info@` password
5. Set **`info@`** as default; enable **“Reply from the same address the message was sent to”**

### B. Outlook / Outlook.com

1. **Settings** → **Mail** → **Sync email** → **Manage or choose a primary alias** / **Connected accounts**
2. Add **`info@dcciministries.com`** as an alias or “send from” address (wording varies)
3. Verify via email forwarded to her inbox
4. When replying to mail sent to `info@`, choose **From: info@**

### C. Apple Mail / other apps

Same idea: add `info@` as an additional identity, verify using the forwarded confirmation email, set default reply address to `info@`.

### D. Practice reply

1. You send a test message to `info@dcciministries.com` from your personal email
2. Hatun opens it in her inbox
3. She clicks **Reply**
4. You confirm the draft shows **From: info@dcciministries.com** (or DCCI Ministries &lt;info@…&gt;)
5. She sends — you confirm your inbox shows the reply **from info@**, not hatun@

**If Reply still shows her personal address:** Use the **From** dropdown and select `info@dcciministries.com`.

---

## Part 3b — Zoho `info@` mailbox (Path C — website sending + optional send-as)

Do this if there is **no Google Workspace** and Gmail will not send as `info@` without external SMTP.

1. Sign up at [Zoho Mail](https://www.zoho.com/mail/) → add domain **`dcciministries.com`**
2. Verify domain (TXT record in Cloudflare — does not have to move all MX to Zoho if you keep Cloudflare for forwarding)
3. Create user **`info@dcciministries.com`** — save the password securely
4. In Zoho: note **SMTP** host, port **587**, TLS — use for Firebase and for Gmail “send through SMTP” if needed
5. Optional: still use Cloudflare rule `info@` → Hatun’s personal Gmail so she does not need two inboxes

---

## Part 4 — Brevo account (Hatun owns it) + contact form sending

**Why Brevo:** Free tier (~300 emails/day), EU-friendly, sends **from** `info@dcciministries.com`, delivers **to** Hatun. Uses an **SMTP key** in Firebase — **not** tied to Gmail password changes.

**Account owner:** Hatun signs up with **her ministry email** (e.g. `hatun@dcciministries.com`). Alicia configures DNS + Firebase; Hatun keeps Brevo login for the long term.

### A. Create Brevo account (Hatun — ~10 min)

1. Hatun opens **[brevo.com](https://www.brevo.com)** → **Sign up free** (no credit card)
2. Use **ministry email** as the Brevo login — **not** `admin@accessiblewebmedia.com`
3. Skip marketing/newsletter upsells — you only need **transactional** email
4. Confirm email if Brevo sends a verification link

### B. Authenticate `dcciministries.com` (you — ~15–20 min)

1. Brevo → **Settings** → **Senders, domains & dedicated IPs** → **Domains** → **Add a domain**
2. Enter **`dcciministries.com`**
3. **DNS:** In **Cloudflare** (manual) or Brevo **automatic** connect if offered:
   - Add Brevo’s **TXT** (domain verification)
   - Add **DKIM** (TXT or CNAME)
   - Add **DMARC** (TXT) if shown
4. Wait for green **Authenticated** (often minutes; up to 24h)

### C. Create sender address

1. Brevo → **Senders** → add **`info@dcciministries.com`** (or `noreply@dcciministries.com`)
2. Must match the authenticated domain

### D. Create SMTP key (Hatun + you — save once)

1. Brevo → **Settings** → **SMTP & API** → **SMTP** tab → **Generate a new SMTP key**
2. Name it e.g. `DCCI website contact form`
3. **Copy the full key immediately** — Brevo will not show it again
4. Store in ministry password manager; you will paste into Firebase (not on screen share longer than needed)

**This is not Hatun’s Brevo login password.** It is a separate key only for the website.

### E. Update site config

Edit [`config/site-contacts.json`](../config/site-contacts.json):

```json
"contactFormRecipientEmail": "hatun@dcciministries.com"
```

(or `info@` if that is where she reads mail after forwarding)

### F. Firebase + code (you — after Brevo domain is green)

Developer updates the Cloud Function to use Brevo SMTP (`smtp-relay.brevo.com`, port 587) instead of Gmail, then:

```bash
npx firebase functions:config:set mail.host="smtp-relay.brevo.com"
npx firebase functions:config:set mail.user="HATUN_BREVO_LOGIN_EMAIL"
npx firebase functions:config:set mail.pass="BREVO_SMTP_KEY"
npm run deploy:functions
```

(Exact config keys depend on the code change — see [recovery plan](./contact-form-recovery-and-independence-plan.md).)

### G. Test contact form

1. Open live site contact form (wait **8+ seconds** before submit)
2. Use your personal email — **not** Hatun’s
3. Hatun receives **“Contact Form: …”** at her ministry inbox
4. **From** line should show ministry address (e.g. `info@` / DCCI Ministries)
5. Hatun replies — visitor sees **From: info@** if Part 3 is set up

### H. Retire Alicia’s Gmail for sending

- [ ] Confirm contact form works via Brevo
- [ ] Revoke any **App Password** on `admin@accessiblewebmedia.com` used for the old website setup
- [ ] Run Firestore recovery + delete old message bodies — [recovery plan](./contact-form-recovery-and-independence-plan.md)

---

## Part 4 (legacy) — Gmail / Zoho SMTP only if Brevo fails

Use only if Brevo signup or domain auth is blocked. **Not recommended** — Gmail App Passwords break when login passwords change.

<details>
<summary>Gmail App Password / Zoho fallback (expand if needed)</summary>

**Google Workspace (Path A):** App Password on `hatun@` or `info@` alias account.

**Zoho (Path C fallback):** See Part 3b below.

```bash
firebase functions:config:set mail.user="info@dcciministries.com"
firebase functions:config:set mail.pass="..."
npm run deploy:functions
```

</details>

---


## What the visitor sees (remind Hatun)

| Step | Visitor sees ministry email? |
|------|------------------------------|
| Filling contact form | **No** — only the form fields |
| After submit | **No** — thank-you message only |
| When Hatun replies | **Yes — `info@`** if Part 3 is set up correctly |

They never see `hatun@` on the website contact form.

---

## Meeting agenda (printable)

| Time | Topic | Who |
|------|--------|-----|
| 0–5 min | Path A / B / C — how Hatun receives `info@` mail | You + Hatun |
| 5–20 min | `info@` → Hatun’s inbox (Cloudflare or Google Admin) | You |
| 20–30 min | **Brevo account** — Hatun signs up with ministry email | Hatun (you guide) |
| 30–45 min | **Brevo domain auth** in Cloudflare + create sender + **SMTP key** | You + Hatun |
| 45–55 min | **Send mail as** `info@` in her mail app + test reply | Hatun |
| 55–65 min | Firebase Brevo config + deploy functions | You |
| 65–75 min | Live contact form test; confirm Alicia’s Gmail no longer used | Both |

### Hatun should bring

- **Ministry email** login (for Brevo signup — e.g. `hatun@dcciministries.com`)
- Phone for **2FA** on her mail provider if needed
- Login to the inbox she **actually reads**
- Password manager or safe way to store **Brevo login + SMTP key** (optional)

### Hatun does **not** need to give you

- Her normal email **login** password
- Alicia does **not** create a “handoff Gmail” — Brevo replaces that

### After the meeting (you)

- [ ] Brevo account owned by Hatun’s ministry email
- [ ] `dcciministries.com` authenticated in Brevo (green in dashboard)
- [ ] Cloud Function uses Brevo SMTP; Firebase `mail.*` updated
- [ ] `contactFormRecipientEmail` correct in `site-contacts.json`
- [ ] Firestore recovery sent to Hatun; message bodies deleted — [recovery plan](./contact-form-recovery-and-independence-plan.md)
- [ ] Revoke `admin@accessiblewebmedia.com` App Password for website
- [ ] Share [Contact Form — Privacy and Reporting](./contact-form-privacy-and-reporting.md) with Hatun

---

## Related docs

- [Contact form — recovery & independence plan](./contact-form-recovery-and-independence-plan.md)
- [Technical Contact Handoff](./technical-contact-handoff.md)
- [Contact Form Setup](../CONTACT_FORM_SETUP.md)
- [config/succession-chain.md](../config/succession-chain.md)

**Last updated:** June 2026
