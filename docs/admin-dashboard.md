# Admin Dashboard Guide

This guide explains the **Admin Dashboard** — what each section shows and what you can do from it.

**In the website:** Admins and moderators can open **How to use this** on the dashboard (`/admin/guide`) — a plain-language guide built into the app (no technical jargon).

For article editing, see **[Content Management](./content-management.md)**. For contact form privacy and what the dashboard **cannot** show, see **[Contact Form — Privacy and Reporting](./contact-form-privacy-and-reporting.md)**.

---

## Security: no self-service admin access

**Nobody can open the admin dashboard just by creating an account.** This is intentional.

| Step | What happens |
|------|----------------|
| 1. Person signs up on the admin login page | Account is created as **Pending** with `isAdmin: false` — **no dashboard access** |
| 2. Person verifies their email | Required before login, but still **not** an admin |
| 3. Person tries to sign in while still Pending or User | Login is rejected — an admin must assign a dashboard role first |
| 4. **Super Admin or Admin** opens **User Management** | Sets role to **Super Admin**, **Admin**, or **Moderator** — dashboard roles set `isAdmin: true` |
| 5. Person signs in again | Can reach `/admin/dashboard` |

There is **no public “become an admin” path**. Every admin (except the very first account, set up by the developer) must be **assigned by a current admin** through User Management.

Share this with ministry staff via the in-app guide (**How to use this** on the dashboard).

---

## Signing in

1. Open the website and go to **`/admin/login`** (or use the admin login link your developer gave you).
2. Sign in with your **admin email** and password.
3. **Verify your email** if prompted — unverified accounts cannot use admin tools.
4. You land on **`/admin/dashboard`**.

If login fails or you are sent back to the public welcome page, see **[Admin Access and Email Guard](./admin-access-and-email-guard.md)**.

---

## User roles

| Role | Dashboard | What they can do |
|------|-----------|------------------|
| **Pending** | No | Signed up; waiting for approval. Cannot sign in to admin. |
| **User** | No | Future: profiles and article comments. Not implemented yet. |
| **Moderator** | Limited | Dashboard + **YouTube Settings** only. Most Quick Actions hidden. |
| **Admin** | Yes (full for now) | Content, welcome page, user management, emergency controls. May be narrowed later. |
| **Super Admin** | Yes (full) | **Everything.** Hatun (`hatun@dcciministries.com`) should hold this role. |

**Assign roles:** User Management → role dropdown (Pending, User, Moderator, Admin, Super Admin).

**Code:** `src/app/models/user-roles.ts` — `hasDashboardAccess()` and `hasFullDashboardAccess()`.

**Planned (not built):** Creator role, User comments, Moderator probation — **[Future Plans](./future-plans.md)**.

Quick Actions marked **full admin** below are shown to **Super Admin** and **Admin** (same access for now). Moderators see YouTube Settings only.

**User Management** also requires your email on the allowlist in site config — see [Admin Access and Email Guard](./admin-access-and-email-guard.md).

---

## Dashboard layout

```
┌─────────────────────────────────────────────────────────┐
│  Header: welcome message, role chips, Logout              │
├──────────┬──────────┬──────────┬──────────┤ Quick stats │
│  Users   │ Messages │Newsletter│  Views   │             │
├──────────┴──────────┴──────────┴──────────┴─────────────┤
│ Quick Actions │ Recent Activity │ Overall Usage          │
└─────────────────────────────────────────────────────────┘
```

---

## Quick stats (top row)

| Card | What it counts | Where data comes from |
|------|----------------|------------------------|
| **Users** | Admin accounts with `isAdmin: true` | Firestore `adminUsers` |
| **Messages** | Successful contact form submissions | Firestore `contacts` (metadata only — **not** message text) |
| **Newsletter** | Active newsletter sign-ups | Firestore `subscribers` |
| **Views** | Unique visitors (rolling) | Firestore `stats/siteStats` |

### Important: Messages stat is **not** Hatun’s inbox

The **Messages** number is how many contact forms **successfully reached the server** and logged a timestamp. It does **not** list who wrote or what they said. Real messages go to Hatun’s ministry email. If the count goes up but she did not receive mail, contact the technical admin — see [Contact Form Setup](../CONTACT_FORM_SETUP.md) troubleshooting.

---

## Quick Actions

| Button | Route | Who | What it does |
|--------|-------|-----|--------------|
| **Create Content** | `/admin/content/create` | Super Admin + Admin | New article or page in the Quill editor |
| **Archive Content** | `/admin/content/archive` | Super Admin + Admin | Create/import archived (historical) articles |
| **Manage Content** | `/admin/content/manage` | Super Admin + Admin | List drafts and published articles; edit or delete |
| **Youtube Settings** | `/admin/youtube-settings` | All dashboard roles | YouTube channel / auto-import settings |
| **User Management** | `/admin/user-management` | Super Admin + Admin (+ email guard) | Assign roles: Pending, User, Moderator, Admin, Super Admin |
| **Welcome Page** | `/admin/welcome-settings` | Super Admin + Admin | Edit the public home/welcome page (see below) |
| **Site Management** | `/admin/emergency-controls` | Super Admin + Admin | Read-only mode, maintenance, nuclear lockdown |

