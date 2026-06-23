/**
 * Site user roles. Pending = new sign-up awaiting approval.
 * User = future public accounts (profiles, article comments) — no dashboard.
 *
 * Planned (not implemented): Creator — publish articles only; see docs/future-plans.md
 */
export type UserRole = 'Pending' | 'User' | 'Moderator' | 'Admin' | 'SuperAdmin' | null;

export const USER_ROLE_LABELS: Record<NonNullable<UserRole>, string> = {
  Pending: 'Pending',
  User: 'User',
  Moderator: 'Moderator',
  Admin: 'Admin',
  SuperAdmin: 'Super Admin'
};

/** Roles that may sign in to the admin dashboard (Moderator = limited). */
export function hasDashboardAccess(role: UserRole | undefined, isAdmin?: boolean): boolean {
  if (role === 'SuperAdmin' || role === 'Admin' || role === 'Moderator') {
    return true;
  }
  if (role === 'Pending' || role === 'User') {
    return false;
  }
  // Legacy accounts: isAdmin before userRole existed
  return isAdmin === true;
}

/**
 * Full dashboard features (content, user management, welcome page, emergency controls).
 * Admin currently matches SuperAdmin; may be narrowed later.
 */
export function hasFullDashboardAccess(role: UserRole | undefined, isAdmin?: boolean): boolean {
  if (role === 'SuperAdmin' || role === 'Admin') {
    return true;
  }
  if (role === 'Moderator' || role === 'User' || role === 'Pending') {
    return false;
  }
  return isAdmin === true;
}

/** Whether Firestore `isAdmin` should be true for this role. */
export function roleGrantsIsAdmin(role: UserRole): boolean {
  return hasDashboardAccess(role);
}

export function getRoleDisplayName(role: UserRole | undefined): string {
  if (!role) return USER_ROLE_LABELS.Pending;
  return USER_ROLE_LABELS[role] ?? role;
}

export function getRoleColor(role: UserRole | undefined): string {
  switch (role) {
    case 'SuperAdmin': return 'tertiary';
    case 'Admin': return 'success';
    case 'Moderator': return 'warning';
    case 'User': return 'primary';
    default: return 'medium';
  }
}
