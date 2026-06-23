import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonInput, IonButton, IonIcon, IonTextarea } from '@ionic/angular/standalone';
import { ContactService } from 'src/app/services/contact.service';
import { SiteSettingsService } from '../services/site-settings.service';
import { ActivatedRoute } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-website-problem-report',
  templateUrl: './website-problem-report.component.html',
  styleUrls: ['./website-problem-report.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonInput, IonButton, IonIcon, IonTextarea]
})
export class WebsiteProblemReportComponent implements OnInit, OnDestroy {
  @Input() prefillSubject: string = '';
  problemReportForm: FormGroup;
  isSubmitting = false;
  submitSuccess = false;
  submitError = '';
  formLoadTime: number = 0;
  contactFormsDisabled = false;
  problemReportsDisabled = false;
  private settingsSubscription: Subscription = new Subscription();

  constructor(
    private formBuilder: FormBuilder,
    private contactService: ContactService,
    private siteSettingsService: SiteSettingsService,
    private route: ActivatedRoute
  ) {
    // Record when the form was loaded (for bot detection)
    this.formLoadTime = Date.now();

    this.problemReportForm = this.formBuilder.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      subject: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(200)]],
      message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(5000)]],
      website: [''], // Honeypot field - should always be empty
      formTimestamp: [this.formLoadTime] // Hidden field for bot detection
    });
  }

  ngOnInit() {
    // Check for pre-filled subject from query params or input
    const subjectParam = this.route.snapshot.queryParams['subject'];
    const subjectToUse = this.prefillSubject || subjectParam || '';
    
    if (subjectToUse) {
      this.problemReportForm.patchValue({ subject: subjectToUse });
    }

    // Subscribe to settings to check for nuclear lockdown and disabled problem reports
    this.settingsSubscription = this.siteSettingsService.settings$.subscribe(settings => {
      // Nuclear lockdown blocks everything
      const shouldDisable = settings.nuclearLockdown || settings.disableProblemReports;
      this.problemReportsDisabled = shouldDisable;
      if (shouldDisable) {
        // Disable form when nuclear lockdown is active or problem reports are disabled
        this.problemReportForm.disable();
      } else {
        this.problemReportForm.enable();
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

    // Check if problem reports are disabled
    if (settings.disableProblemReports) {
      this.submitError = 'Website problem reports are temporarily unavailable.';
      return;
    }

    // Honeypot check - if website field is filled, it's likely a bot
    if (this.problemReportForm.get('website')?.value) {
      console.log('Bot detected via honeypot');
      // Silently fail - don't let bots know they were caught
      this.submitSuccess = true;
      this.problemReportForm.reset();
      return;
    }

    if (this.problemReportForm.valid) {
      this.isSubmitting = true;
      this.submitError = '';

      try {
        // Prepare form data and add submission timestamp
        const formData = { ...this.problemReportForm.value };
        delete formData.website; // Remove honeypot field

        // Add submission timestamp for bot detection
        formData.submissionTime = Date.now();
        formData.formLoadTime = formData.formTimestamp; // The original form load time
        delete formData.formTimestamp; // Clean up the form field

        await this.contactService.submitWebsiteProblemReport(formData);
        this.submitSuccess = true;
        this.problemReportForm.reset();
      } catch (error: any) {
        if (error.error?.error === 'Invalid input' && error.error?.details) {
          this.submitError = 'Please check your input: ' + error.error.details.join(', ');
        } else {
          this.submitError = 'Failed to send problem report. Please try again.';
        }
        console.error('Website problem report submission error:', error);
      } finally {
        this.isSubmitting = false;
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched() {
    Object.keys(this.problemReportForm.controls).forEach(key => {
      const control = this.problemReportForm.get(key);
      control?.markAsTouched();
    });
  }

  getErrorMessage(controlName: string): string {
    const control = this.problemReportForm.get(controlName);
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
    this.problemReportForm.reset();
  }
}

