# Admin Access and Email Guard

This document explains how admin access and the email allowlist (guard) work together for extra security, and what to do when someone is an admin in Firestore but still cannot access certain admin features.

## No one becomes an admin by signing up alone

The admin login page allows **account creation**, but new accounts are stored as **`Pending`** with **`isAdmin: false`**. They **cannot** open `/admin/dashboard` or any admin screen until a current admin promotes them.

| Action | Result |
|--------|--------|
| Sign up | Account created — role **Pending**, **not** a dashboard user |
| Sign in while Pending or User | **Denied** — admin must assign a role |
| Super Admin or Admin → **User Management** | Set role to Super Admin, Admin, or Moderator (or User for future comments) |
| Sign in after promotion | Dashboard access if role is Super Admin, Admin, or Moderator |

**Hatun:** assign **Super Admin** to `hatun@dcciministries.com` in User Management (ministry lead, full access).

**To add a new admin:** have them sign up (if needed), verify email, then a Super Admin or Admin assigns their role in **User Management**.

---

## Two Layers of Access Control

### 0. Admin assignment (required first)

Before the layers below matter, the user must have been assigned a **dashboard role** (Super Admin, Admin, or Moderator) in **User Management**. Pending, User, and sign-up alone never grant dashboard access.

### 1. Firestore admin status (required for dashboard access)

To use the admin dashboard, a user must:

- Have a document in **`adminUsers`** with:
  - `isAdmin: true` (set automatically for Super Admin, Admin, Moderator)
  - `userRole`: `'SuperAdmin'`, `'Admin'`, or `'Moderator'`
- Have **verified** their email in Firebase Auth
- Sign in with that same email

Without this, they cannot reach `/admin/dashboard` or any admin-only routes. The route guards (`adminGuard`, `adminOnlyGuard`) enforce this using Firestore data and Auth state.

### 2. Email guard / allowlist (extra security for sensitive features)

**Even when someone is set up as an admin in Firestore, their email must also be added to the guard** for them to access certain sensitive admin features. This is an extra security layer so that “admin” in the database does not automatically grant access to high-risk actions (such as managing users).

Currently, the guard applies to:

- **User Management** (`/admin/user-management`) — viewing, changing roles, and deleting admin users

If a user’s email is **not** in the allowlist, they will:

- Pass the route guard (because they are an admin in Firestore)
- Be redirected or blocked when the page checks the guard, with a message like “Access denied. You do not have permission to manage users.”

So: **Firestore admin + verified email** gets them into the dashboard and most admin areas; **Firestore admin + verified email + email in the guard** is required for User Management (and any future guard-gated features).

## Where the guard is defined

The allowlist is maintained in code:

- **File:** `src/app/services/user-management.service.ts`
- **Property:** `ALLOWED_EMAILS` (private array of email strings)

Example:

```ts
private readonly ALLOWED_EMAILS = [
  SITE_CONTACTS.technicalAdminEmail,
  SITE_CONTACTS.contactFormRecipientEmail
];
```

To change the default guarded emails, edit `config/site-contacts.json`, then build and deploy the app. If you need more than those two addresses, update the array in `src/app/services/user-management.service.ts`.

## Summary for “admin in Firestore but can’t access dashboard / user management”

| Situation | What to check |
|----------|----------------|
| Cannot access **dashboard** at all | Still **Pending** or **User**, or wrong role. A Super Admin or Admin must set role to Super Admin, Admin, or Moderator in **User Management**. Verify email and sign in with that address. |
| Can access **dashboard** but not **User Management** | They are an admin in Firestore; their email also needs to be in the guard. Add their email to `ALLOWED_EMAILS` in `src/app/services/user-management.service.ts` and redeploy. |

**In short:** Being an admin in Firestore is required but not always sufficient. For User Management (and any feature that uses the guard), their email must also be in the allowlist for extra security.

---

## Firestore & Storage rules (Super Admin)

**Super Admin** has the same database privileges as **Admin** today:

| Rule helper | Super Admin | Admin | Moderator |
|-------------|-------------|-------|-----------|
| `hasDashboardRole()` / `isAdminUser()` | Yes | Yes | Yes |
| `isFullAdmin()` (user delete, welcome draft, emergency settings) | Yes | Yes | No |

**Sign-up enforcement (server-side):** `adminUsers` **create** requires `isAdmin == false` and `userRole == 'Pending'`. Users cannot self-assign a dashboard role.

**Role assignment:** Only `isFullAdmin()` (Super Admin or Admin) can update another user’s `userRole` / `isAdmin`. Users may update their own doc for email verification and login metadata, but **not** escalate privileges.

**Storage:** uploads require `hasDashboardRole()` (Super Admin, Admin, or Moderator).

Planned **Creator** role and comment moderation are in **[Future Plans](./future-plans.md)** — not in rules yet.

Deploy after rule changes: `firebase deploy --only firestore:rules,storage`
