# IP Blocking for Contact Form

> **⚠️ DEPRECATED — June 2026**  
> Blanket VPN / IP-range blocking was **removed** from the contact form. It blocked legitimate visitors who use VPNs for safety, especially in countries with restrictive internet laws.  
> **Current approach:** [CONTACT_FORM_SETUP.md](./CONTACT_FORM_SETUP.md) and [docs/contact-form-privacy-and-reporting.md](./docs/contact-form-privacy-and-reporting.md)

---

## Historical note

This document described an earlier implementation that blocked IP ranges commonly associated with VPNs (`111.x`, `185.x`, etc.). That approach is **no longer in the codebase**.

Do **not** re-enable VPN blocking without explicit ministry approval and an understanding that it will deny contact from many legitimate privacy-conscious visitors.

## What replaced it

- Server-side honeypot and timing checks
- Disposable email domain blocking
- Link limits and URL-shortener blocking
- Per-IP and per-email rate limits
- Spam keyword filters
- Optional Firebase App Check (off by default — see contact form docs)

## If you find old references

- `src/app/components/contact-form.component.ts` — VPN-specific error handling was removed
- `src/app/components/newsletter-signup.component.ts` — VPN-specific error handling was removed
- `src/app/components/website-problem-report.component.ts` — VPN-specific error handling was removed
- `functions/src/index.ts` — no VPN range checks on `submitContactForm`, `submitWebsiteProblemReport`, or newsletter subscription

For operational setup, use **[CONTACT_FORM_SETUP.md](./CONTACT_FORM_SETUP.md)**.
