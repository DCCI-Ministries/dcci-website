# Contact Form — Privacy, Security Choices, and Reporting

This document explains **why** the contact form is set up the way it is, and how **Hatun** (and future site owners) should work with the **site manager / developer** when something goes wrong.

It is written for ministry leadership and anyone maintaining the site — not for visitors.

---

## The privacy bind

The contact form has three competing goals:

1. **Visitors can reach the ministry** — including people in countries with restrictive laws who rely on VPNs, Tor, or strict browser privacy settings.
2. **Hatun receives messages in her own inbox** — she replies directly; the ministry relationship stays personal.
3. **Visitor privacy is protected** — message content should not sit in a database where the wrong admin, hacker, or subpoena could expose it.

We **cannot** fully solve spam and abuse by having a developer “monitor Hatun’s inbox.” That would require reading private correspondence between visitors and the ministry, which we do not do.

We **could** store full messages in Firestore for an admin dashboard or spam review. That was rejected because:

- A database breach or misconfigured access would expose **everyone’s** contact messages.
- More copies of sensitive mail (DB + email) means more risk.
- GDPR-style access/deletion requests become harder when data is duplicated.

**Current compromise:** messages go **only to Hatun’s email**. Firestore keeps **metadata only** (`submittedAt`, newsletter opt-in flag) for dashboard counts — **no names, subjects, or message bodies**.

---

## Why we do **not** use Google reCAPTCHA

reCAPTCHA (including invisible v3 used by Firebase App Check) can **block or frustrate legitimate users**, especially:

- People on VPNs or privacy networks
- Visitors in regions where Google services are restricted or unreliable
- Users with ad blockers or strict browser privacy
- People with accessibility needs (challenges, screen readers)

Our audience includes Christians in **countries where surveillance and censorship are real**. Requiring Google bot-scoring as a gate to contact the ministry is at odds with that mission.

**What we use instead** (server-side, no Google gate on the form):

- Honeypot field (bots fill it; humans never see it)
- Minimum time on the form before submit
- HTML/script stripping and email escaping
- Disposable throwaway-email blocking
- Link limits and URL-shortener blocking
- Rate limits per IP and per email address
- Spam keyword filters

Firebase App Check + reCAPTCHA v3 remains **optional and off by default**. We will only enable it if spam becomes severe **and** we accept the tradeoff of possibly blocking some real visitors.

---

## Why we do **not** block VPN IP addresses

Blanket VPN IP blocking was tried and **removed** (June 2026). It rejected many legitimate users who:

- Use a VPN to reach Christian content safely
- Share an IP range with spammers by bad luck
- Connect through corporate or mobile networks

Blocking VPNs prioritizes spam convenience over **access for the persecuted or privacy-conscious**. That is the wrong default for this ministry.

---

## Hatun: your role and what to report

You are the **front line** for contact form mail. The site manager **does not** read your inbox and **cannot** see message text in the admin dashboard.

### Normal day-to-day

- Read messages in your ministry contact inbox (`contactFormRecipientEmail` in site config — currently Hatun’s address)
- Use **Reply** in your email app to answer genuine inquiries
- **Do not click links** in messages unless you trust the sender — treat unknown links like any other email
- You do **not** need to report every message

### Easy way to ask the developer about one message

**Every contact form email you receive includes links at the bottom** to email the **current website developer** (`technicalAdminEmail` in config — it updates automatically when a new dev takes over).

1. Open the contact form email  
2. Scroll to **“Need help with this message?”**  
3. Click one of these (your email app will open a draft with visitor details and message pre-filled):
   - **Ask developer a question** — anything unclear about this message  
   - **Report suspicious** — scams, phishing, anything unsafe  
   - **Report spam / solicitation** — marketing, SEO offers, junk  
   - **Report threatening / harassment** — serious abuse or threats  

The draft includes the visitor’s name, email, subject, message, contact ID, and IP (when available). For questions, add your text after **“My question:”** then send.

**Use Reply** for real visitors. **Use the developer links** only when you want help tightening site security — not for normal ministry replies.

### Report to the site manager when (without a specific email)

Contact the **technical admin address** (`technicalAdminEmail` in `config/site-contacts.json`) if:

| Situation | What to say |
|-----------|-------------|
| **Spam is increasing** | “I’m getting many more junk contact form emails than usual” — approximate count per day is helpful |
| **Phishing or scam mail** | “Suspicious contact form message” — **do not forward the full email** unless you are comfortable; describe the subject line and whether it asked for money, passwords, or clicks |
| **Threats or harassment** | “Serious harassment via contact form” — say if it feels repeated or targeted |
| **Visitors say the form failed** | “Someone told me the contact form wouldn’t send” — include their country if known (VPN users sometimes hit rate limits) |
| **You clicked something suspicious** | Report immediately so credentials and the site can be checked |
| **Anything that feels like a security incident** | Report early — better a false alarm than silence |

### What **not** to expect from the site manager

- They will **not** routinely read your inbox or pre-screen mail
- They will **not** see message bodies in the website admin panel
- They **can** adjust server-side filters, rate limits, and (only if agreed) stronger bot checks

### Suggested report email subject lines

When using the **links in a contact form email**, the subject is filled in for you (`Urgent: Hatun Website Question — …`).

If you write your own email (e.g. general spam increase):

- `Urgent: Hatun Website Question — Contact form spam increase`
- `Hatun Website Question — Contact form not working for visitors`

---

## For developers and future maintainers

- **Recipient:** `config/site-contacts.json` → `contactFormRecipientEmail`
- **Problem reports** (separate form): `config/site-contacts.json` → `technicalAdminEmail`
- **Operational guide:** [CONTACT_FORM_SETUP.md](../CONTACT_FORM_SETUP.md)
- **Deprecated:** [IP_BLOCKING_SETUP.md](../IP_BLOCKING_SETUP.md) — VPN blocking removed; do not re-enable without ministry approval

When Hatun reports an issue, tune `functions/src/sanitization.ts` and `functions/src/contact-security.ts` rather than asking for inbox access.

Contact form emails to Hatun include **mailto links** (see `functions/src/contact-dev-report.ts`) that pre-address the current `technicalAdminEmail`.

---

**Last updated:** June 2026
