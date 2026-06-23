# Future Plans — Roles, Comments, and Moderation

**Status:** Planning only — not implemented unless a task explicitly says otherwise.  
**Last updated:** June 2026

This document captures intended features so developers and ministry leadership share the same roadmap. See **[Admin Access and Email Guard](./admin-access-and-email-guard.md)** for what is live today.

---

## Implemented today (reference)

| Role | Dashboard | Notes |
|------|-----------|--------|
| **Pending** | No | **Every new sign-up** — enforced in app (`auth.ts`) and Firestore rules |
| **User** | No | Assigned manually; no public features yet |
| **Moderator** | Limited | YouTube settings; most Quick Actions hidden |
| **Admin** | Full (for now) | May be narrowed vs Super Admin later |
| **Super Admin** | Full | Hatun — ministry lead; same Firestore rules as Admin today |

Code: `src/app/models/user-roles.ts`, guards, `firestore.rules`, `storage.rules`.

---

## Planned role: Creator

**Purpose:** People who may **write and publish articles** but must **not** control the website (welcome page, users, emergency settings, YouTube, etc.).

| Capability | Creator (planned) |
|------------|-------------------|
| Create / edit / publish own articles | Yes |
| Welcome page, user management, emergency controls | No |
| Admin dashboard (full) | No — dedicated **content-only** area or subset of routes |
| Firestore `content` writes | Scoped rules (own drafts + publish) |
| Storage uploads | Article images only |

**Implementation sketch (when built):**

1. Add `Creator` to `UserRole` in `user-roles.ts`.
2. `isAdmin: false` (or separate `canPublishContent` flag — decide at implementation).
3. New guard, e.g. `contentEditorGuard`, for `/admin/content/*` only.
4. Firestore: `allow create/update` on `content` when `userRole == 'Creator'` and `authorId == request.auth.uid`.
5. User Management: Super Admin / Admin can assign Creator.
6. Update in-app guide and `admin-dashboard.md`.

**Not started** — document only.

---

## Planned: User role + article comments

**Purpose:** Registered visitors with **profiles** who can **comment on articles** — not dashboard users.

| Capability | User (planned) |
|------------|----------------|
| Admin dashboard | No |
| Public profile | Yes (future) |
| Comment on articles | Yes (future) |
| Sign-up path | Likely separate from admin login, or same Auth with `userRole: 'User'` |

**Data model (draft):**

- `users/{uid}` or extend `adminUsers` with non-dashboard roles only on `adminUsers` today.
- `comments/{id}` with `articleId`, `authorId`, `body`, `status`, `createdAt`.
- Public read for approved comments; create requires `userRole == 'User'` and account in good standing.

**Not started** — document only.

---

## Planned: Moderator comment moderation

When comments exist, **Moderators** gain tools **without** full website admin:

| Action | Moderator (planned) |
|--------|---------------------|
| Hide / delete individual comments | Yes |
| **Block** user from commenting | Yes |
| **Probation** (timeout) | Yes — e.g. 3 days, 7 days, custom end date |
| Change site welcome page / users | No |

**Probation / timeout (draft):**

```json
{
  "commentStatus": "active" | "blocked" | "probation",
  "probationUntil": "<timestamp or null>",
  "moderationNotes": "internal only"
}
```

- On comment submit: reject if `blocked` or `now < probationUntil`.
- Moderator UI: quick actions on comment or user profile.
- Audit log optional (`moderationActions` collection).

**Not started** — document only.

---

## Planned: Narrow Admin vs Super Admin

Today **Admin** and **Super Admin** share full dashboard and `isFullAdmin()` in Firestore. Future options:

- Super Admin only: user management, emergency controls, welcome page publish, delete users.
- Admin: content + YouTube; no user role changes.
- Creator: content publish only (see above).

Track in issues/tasks when ministry confirms the split.

---

## Security checklist (live)

| Check | Where |
|-------|--------|
| New account → `userRole: 'Pending'`, `isAdmin: false` | `auth.ts` signUp |
| Firestore rejects self-elevated create | `adminUsers` create rule |
| Self-update cannot change `isAdmin` / `userRole` | `adminUsers` update rule |
| Only Super Admin / Admin assign roles | `isFullAdmin()` on admin user updates |
| Super Admin in `isFullAdmin()` | `firestore.rules`, `deleteUser` function |
| Pending / User cannot sign in to dashboard | `auth.ts` signIn, `adminGuard` |
| Moderator cannot delete users | `isFullAdmin()` on delete, Cloud Function |

After changing rules: `firebase deploy --only firestore:rules,storage`

---

## Related docs

- [Admin Dashboard Guide](./admin-dashboard.md)
- [Admin Access and Email Guard](./admin-access-and-email-guard.md)
- [Technical Architecture](./technical-architecture.md)
