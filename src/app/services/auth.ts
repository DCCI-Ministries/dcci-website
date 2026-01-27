import { Injectable, NgZone, Injector, runInInjectionContext } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Firestore, collection, doc, getDoc, setDoc, updateDoc, query, where, getDocs, serverTimestamp } from '@angular/fire/firestore';
import { Auth as FirebaseAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User, sendEmailVerification, applyActionCode, checkActionCode, confirmPasswordReset, sendPasswordResetEmail, verifyPasswordResetCode, ActionCodeSettings } from '@angular/fire/auth';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { SanitizationService } from './sanitization';
import { environment } from '../../environments/environment';

export interface AdminUser {
  uid: string;
  email: string;
  isAdmin: boolean;
  userRole?: 'Pending' | 'Admin' | 'Moderator' | null;
  emailVerified: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface FailedAttempt {
  email: string;
  attempts: number;
  lastAttempt: Date;
  lockedUntil?: Date;
  ipAddress?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<AdminUser | null>(null);
  public currentUser$: Observable<AdminUser | null> = this.currentUserSubject.asObservable();

  constructor(
    private firestore: Firestore,
    private auth: FirebaseAuth,
    private router: Router,
    private sanitization: SanitizationService,
    private ngZone: NgZone,
    private injector: Injector,
    private http: HttpClient
  ) {
    // Listen for auth state changes
    this.auth.onAuthStateChanged(async (user: User | null) => {
      if (user) {
        // Only load user data if user is verified (to avoid errors during signup)
        if (user.emailVerified) {
          // Use runInInjectionContext to ensure Firebase APIs are called within injection context
            await this.ngZone.run(async () => {
            await runInInjectionContext(this.injector, async () => {
              await this.loadUserData(user.uid);
            });
          });
        } else {
          // For unverified users, just set basic user info
          this.ngZone.run(() => {
            this.currentUserSubject.next({
              uid: user.uid,
              email: user.email || '',
              isAdmin: false,
              emailVerified: user.emailVerified,
              createdAt: new Date()
            });
          });
        }
      } else {
        this.ngZone.run(() => {
          this.currentUserSubject.next(null);
        });
      }
    });
  }

  /**
   * Sign up a new admin user
   */
  async signUp(email: string, password: string, honeypot?: string): Promise<{ success: boolean; message: string; needsVerification?: boolean; isLocked?: boolean }> {
    try {
      // Check honeypot field - if filled, it's likely a bot
      if (honeypot && honeypot.trim() !== '') {
        console.log('Bot detected via honeypot in signUp');
        return { success: false, message: 'Invalid request. Please try again.' };
      }

      // Ensure we're in the proper Angular zone
      return await this.ngZone.run(async () => {
        try {
          // Sanitize inputs
          const sanitizedEmail = this.sanitization.sanitizeEmail(email);
          const sanitizedPassword = this.sanitization.sanitizePassword(password);

          // Validate inputs
          if (!this.sanitization.isValidEmail(sanitizedEmail)) {
            return { success: false, message: 'Please enter a valid email address.' };
          }

          if (!this.sanitization.isValidPassword(sanitizedPassword)) {
            return { success: false, message: 'Password must be at least 8 characters long and contain both letters and numbers.' };
          }

          // Create user with Firebase Auth
          const userCredential = await createUserWithEmailAndPassword(this.auth, sanitizedEmail, sanitizedPassword);
          const user = userCredential.user;

          // Send email verification with custom action code settings
          // Firebase's hosted handler will verify the email, then redirect to our page
          const actionCodeSettings: ActionCodeSettings = {
            url: `https://dcciministries.com/auth/action?uid=${encodeURIComponent(user.uid)}&verified=1`,
            handleCodeInApp: false
          };
          await sendEmailVerification(user, actionCodeSettings);

          // Create user document in Firestore
          const userData: AdminUser = {
            uid: user.uid,
            email: sanitizedEmail,
            isAdmin: false, // Will be set to true manually in Firestore
            userRole: 'Pending', // New users start as Pending
            emailVerified: false, // Will be updated when email is verified
            createdAt: new Date()
          };

          await setDoc(doc(this.firestore, 'adminUsers', user.uid), userData);

          return { success: true, message: 'Account created successfully! Please check your email and verify your account before logging in.' };
        } catch (error: any) {
          console.error('Sign up error:', error);

          // Handle specific error cases
          if (error.code === 'auth/email-already-in-use') {
            return {
              success: false,
              message: 'An account with this email already exists. Please try signing in instead, or use a different email address.'
            };
          }

          return { success: false, message: this.getErrorMessage(error.code) };
        }
      });
    } catch (error: any) {
      console.error('Sign up zone error:', error);
      return { success: false, message: 'An unexpected error occurred. Please try again.' };
    }
  }

  /**
   * Sign in an existing admin user
   */
  async signIn(email: string, password: string, honeypot?: string): Promise<{ success: boolean; message: string; needsVerification?: boolean; isLocked?: boolean }> {
    try {
      // Check honeypot field - if filled, it's likely a bot
      if (honeypot && honeypot.trim() !== '') {
        console.log('Bot detected via honeypot in signIn');
        return { success: false, message: 'Invalid request. Please try again.' };
      }

      // Ensure we're in the proper Angular zone
      return await this.ngZone.run(async () => {
        try {
          // Sanitize inputs
          const sanitizedEmail = this.sanitization.sanitizeEmail(email);
          const sanitizedPassword = this.sanitization.sanitizePassword(password);

          // Validate inputs
          if (!this.sanitization.isValidEmail(sanitizedEmail)) {
            return { success: false, message: 'Please enter a valid email address.' };
          }

          if (!sanitizedPassword) {
            return { success: false, message: 'Please enter a password.' };
          }

          // Check if account is locked due to too many failed attempts
          const failedAttempts = await this.getFailedAttempts(sanitizedEmail);
          if (failedAttempts && failedAttempts.lockedUntil && failedAttempts.lockedUntil > new Date()) {
            const lockTimeRemaining = Math.ceil((failedAttempts.lockedUntil.getTime() - new Date().getTime()) / (1000 * 60));
            return {
              success: false,
              message: `🔒 Account locked for ${lockTimeRemaining} minutes due to 3 failed login attempts. For security, you must reset your password to regain access.`,
              isLocked: true
            };
          }

          // Sign in with Firebase Auth - ensure it's within injection context
          const userCredential = await runInInjectionContext(this.injector, async () => {
            return await signInWithEmailAndPassword(this.auth, sanitizedEmail, sanitizedPassword);
          });
          const user = userCredential.user;

          // Clear failed attempts on successful login
          await this.clearFailedAttempts(sanitizedEmail);

          // Reload user to get fresh state (including emailVerified status)
          await user.reload();
          // Force token refresh to ensure fresh claims
          await user.getIdToken(true);

          // Check if email is verified after reload
          if (!user.emailVerified) {
            // Send verification email before signing out
            try {
              const actionCodeSettings: ActionCodeSettings = {
                url: `https://dcciministries.com/auth/action?uid=${encodeURIComponent(user.uid)}&verified=1`,
                handleCodeInApp: false
              };
              await sendEmailVerification(user, actionCodeSettings);
            } catch (verifyError) {
              // If sending fails, continue anyway - user can resend from verification page
              console.error('Error sending verification email:', verifyError);
            }

            // Sign out and return error
            await this.signOut();
            return { success: false, message: 'Please verify your email first. A verification email has been sent.', needsVerification: true };
          }

          // Email is verified - update Firestore
          await runInInjectionContext(this.injector, async () => {
            await setDoc(doc(this.firestore, 'adminUsers', user.uid), {
              emailVerified: true,
              emailVerifiedAt: serverTimestamp(),
              lastLoginAt: new Date()
            }, { merge: true });
          });

          // Load user data from Firestore
          const userData = await this.loadUserData(user.uid);

          if (userData && userData.isAdmin) {

            return { success: true, message: 'Login successful!' };
          } else {
            // User exists but is not an admin - sign them out and redirect
            await this.signOut();
            return { success: false, message: 'Access denied. Admin privileges required.' };
          }
        } catch (error: any) {
          console.error('Sign in error (inner catch):', error);
          console.error('Error code:', error.code);

          // Record failed attempt
          await this.recordFailedAttempt(email);

          const errorMessage = this.getErrorMessage(error.code);
          console.log('Generated error message:', errorMessage);
          return { success: false, message: errorMessage };
        }
      });
    } catch (error: any) {
      console.error('Sign in zone error:', error);
      return { success: false, message: 'Network error. Please check your connection and try again.' };
    }
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
      this.currentUserSubject.next(null);
      this.router.navigate(['/welcome']);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }

  /**
   * Load user data from Firestore
   */
  private async loadUserData(uid: string): Promise<AdminUser | null> {
    try {
      // Ensure Firebase API calls are within injection context
      return await runInInjectionContext(this.injector, async () => {
        try {
          const userDoc = await getDoc(doc(this.firestore, 'adminUsers', uid));

          if (userDoc.exists()) {
            const userData = userDoc.data() as AdminUser;

            // Convert Firestore Timestamps to JavaScript Dates
            if (userData.createdAt && (userData.createdAt as any).toDate) {
              userData.createdAt = (userData.createdAt as any).toDate();
            }
            if (userData.lastLoginAt && (userData.lastLoginAt as any).toDate) {
              userData.lastLoginAt = (userData.lastLoginAt as any).toDate();
            }

            this.currentUserSubject.next(userData);
            return userData;
          } else {
            // User document doesn't exist yet - this is normal during signup
            console.log('User document not found in Firestore yet - this is normal during signup');
            this.currentUserSubject.next(null);
            return null;
          }
        } catch (firestoreError) {
          console.error('Firestore error loading user data:', firestoreError);
          this.currentUserSubject.next(null);
          return null;
        }
      });
    } catch (error) {
      console.error('Error in loadUserData:', error);
      // Don't throw the error, just log it and return null
      this.currentUserSubject.next(null);
      return null;
    }
  }

  /**
   * Send email verification to current user
   */
  async sendEmailVerification(email?: string, password?: string): Promise<{ success: boolean; message: string }> {
    try {
      return await this.ngZone.run(async () => {
        try {
          let user = this.auth.currentUser;

          // If no user is logged in but email/password provided, sign in temporarily
          if (!user && email && password) {
            try {
              const credential = await signInWithEmailAndPassword(this.auth, email, password);
              user = credential.user;

              // Configure action code settings
              const actionCodeSettings: ActionCodeSettings = {
                url: `https://dcciministries.com/auth/action?uid=${encodeURIComponent(user.uid)}&verified=1`,
                handleCodeInApp: false
              };

              await sendEmailVerification(user, actionCodeSettings);

              // Sign out after sending email
              await signOut(this.auth);

              return { success: true, message: 'Verification email sent! Please check your inbox.' };
            } catch (signInError: any) {
              // If sign-in fails, return appropriate error
              if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/wrong-password') {
                return { success: false, message: 'Invalid email or password. Please check your credentials and try again.' };
              }
              if (signInError.code === 'auth/too-many-requests') {
                return { success: false, message: 'Too many requests. Please wait a few minutes before requesting another verification email.' };
              }
              return { success: false, message: this.getErrorMessage(signInError.code) };
            }
          }

          // If no user and no credentials provided
          if (!user) {
            return { success: false, message: 'Please provide your email and password to resend the verification email, or sign in first.' };
          }

          // Configure action code settings
          // Firebase's hosted handler will verify the email, then redirect to our page
          const actionCodeSettings: ActionCodeSettings = {
            url: `https://dcciministries.com/auth/action?uid=${encodeURIComponent(user.uid)}&verified=1`,
            handleCodeInApp: false
          };

          await sendEmailVerification(user, actionCodeSettings);
          return { success: true, message: 'Verification email sent! Please check your inbox.' };
        } catch (error: any) {
          console.error('Send verification error:', error);

          // Handle specific error cases
          if (error.code === 'auth/too-many-requests') {
            return { success: false, message: 'Too many requests. Please wait a few minutes before requesting another verification email.' };
          }

          return { success: false, message: this.getErrorMessage(error.code) };
        }
      });
    } catch (error: any) {
      console.error('Send verification email zone error:', error);
      return { success: false, message: 'An unexpected error occurred. Please try again.' };
    }
  }

