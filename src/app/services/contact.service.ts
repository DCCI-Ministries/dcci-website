import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
  website?: string; // Honeypot field
}

export interface NewsletterSubscriptionData {
  name: string;
  email: string;
}

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  private readonly apiUrl = environment.firebaseFunctionsUrl + '/submitContactForm';
  private readonly problemReportApiUrl = environment.firebaseFunctionsUrl + '/submitWebsiteProblemReport';
  private readonly newsletterApiUrl = environment.firebaseFunctionsUrl + '/subscribeToNewsletter';

  constructor(private http: HttpClient) {}

  async submitContactForm(formData: ContactFormData): Promise<void> {
    try {
      const response = await firstValueFrom(this.http.post(this.apiUrl, formData, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json'
        })
      }));

      if (!response) {
        throw new Error('No response from server');
      }

      console.log('Contact form submitted successfully:', response);
    } catch (error: any) {
      console.error('Error submitting contact form:', error);

      // Re-throw the error with the response body if available
      if (error.error) {
        throw error; // This will include error.error with the server response
      }

      throw error;
    }
  }

  async subscribeToNewsletter(formData: NewsletterSubscriptionData): Promise<void> {
    try {
      const response = await firstValueFrom(this.http.post(this.newsletterApiUrl, formData, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json'
        })
      }));

      if (!response) {
        throw new Error('No response from server');
      }

      console.log('Newsletter subscription successful:', response);
    } catch (error: any) {
      console.error('Error subscribing to newsletter:', error);

      // Re-throw the error with the response body if available
      if (error.error) {
        throw error; // This will include error.error with the server response
      }

      throw error;
    }
  }

  // Submit website problem report (separate from regular contact form)
  async submitWebsiteProblemReport(formData: ContactFormData): Promise<void> {
    try {
      const response = await firstValueFrom(this.http.post(this.problemReportApiUrl, formData, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json'
        })
      }));

      if (!response) {
        throw new Error('No response from server');
      }

      console.log('Website problem report submitted successfully:', response);
    } catch (error: any) {
      console.error('Error submitting website problem report:', error);

      if (error.error) {
        throw error;
      }

      throw error;
    }
  }

  // Alternative method using Firebase directly if needed
  async submitContactFormDirect(formData: ContactFormData): Promise<void> {
    // This method can be used if you want to call Firebase Functions directly
    // without going through the HTTP client
    try {
      // You can implement direct Firebase Functions call here if needed
      // For now, we'll use the HTTP method above
      return this.submitContactForm(formData);
    } catch (error) {
      console.error('Error submitting contact form directly:', error);
      throw error;
    }
  }

  async unsubscribeFromNewsletter(email: string, token?: string): Promise<void> {
    try {
      const response = await firstValueFrom(this.http.post(
        environment.firebaseFunctionsUrl + '/unsubscribeFromNewsletter',
        { email, token },
        {
          headers: new HttpHeaders({
            'Content-Type': 'application/json'
          })
        }
      ));

      if (!response) {
        throw new Error('No response from server');
      }

      console.log('Unsubscribe successful:', response);
    } catch (error: any) {
      console.error('Error unsubscribing from newsletter:', error);
      if (error.error) {
        throw error;
      }
      throw error;
    }
  }
}
