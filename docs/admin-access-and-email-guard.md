# Admin Access and Email Guard

This document explains how admin access and the email allowlist (guard) work together for extra security, and what to do when someone is an admin in Firestore but still cannot access certain admin features.

## Two Layers of Access Control

### 1. Firestore admin status (required for all admin access)

To use the admin dashboard at all, a user must:

- Have a document in the **`adminUsers`** collection in Firestore with:
  - `isAdmin: true`
  - `userRole`: `'Admin'` or `'Moderator'` (as appropriate)
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
| Cannot access **dashboard** at all | Ensure they have an `adminUsers` document with `isAdmin: true`, correct `userRole`, and have verified their email. They must sign in with that email. |
| Can access **dashboard** but not **User Management** | They are an admin in Firestore; their email also needs to be in the guard. Add their email to `ALLOWED_EMAILS` in `src/app/services/user-management.service.ts` and redeploy. |

**In short:** Being an admin in Firestore is required but not always sufficient. For User Management (and any feature that uses the guard), their email must also be in the allowlist for extra security.