  /**
   * Verify email with action code
   * Applies the action code and immediately updates Firestore if uid is provided
   */
  async verifyEmail(actionCode: string, uid?: string): Promise<{ success: boolean; message: string }> {
    try {
      // Apply the action code to verify the email in Firebase Auth
      await applyActionCode(this.auth, actionCode);

      // If uid is provided, update Firestore immediately via Cloud Function
      // (User is not logged in, so we can't update Firestore directly due to security rules)
      if (uid) {
        try {
          await firstValueFrom(
            this.http.post<{ success: boolean; message: string }>(
              `${environment.firebaseFunctionsUrl}/updateEmailVerified`,
              { uid },
              { headers: { 'Content-Type': 'application/json' } }
            )
          );
          console.log('✅ Firestore updated immediately after verification for uid:', uid);
        } catch (cloudFunctionError: any) {
          console.error('⚠️ Failed to update Firestore immediately:', cloudFunctionError);
          // Don't fail verification - Firestore will be updated during sign-in
        }
      }

      return { success: true, message: 'Email verified successfully!' };
    } catch (error: any) {
      // If already verified, that's fine - just return success
      if (error.code === 'auth/invalid-action-code' || error.code === 'auth/expired-action-code') {
        return { success: true, message: 'Email verified successfully!' };
      }
      return { success: false, message: this.getErrorMessage(error.code) };
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string): Promise<{ success: boolean; message: string }> {
    try {
      // Sanitize email input
      const sanitizedEmail = this.sanitization.sanitizeEmail(email);

      // Validate email
      if (!this.sanitization.isValidEmail(sanitizedEmail)) {
        return { success: false, message: 'Please enter a valid email address.' };
      }

      await sendPasswordResetEmail(this.auth, sanitizedEmail);
      return { success: true, message: 'Password reset email sent! Please check your inbox.' };
    } catch (error: any) {
      console.error('Password reset email error:', error);
      return { success: false, message: this.getErrorMessage(error.code) };
    }
  }

  /**
   * Verify password reset code
   */
  async verifyPasswordResetCode(actionCode: string): Promise<{ success: boolean; message: string; email?: string }> {
    try {
      const email = await verifyPasswordResetCode(this.auth, actionCode);
      return { success: true, message: 'Reset code is valid.', email };
    } catch (error: any) {
      console.error('Password reset code verification error:', error);
      return { success: false, message: this.getErrorMessage(error.code) };
    }
  }

  /**
   * Confirm password reset
   */
  async confirmPasswordReset(actionCode: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      // Sanitize password input
      const sanitizedPassword = this.sanitization.sanitizePassword(newPassword);

      // Validate password
      if (!this.sanitization.isValidPassword(sanitizedPassword)) {
        return { success: false, message: 'Password must be at least 8 characters long and contain both letters and numbers.' };
      }

      await confirmPasswordReset(this.auth, actionCode, sanitizedPassword);
      return { success: true, message: 'Password reset successfully! You can now log in with your new password.' };
    } catch (error: any) {
      console.error('Password reset confirmation error:', error);
      return { success: false, message: this.getErrorMessage(error.code) };
    }
  }