---

## Recent Activity

A merged feed (newest first) of up to several dozen items from:

| Source | Example line | Privacy note |
|--------|--------------|--------------|
| Published articles | `Article published: "…"` | Shows title only |
| Contact form | `Contact form submission received` | **No** sender name or message |
| Newsletter | `Newsletter subscription: user@example.com` | Shows email |
| Draft edits | `Draft updated: "…"` | Shows title only |

Use this for a quick sense of site activity — **not** for reading contact form mail.

---

## Overall Usage

Shows Firebase **free-tier** consumption so you know before limits bite:

| Meter | Meaning |
|-------|---------|
| **Storage** | Images and files in Firebase Storage (article images, welcome page uploads, etc.) |
| **Firestore Database** | Database size (articles, settings, metadata) |
| **Combined** | Storage + Firestore vs combined free-tier cap |

Bars turn **warning** (yellow) around 80% and **danger** (red) around 95%. If usage is high, talk to your developer about cleanup or upgrading Firebase.

---

## Welcome Page editor

Open from **Quick Actions → Welcome Page** or `/admin/welcome-settings`.

### What you can change

| Section | What you edit |
|---------|----------------|
| Header & logo | Tagline, logo image |
| Hero | Title, subtitle, banner image |
| Mission | Heading + rich text |
| Social | Intro text + **custom link buttons** (label, URL, icon) |
| Support | Intro text + **giving links** (PayPal, Patreon, etc. — any label/URL) |
| Testimony | Statement + verse |
| SEO | Page title and description for Google |

**Not editable here** (fixed in the page layout): contact form, newsletter signup, article carousel, footer.

### Draft → Preview → Publish (recommended workflow)

Visitors only see changes after you **Publish live**. Until then, the public `/welcome` page stays unchanged.

```
  Edit in admin
       │
       ▼
  Save draft ──────────────┐
       │                   │ (optional)
       ▼                   ▼
  Preview          Discard draft → reload live page into editor
  (/admin/welcome-preview)
       │
       ▼
  Publish live → visitors see changes + SEO page rebuilds
       │
       └── previous live page saved in "Previous versions" (last 10)
```

| Button | Effect |
|--------|--------|
| **Save draft** | Stores work in `adminSettings/welcomeDraft`. **Live site unchanged.** |
| **Preview** | Saves draft, opens admin-only preview with yellow banner. |
| **Publish live** | Archives current live page, writes draft to live, triggers search-engine rebuild. |
| **Discard draft** | Deletes draft; editor reloads what is currently live. |

### Previous versions (rollback)

After each **Publish live**, the **previous** live configuration is archived (up to **10** versions).

For each saved version you can:

- **Load into editor** — opens that snapshot as your draft (nothing goes live until you publish).
- **Publish** — makes that old version live immediately (current live page is archived first).

Use this when a redesign did not work out and you want the old welcome page back.

### Read-only mode

If **Site Management → Read-only mode** is on, Save draft, Preview, and Publish are disabled until an admin turns it off.

### Technical storage (for developers)

| Document | Purpose | Who can read |
|----------|---------|--------------|
| `siteSettings/welcome` | **Live** public page | Everyone |
| `adminSettings/welcomeDraft` | Working draft | Full admins only |
| `adminSettings/welcomeVersions/versions/{id}` | Archived publishes | Full admins only |

More detail: [Content Management — Welcome Page](./content-management.md#editing-the-welcome-page).

---

## What the dashboard does **not** do

- **Read contact form messages** — by design (privacy). Hatun uses her email inbox.
- **Preview article changes on the live site** before publish — articles use their own draft/publish flow in Manage Content.
- **Change ministry contact email addresses** — those live in `config/site-contacts.json` (developer task).
- **Fix SMTP / email delivery** — developer configures Firebase; see [Contact Form Setup](../CONTACT_FORM_SETUP.md).

---

## Related documentation

| Topic | Document |
|-------|----------|
| Articles & Quill editor | [Content Management](./content-management.md) |
| Welcome page (technical) | [Content Management — Welcome Page](./content-management.md#editing-the-welcome-page) |
| Contact form & Hatun reporting | [Contact Form — Privacy and Reporting](./contact-form-privacy-and-reporting.md) |
| Emergency / read-only mode | [Emergency Procedures](./emergency-procedures.md) |
| Admin login issues | [Admin Access and Email Guard](./admin-access-and-email-guard.md) |
| Non-technical overview | [Owner's Guide](./owners-guide.md) |

**Last updated:** June 2026
