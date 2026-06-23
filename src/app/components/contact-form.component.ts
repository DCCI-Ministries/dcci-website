import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonInput, IonButton, IonIcon, IonTextarea, IonCheckbox } from '@ionic/angular/standalone';
import { ContactService } from 'src/app/services/contact.service';
import { SiteSettingsService } from '../services/site-settings.service';
import { ActivatedRoute } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-contact-form',
  templateUrl: './contact-form.component.html',
  styleUrls: ['./contact-form.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonInput, IonButton, IonIcon, IonTextarea, IonCheckbox]
})
export class ContactFormComponent implements OnInit, OnDestroy {
  @Input() prefillSubject: string = '';
  @Input() hideDescription: boolean = false;
  @Input() hideNewsletter: boolean = false;
  contactForm: FormGroup;
  isSubmitting = false;
  submitSuccess = false;
  submitError = '';
  formLoadTime: number = 0;
  contactFormsDisabled = false;
  private settingsSubscription: Subscription = new Subscription();

  constructor(
    private formBuilder: FormBuilder,
    private contactService: ContactService,
    private siteSettingsService: SiteSettingsService,
    private route: ActivatedRoute
  ) {
    // Record when the form was loaded (for bot detection)
    this.formLoadTime = Date.now();

    this.contactForm = this.formBuilder.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      subject: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(200)]],
      message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(5000)]],
      newsletter: [false], // Newsletter subscription (optional)
      website: [''], // Honeypot field - should always be empty
      formTimestamp: [this.formLoadTime] // Hidden field for bot detection
    });
  }

  ngOnInit() {
    // Check for pre-filled subject from query params or input
    const subjectParam = this.route.snapshot.queryParams['subject'];
    const subjectToUse = this.prefillSubject || subjectParam || '';
    
    if (subjectToUse) {
      this.contactForm.patchValue({ subject: subjectToUse });
    }

    // Subscribe to settings to check for nuclear lockdown and disabled contact forms
    this.settingsSubscription = this.siteSettingsService.settings$.subscribe(settings => {
      // Nuclear lockdown blocks everything
      const shouldDisable = settings.nuclearLockdown || settings.disableContactForms;
      this.contactFormsDisabled = shouldDisable;
      if (shouldDisable) {
        // Disable form when nuclear lockdown is active or contact forms are disabled
        this.contactForm.disable();
      } else {
        this.contactForm.enable();
      }
    });
  }

  ngOnDestroy() {
    if (this.settingsSubscription) {
      this.settingsSubscription.unsubscribe();
    }
  }

  async onSubmit() {
    // Check nuclear lockdown FIRST - blocks everything
    const settings = await firstValueFrom(this.siteSettingsService.settings$);
    if (settings.nuclearLockdown) {
      this.submitError = 'Site is currently in maintenance mode. Please try again later.';
      return;
    }

    // Check if contact forms are disabled
    if (settings.disableContactForms) {
      this.submitError = 'Contact form temporarily unavailable.';
      return;
    }

    // Honeypot check - if website field is filled, it's likely a bot
    if (this.contactForm.get('website')?.value) {
      console.log('Error');
      // Silently fail - don't let bots know they were caught
      this.submitSuccess = true;
      this.contactForm.reset();
      return;
    }

    if (this.contactForm.valid) {
      this.isSubmitting = true;
      this.submitError = '';

      try {
        // Prepare form data and add submission timestamp
        const formData = { ...this.contactForm.value };
        delete formData.website; // Remove honeypot field

        // Add submission timestamp for bot detection
        formData.submissionTime = Date.now();
        formData.formLoadTime = formData.formTimestamp; // The original form load time
        delete formData.formTimestamp; // Clean up the form field

        await this.contactService.submitContactForm(formData);
        this.submitSuccess = true;
        this.contactForm.reset();
      } catch (error: any) {
        this.submitError = this.formatContactFormError(error);
        console.error('Contact form submission error:', error);
      } finally {
        this.isSubmitting = false;
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  private formatContactFormError(error: any): string {
    const body = error?.error;
    if (!body) {
      return 'Failed to send message. Please check your connection and try again.';
    }

    if (body.message) {
      return body.message;
    }

    if (body.error === 'invalid_input' && Array.isArray(body.details) && body.details.length > 0) {
      return body.details.join(' ');
    }

    if (body.error === 'Invalid input' && Array.isArray(body.details) && body.details.length > 0) {
      return body.details.join(' ');
    }

    return 'Failed to send message. Please try again.';
  }

  private markFormGroupTouched() {
    Object.keys(this.contactForm.controls).forEach(key => {
      const control = this.contactForm.get(key);
      control?.markAsTouched();
    });
  }

  getErrorMessage(controlName: string): string {
    const control = this.contactForm.get(controlName);
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
      email: 'Email',
      subject: 'Subject',
      message: 'Message'
    };
    return labels[controlName] || controlName;
  }

  resetForm() {
    this.submitSuccess = false;
    this.submitError = '';
    this.contactForm.reset();
  }
}
