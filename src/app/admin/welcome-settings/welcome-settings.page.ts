import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonSpinner,
  IonTitle,
  IonToolbar,
  LoadingController,
  ToastController
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { QuillModule } from 'ngx-quill';
import { WelcomeContentService } from '../../services/welcome-content.service';
import { SiteSettingsService } from '../../services/site-settings.service';
import { WelcomePageContent, mergeWelcomeContent } from '../../models/welcome-content.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-welcome-settings',
  templateUrl: './welcome-settings.page.html',
  styleUrls: ['./welcome-settings.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    QuillModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonInput,
    IonSpinner
  ]
})
export class WelcomeSettingsPage implements OnInit, OnDestroy {
  content: WelcomePageContent = mergeWelcomeContent(null);
  isLoading = true;
  isSaving = false;
  readOnlyMode = false;

  quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link'],
      ['clean']
    ]
  };

  private settingsSubscription?: Subscription;

  constructor(
    private welcomeContentService: WelcomeContentService,
    private siteSettingsService: SiteSettingsService,
    private router: Router,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    this.settingsSubscription = this.siteSettingsService.readOnlyMode$.subscribe((readOnly) => {
      this.readOnlyMode = readOnly;
    });

    try {
      this.content = await this.welcomeContentService.loadWelcomeContent();
    } catch (error) {
      console.error('Failed to load welcome page content:', error);
      await this.showToast('Failed to load welcome page content', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  ngOnDestroy() {
    this.settingsSubscription?.unsubscribe();
  }

  async save() {
    if (this.readOnlyMode) {
      await this.showToast('Site is in read-only mode. Changes cannot be saved.', 'warning');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Saving welcome page...'
    });
    await loading.present();
    this.isSaving = true;

    try {
      await this.welcomeContentService.saveWelcomeContent(this.content);
      await this.showToast('Welcome page saved. SEO pages will rebuild shortly.', 'success');
    } catch (error) {
      console.error('Failed to save welcome page content:', error);
      await this.showToast('Failed to save welcome page content', 'danger');
    } finally {
      this.isSaving = false;
      await loading.dismiss();
    }
  }

  cancel() {
    this.router.navigate(['/admin/dashboard']);
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastController.create({
      message,
      duration: 3500,
      color,
      position: 'top'
    });
    await toast.present();
  }
}
