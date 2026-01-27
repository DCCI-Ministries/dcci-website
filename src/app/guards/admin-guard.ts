import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { defer, from, of, timer, race } from 'rxjs';
import { map, switchMap, filter, take, catchError, combineLatest } from 'rxjs';
import { Auth as FirebaseAuth } from '@angular/fire/auth';
import { AuthService, AdminUser } from '../services/auth';
import { SiteSettingsService } from '../services/site-settings.service';

/**
 * Guard for pages that Admins and Moderators can access
 * Used for: Dashboard, YouTube Settings, Comments Settings (eventually)
 * NOTE: Nuclear lockdown blocks ALL access, including admins
 */
export const adminGuard: CanActivateFn = (route, state) => {
  const auth = inject(FirebaseAuth);
  const authService = inject(AuthService);
  const siteSettingsService = inject(SiteSettingsService);
  const router = inject(Router);

  // Wait for Firebase Auth to initialize by waiting for currentUser Promise
  return defer(() => {
    // Create a Promise that resolves when auth state is determined
    return new Promise<import('@angular/fire/auth').User | null>((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }).pipe(
    switchMap((firebaseUser) => {
      // If no Firebase user, redirect to welcome
      if (!firebaseUser) {
        return of(router.createUrlTree(['/welcome']));
      }

      // Wait for site settings (filter out null/undefined)
      const settings$ = siteSettingsService.settings$.pipe(
        filter((settings): settings is NonNullable<typeof settings> => settings != null),
        take(1)
      );

      // Wait for AuthService to load user data
      // AuthService listens to onAuthStateChanged, so it should emit user data after Firebase user is available
      // We wait for a user that matches the Firebase user's UID, with a timeout fallback
      const userDataWithTimeout$ = authService.currentUser$.pipe(
        // Filter for when user data is loaded (matches Firebase user UID)
        filter((user) => {
          // If user is null, keep waiting (AuthService might still be loading)
          // If user exists and matches Firebase user, we have the data
          return user !== null && user.uid === firebaseUser.uid;
        }),
        take(1)
      );

      // Race between user data loading and timeout (3 seconds)
      const userData$ = race(
        userDataWithTimeout$,
        timer(3000).pipe(map(() => null))
      );

      // Combine settings and user data
      return combineLatest([settings$, userData$]).pipe(
        map(([settings, user]: [any, AdminUser | null]) => {
          // NUCLEAR LOCKDOWN: Blocks ALL access, including admins
          if (settings.nuclearLockdown) {
            return router.createUrlTree(['/admin/maintenance']);
          }

          // Allow users with Admin or Moderator role
          if (user && user.isAdmin && user.emailVerified &&
              (user.userRole === 'Admin' || user.userRole === 'Moderator')) {
            return true;
          } else {
            // Redirect to welcome page if not admin/moderator or email not verified
            return router.createUrlTree(['/welcome']);
          }
        })
      );
    }),
    catchError(() => of(router.createUrlTree(['/welcome'])))
  );
};
