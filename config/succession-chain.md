# Technical maintainer succession chain

This file is for **developers only**. It is **not** shown on the public website.

Keep a short history of who maintained the DCCI Ministries website so each new developer knows whom to contact for institutional knowledge, emergencies, or “how did we decide X?” questions.

---

## Current chain

| Order | Maintainer | Email (private dev contact) | Active from | Handed off to |
|-------|------------|-------------------------------|-------------|---------------|
| 1 | Alicia (Accessible Web Media) | `admin@accessiblewebmedia.com` | Project rebuild | *(next developer — add row when you take over)* |

Also recorded in [`site-contacts.json`](./site-contacts.json) as `technicalSuccessionContactEmail` — the **immediate predecessor** you may email for help.

---

## Instructions for a new developer

When you become the technical maintainer:

1. **Before** you change `technicalAdminEmail` to your address, copy the current value — that person is your succession contact.
2. Set `technicalSuccessionContactEmail` in `site-contacts.json` to the **outgoing** developer’s email (keep it even after you update `technicalAdminEmail`).
3. **Add a new row** to the table above (name, email, dates, who you replaced).
4. Store predecessor contact somewhere **you** will not lose (password manager, handoff notes, team wiki) — do not rely on memory alone.
5. When **you** hand off to someone else, tell them to do the same: update the chain, set `technicalSuccessionContactEmail` to your email, and give them the suggested subject line below.

---

## Contacting the previous maintainer

The previous developer is a volunteer consultant, not Hatun’s inbox monitor. Email them only for **site architecture, Firebase, deploy, or “why was it built this way?”** questions — not for visitor contact-form mail or ministry content.

**Suggested subject lines** (so they recognize the message immediately):

| Priority | Subject line |
|----------|----------------|
| Urgent (site down, security incident, deploy broken) | `Urgent: Hatun Website Question` |
| Non-urgent (clarification, how-to, design question) | `Hatun Website Question` |

Include in the body:

- What you tried  
- Error messages or URLs  
- Whether production or staging is affected  

---

## When you hand off to the next developer

Tell them explicitly:

- Read [Technical Contact Handoff](../docs/technical-contact-handoff.md)  
- Update `technicalAdminEmail` and keep your email in `technicalSuccessionContactEmail`  
- Update this succession table  
- Use **`Urgent: Hatun Website Question`** if they need you quickly  

Hatun’s contact form emails automatically use the new `technicalAdminEmail` in their “report to developer” links — no change needed on her side.

**Last updated:** June 2026
