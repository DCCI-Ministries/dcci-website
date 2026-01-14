import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonInput,
  IonButton,
  IonSpinner,
  IonIcon,
  AlertController
} from '@ionic/angular/standalone';
import { ContactService } from '../services/contact.service';

@Component({
  selector: 'app-unsubscribe',
  templateUrl: './unsubscribe.page.html',
  styleUrls: ['./unsubscribe.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonInput,
    IonButton,
    IonSpinner,
    IonIcon
  ],
  providers: [Router]
})
export class UnsubscribePage implements OnInit {
  email: string = '';
  token: string = '';
  isSubmitting = false;
  isSuccess = false;
  isError = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private contactService: ContactService,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    // Get email and token from query params (if coming from email link)
    this.email = this.route.snapshot.queryParams['email'] || '';
    this.token = this.route.snapshot.queryParams['token'] || '';

    // If we have both email and token, auto-unsubscribe
    if (this.email && this.token) {
      this.unsubscribe();
    }
  }

  async unsubscribe() {
    if (!this.email || !this.email.trim()) {
      const alert = await this.alertController.create({
        header: 'Email Required',
        message: 'Please enter your email address to unsubscribe.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    this.isSubmitting = true;
    this.isError = false;
    this.isSuccess = false;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      await this.contactService.unsubscribeFromNewsletter(this.email.trim(), this.token || undefined);
      this.isSuccess = true;
      this.successMessage = 'You have been successfully unsubscribed from the DCCI Ministries newsletter.';
      this.email = ''; // Clear email for privacy
      this.token = ''; // Clear token
    } catch (error: any) {
      this.isError = true;
      if (error.error?.message) {
        this.errorMessage = error.error.message;
      } else if (error.error?.error) {
        this.errorMessage = error.error.error;
      } else {
        this.errorMessage = 'An error occurred while processing your unsubscribe request. Please try again later.';
      }
    } finally {
      this.isSubmitting = false;
    }
  }
}