  /**
   * Check if current user is admin
   */
  isAdmin(): boolean {
    const currentUser = this.currentUserSubject.value;
    return currentUser ? currentUser.isAdmin : false;
  }

  /**
   * Check if current user is a full Admin (not Moderator)
   */
  isFullAdmin(): boolean {
    const currentUser = this.currentUserSubject.value;
    return currentUser ? (currentUser.isAdmin && currentUser.userRole === 'Admin') : false;
  }

  /**
   * Check if current user is a Moderator
   */
  isModerator(): boolean {
    const currentUser = this.currentUserSubject.value;
    return currentUser ? (currentUser.isAdmin && currentUser.userRole === 'Moderator') : false;
  }

  /**
   * Check if current user is verified
   */
  isEmailVerified(): boolean {
    const currentUser = this.currentUserSubject.value;
    return currentUser ? currentUser.emailVerified : false;
  }

  /**
   * Get current user
   */
  getCurrentUser(): AdminUser | null {
    return this.currentUserSubject.value;
  }

  /**
   * Convert Firebase error codes to user-friendly messages
   */
  private getErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/invalid-email':
        return '❌ Invalid email format. Please enter a valid email address (e.g., user@example.com).';
      case 'auth/weak-password':
        return 'Password is too weak. Please choose a stronger password.';
      case 'auth/user-not-found':
        return '❌ No account found with this email address. Please check your email or create a new account.';
      case 'auth/wrong-password':
        return '❌ Wrong password. Please check your password and try again. If you forgot your password, use "Forgot Password?" below.';
      case 'auth/invalid-credential':
        return '❌ Wrong password. Please check your password and try again. If you forgot your password, use "Forgot Password?" below.';
      case 'auth/too-many-requests':
        return 'Account temporarily locked due to multiple failed attempts. Please use password recovery to reset your password and regain access.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection and try again.';
      case 'auth/expired-action-code':
        return 'The verification link has expired. Please request a new one.';
      case 'auth/invalid-action-code':
        return 'The verification link is invalid or has already been used.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      default:
        return 'An error occurred. Please try again.';
    }
  }

  /**
   * Record a failed login attempt
   */
  private async recordFailedAttempt(email: string): Promise<void> {
    try {
      await runInInjectionContext(this.injector, async () => {
      const failedAttemptsRef = doc(this.firestore, 'failedAttempts', email);
      const failedAttemptsDoc = await getDoc(failedAttemptsRef);

      let attempts = 1;
      let lockedUntil: Date | undefined;

      if (failedAttemptsDoc.exists()) {
        const data = failedAttemptsDoc.data() as FailedAttempt;
        attempts = data.attempts + 1;

        // If this is the 3rd attempt, lock the account for 15 minutes
        if (attempts >= 3) {
          lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
        }
      }

      await setDoc(failedAttemptsRef, {
        email,
        attempts,
        lastAttempt: new Date(),
        lockedUntil,
        ipAddress: await this.getClientIP()
        });
      });
    } catch (error) {
      console.error('Error recording failed attempt:', error);
    }
  }

  /**
   * Get failed attempts for an email
   */
  async getFailedAttempts(email: string): Promise<FailedAttempt | null> {
    try {
      return await runInInjectionContext(this.injector, async () => {
      const failedAttemptsRef = doc(this.firestore, 'failedAttempts', email);
      const failedAttemptsDoc = await getDoc(failedAttemptsRef);

      if (failedAttemptsDoc.exists()) {
        const data = failedAttemptsDoc.data() as FailedAttempt;
        // Convert Firestore timestamps to Date objects
        return {
          ...data,
          lastAttempt: data.lastAttempt instanceof Date ? data.lastAttempt : new Date(data.lastAttempt),
          lockedUntil: data.lockedUntil ? (data.lockedUntil instanceof Date ? data.lockedUntil : new Date(data.lockedUntil)) : undefined
        };
      }
      return null;
      });
    } catch (error) {
      console.error('Error getting failed attempts:', error);
      return null;
    }
  }

  /**
   * Clear failed attempts for an email (on successful login)
   */
  private async clearFailedAttempts(email: string): Promise<void> {
    try {
      await runInInjectionContext(this.injector, async () => {
      const failedAttemptsRef = doc(this.firestore, 'failedAttempts', email);
      await setDoc(failedAttemptsRef, {
        email,
        attempts: 0,
        lastAttempt: new Date(),
        lockedUntil: null
        });
      });
    } catch (error) {
      console.error('Error clearing failed attempts:', error);
    }
  }

  /**
   * Get client IP address (simplified version)
   */
  private async getClientIP(): Promise<string> {
    try {
      // This is a simplified approach - in production you'd want to get the real IP
      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }
}
