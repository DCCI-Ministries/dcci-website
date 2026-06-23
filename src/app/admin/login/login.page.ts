import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import {
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonIcon,
  IonSpinner,
  IonNote
} from '@ionic/angular/standalone';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth';
import { SanitizationService } from '../../services/sanitization';
import { SiteSettingsService } from '../../services/site-settings.service';
import { Subscription, firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonIcon,
    IonSpinner,
    IonNote,
    CommonModule,
    ReactiveFormsModule
  ]
})
export class LoginPage implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('verificationCard', { read: ElementRef }) verificationCard!: ElementRef;
  
  loginForm: FormGroup;
  isSignUpMode = false;
  isLoading = false;
  showPassword = false;
  statusMessage: { success: boolean; message: string; needsVerification?: boolean; isLocked?: boolean } | null = null;
  showVerifiedBanner = false;
  registrationsDisabled = false;
  private userSubscription: Subscription = new Subscription();
  private settingsSubscription: Subscription = new Subscription();
  private shouldScrollToVerification = false;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private sanitizationService: SanitizationService,
    private siteSettingsService: SiteSettingsService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      website: [''] // Honeypot field - should remain empty
    });
  }

  ngOnInit() {
    // Check if user is already logged in and is admin
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      if (user && user.emailVerified && this.authService.isAdmin()) {
        this.router.navigate(['/admin/dashboard']);
      }
    });
    
    // Check for verified query parameter
    const verified = this.route.snapshot.queryParams['verified'];
    if (verified === '1') {
      this.showVerifiedBanner = true;
      // Remove query param from URL
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { verified: null },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
    }
    
    // Check for existing lockouts when page loads
    this.checkForExistingLockout();
    
    // Listen for email changes to check for lockouts
    this.loginForm.get('email')?.valueChanges.subscribe(() => {
      this.checkForExistingLockout();
    });
  }

  ngAfterViewChecked() {
    // Scroll to verification card after successful signup
    if (this.shouldScrollToVerification && this.verificationCard) {
      setTimeout(() => {
        this.verificationCard.nativeElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
        this.shouldScrollToVerification = false;
      }, 100);
    }
  }

  ngOnDestroy() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  async onSubmit() {
    if (this.loginForm.valid) {
      // Check honeypot field - if filled, it's likely a bot
      const honeypotValue = this.loginForm.get('website')?.value;
      if (honeypotValue && honeypotValue.trim() !== '') {
        // Silently reject - don't show any error message to avoid alerting bots
        console.log('Bot detected via honeypot field');
        return;
      }

      this.isLoading = true;
      this.statusMessage = null;

      const email = this.loginForm.get('email')?.value;
      const password = this.loginForm.get('password')?.value;
      const honeypot = this.loginForm.get('website')?.value;

      try {
        let result;
        if (this.isSignUpMode) {
          // Check if registrations are disabled
          const registrationsDisabled = await firstValueFrom(this.siteSettingsService.disableRegistrations$);
          if (registrationsDisabled) {
            this.statusMessage = {
              success: false,
              message: 'Registrations are temporarily disabled.'
            };
            return;
          }
          result = await this.authService.signUp(email, password, honeypot);
        } else {
          result = await this.authService.signIn(email, password, honeypot);
        }
        
        console.log('Auth result:', result);

        if (result.needsVerification) {
          // User needs email verification - verification email was already sent in auth service
          // Redirect to verification page
          this.router.navigate(['/admin/verification-required'], {
            queryParams: { email: email }
          });
          return;
        }

        if (result.isLocked) {
          // Account is locked - show message and disable form
          this.statusMessage = result;
          this.loginForm.disable();
          return;
        }

        this.statusMessage = result;

        if (result.success && !this.isSignUpMode) {
          // Successful login - redirect to admin dashboard
          setTimeout(() => {
            this.router.navigate(['/admin/dashboard']);
          }, 1000);
        } else if (result.success && this.isSignUpMode) {
          // Successful signup - stay on page so user can read verification instructions
          // Clear password field for security
          this.loginForm.get('password')?.setValue('');
          // Set flag to scroll to verification card
          this.shouldScrollToVerification = true;
          // Don't switch modes or redirect - let them read the message
        }
      } catch (error) {
        console.error('Login error:', error);
        this.statusMessage = { success: false, message: 'An unexpected error occurred. Please check your connection and try again.' };
      } finally {
        this.isLoading = false;
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  toggleMode() {
    // Don't allow switching to sign up mode if registrations are disabled
    if (!this.isSignUpMode && this.registrationsDisabled) {
      return;
    }
    this.isSignUpMode = !this.isSignUpMode;
    this.statusMessage = null;
    this.loginForm.reset();
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  dismissVerifiedBanner() {
    this.showVerifiedBanner = false;
  }

  goToForgotPassword() {
    this.router.navigate(['/admin/forgot-password']);
  }

  async checkForExistingLockout() {
    const email = this.loginForm.get('email')?.value;
    if (email && this.sanitizationService.isValidEmail(email)) {
      try {
        const failedAttempts = await this.authService.getFailedAttempts(email);
        if (failedAttempts && failedAttempts.lockedUntil && failedAttempts.lockedUntil > new Date()) {
          const lockTimeRemaining = Math.ceil((failedAttempts.lockedUntil.getTime() - new Date().getTime()) / (1000 * 60));
          this.statusMessage = { 
            success: false, 
            message: `🔒 Account locked for ${lockTimeRemaining} minutes due to 3 failed login attempts. For security, you must reset your password to regain access.`,
            isLocked: true
          };
          this.loginForm.disable();
        } else {
          // Lockout has expired or doesn't exist - clear any lockout message and re-enable form
          if (this.statusMessage?.isLocked) {
            this.statusMessage = null;
            this.loginForm.enable();
          }
        }
      } catch (error) {
        console.error('Error checking for lockout:', error);
      }
    } else {
      // No valid email - clear any lockout message and re-enable form
      if (this.statusMessage?.isLocked) {
        this.statusMessage = null;
        this.loginForm.enable();
      }
    }
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.loginForm.get(fieldName);
    if (field && field.errors) {
      if (field.errors['required']) {
        return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
      }
      if (field.errors['email']) {
        return 'Please enter a valid email address';
      }
      if (field.errors['minlength']) {
        return 'Password must be at least 8 characters long';
      }
    }
    return '';
  }

  private markFormGroupTouched() {
    Object.keys(this.loginForm.controls).forEach(key => {
      const control = this.loginForm.get(key);
      control?.markAsTouched();
    });
  }
}
