import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonInput, IonButton, IonIcon } from '@ionic/angular/standalone';
import { ContactService } from 'src/app/services/contact.service';
import { SiteSettingsService } from '../services/site-settings.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-newsletter-signup',
  templateUrl: './newsletter-signup.component.html',
  styleUrls: ['./newsletter-signup.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonInput, IonButton, IonIcon]
})
export class NewsletterSignupComponent implements OnInit {
  newsletterForm: FormGroup;
  isSubmitting = false;
  submitSuccess = false;
  submitError = '';

  constructor(
    private formBuilder: FormBuilder,
    private contactService: ContactService,
    private siteSettingsService: SiteSettingsService
  ) {
    this.newsletterForm = this.formBuilder.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]]
    });
  }

  ngOnInit() {}

  async onSubmit() {
    // Check nuclear lockdown FIRST - blocks everything
    const settings = await firstValueFrom(this.siteSettingsService.settings$);
    if (settings.nuclearLockdown) {
      this.submitError = 'Site is currently in maintenance mode. Please try again later.';
      return;
    }

    if (this.newsletterForm.valid) {
      this.isSubmitting = true;
      this.submitError = '';

      try {
        const formData = this.newsletterForm.value;
        await this.contactService.subscribeToNewsletter(formData);
        this.submitSuccess = true;
        this.newsletterForm.reset();
      } catch (error: any) {
        if (error.error?.error === 'Invalid input' && error.error?.details) {
          this.submitError = 'Please check your input: ' + error.error.details.join(', ');
        } else if (error.error?.error === 'Already subscribed') {
          this.submitError = error.error.message || 'This email is already subscribed to our newsletter.';
        }
        else {
          this.submitError = 'Failed to subscribe. Please try again.';
        }
        console.error('Newsletter subscription error:', error);
      } finally {
        this.isSubmitting = false;
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched() {
    Object.keys(this.newsletterForm.controls).forEach(key => {
      const control = this.newsletterForm.get(key);
      control?.markAsTouched();
    });
  }

  getErrorMessage(controlName: string): string {
    const control = this.newsletterForm.get(controlName);
    if (control?.errors && control.touched) {
      if (control.errors['required']) {
        return `${this.getFieldLabel(controlName)} is required`;
      }
      if (control.errors['email']) {
        return 'Please enter a valid email address';
      }
      if (control.errors['minlength']) {
        const requiredLength = control.errors['minlength'].requiredLength;
        return `${this.getFieldLabel(controlName)} must be at least ${requiredLength} characters`;
      }
      if (control.errors['maxlength']) {
        const maxLength = control.errors['maxlength'].requiredLength;
        return `${this.getFieldLabel(controlName)} must be less than ${maxLength} characters`;
      }
    }
    return '';
  }

  private getFieldLabel(controlName: string): string {
    const labels: { [key: string]: string } = {
      name: 'Name',
      email: 'Email'
    };
    return labels[controlName] || controlName;
  }

  resetForm() {
    this.submitSuccess = false;
    this.submitError = '';
    this.newsletterForm.reset();
  }
}
