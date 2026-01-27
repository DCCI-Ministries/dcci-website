import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonButton,
  IonIcon,
  IonSpinner
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-verification-required',
  templateUrl: './verification-required.page.html',
  styleUrls: ['./verification-required.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonButton,
    IonIcon,
    IonSpinner,
    CommonModule
  ]
})
export class VerificationRequiredPage implements OnInit, OnDestroy {
  userEmail: string = '';
  isResending = false;
  showSuccessState = false;
  resendCooldown = 0;
  statusMessage: { success: boolean; message: string } | null = null;
  isLoggedIn = false;

  private cooldownSubscription: Subscription = new Subscription();
  private userSubscription: Subscription = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // Get email from route parameters or query params
    this.userEmail = this.route.snapshot.queryParams['email'] || '';

    // Check if user is logged in
      this.userSubscription = this.authService.currentUser$.subscribe(user => {
      this.isLoggedIn = !!user;

        if (user) {
        // If user is logged in, use their email
        if (!this.userEmail) {
          this.userEmail = user.email || '';
    }

    // Check if user is already verified and admin
        if (user.emailVerified && user.isAdmin) {
        // User is verified and admin, redirect to dashboard
        this.router.navigate(['/admin/dashboard']);
        } else if (user.emailVerified && !user.isAdmin) {
        // User is verified but not admin, redirect to welcome
        this.router.navigate(['/welcome']);
        }
      } else {
        // No user logged in - if we have email from query params, that's fine
        // Don't show credentials form - user should return to login page if they need to resend
        if (!this.userEmail) {
          // No email in query params - redirect to login
          this.router.navigate(['/admin/login']);
        }
      }
    });
  }

  ngOnDestroy() {
    if (this.cooldownSubscription) {
      this.cooldownSubscription.unsubscribe();
    }
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  async resendVerificationEmail() {
    if (this.isResending || this.resendCooldown > 0) {
      return;
    }

    try {
      this.isResending = true;
      this.statusMessage = null;
      this.showSuccessState = false;

      let result;

      // If user is logged in, use their session
      if (this.isLoggedIn) {
        result = await this.authService.sendEmailVerification();
      } else if (this.userEmail) {
        // We have email from query params but no logged-in user
        // Tell user to return to login page - verification email was already sent when they tried to log in
        this.statusMessage = {
          success: true,
          message: 'A verification email was already sent when you tried to log in. Please check your inbox. If you need another email, please return to the login page and try logging in again.'
        };
        this.isResending = false;
        return;
      } else {
        // No email and no user - redirect to login
        this.router.navigate(['/admin/login']);
        return;
      }

      this.statusMessage = result;

      if (result.success) {
        this.showSuccessState = true;
        this.startResendCooldown();
      }
    } catch (error) {
      this.statusMessage = {
        success: false,
        message: 'An unexpected error occurred. Please try again.'
      };
      console.error('Resend verification error:', error);
    } finally {
      this.isResending = false;
    }
  }

  private startResendCooldown() {
    this.resendCooldown = 60; // 60 seconds cooldown

    this.cooldownSubscription = interval(1000).subscribe(() => {
      this.resendCooldown--;

      if (this.resendCooldown <= 0) {
        this.cooldownSubscription.unsubscribe();
      }
    });
  }

  goToLogin() {
    this.router.navigate(['/admin/login']);
  }
}
