import { Injectable, Optional } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AppCheck } from '@angular/fire/app-check';
import { getToken } from '@angular/fire/app-check';
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

  constructor(
    private http: HttpClient,
    @Optional() private appCheck: AppCheck | null
  ) {}

  private async buildRequestHeaders(): Promise<HttpHeaders> {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (this.appCheck) {
      try {
        const result = await getToken(this.appCheck, false);
        if (result?.token) {
          headers = headers.set('X-Firebase-AppCheck', result.token);
        }
      } catch (error) {
        console.warn('App Check token unavailable for contact request:', error);
      }
    }

    return headers;
  }

  async submitContactForm(formData: ContactFormData): Promise<void> {
    try {
      const headers = await this.buildRequestHeaders();
      const response = await firstValueFrom(this.http.post(this.apiUrl, formData, { headers }));

      if (!response) {
        throw new Error('No response from server');
      }

      console.log('Contact form submitted successfully:', response);
    } catch (error: any) {
      console.error('Error submitting contact form:', error);

      if (error.error) {
        throw error;
      }

      throw error;
    }
  }

  async subscribeToNewsletter(formData: NewsletterSubscriptionData): Promise<void> {
    try {
      const headers = await this.buildRequestHeaders();
      const response = await firstValueFrom(this.http.post(this.newsletterApiUrl, formData, { headers }));

      if (!response) {
        throw new Error('No response from server');
      }

      console.log('Newsletter subscription successful:', response);
    } catch (error: any) {
      console.error('Error subscribing to newsletter:', error);

      if (error.error) {
        throw error;
      }

      throw error;
    }
  }

  async submitWebsiteProblemReport(formData: ContactFormData): Promise<void> {
    try {
      const headers = await this.buildRequestHeaders();
      const response = await firstValueFrom(this.http.post(this.problemReportApiUrl, formData, { headers }));

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

  async submitContactFormDirect(formData: ContactFormData): Promise<void> {
    return this.submitContactForm(formData);
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
