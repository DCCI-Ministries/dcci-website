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
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  LoadingController,
  ToastController
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { QuillModule } from 'ngx-quill';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { filter, firstValueFrom, Subscription, take } from 'rxjs';
import { WelcomeContentService } from '../../services/welcome-content.service';
import { SiteSettingsService } from '../../services/site-settings.service';
import { AuthService } from '../../services/auth';
import {
  DEFAULT_HERO_IMAGE_URL,
  DEFAULT_LOGO_IMAGE_URL,
  mergeWelcomeContent,
  normalizeWelcomeLinks,
  WELCOME_LINK_ICON_OPTIONS,
  WelcomePageContent,
  WelcomePageLink
} from '../../models/welcome-content.model';

interface AdminUser {
  uid: string;
  isAdmin: boolean;
  emailVerified: boolean;
}

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
    IonSelect,
    IonSelectOption,
    IonSpinner
  ]
})
export class WelcomeSettingsPage implements OnInit, OnDestroy {
  content: WelcomePageContent = mergeWelcomeContent(null);
  linkIconOptions = WELCOME_LINK_ICON_OPTIONS;
  isLoading = true;
  isSaving = false;
  readOnlyMode = false;
  currentUser: AdminUser | null = null;

  logoPreviewUrl = '';
  heroPreviewUrl = '';
  private logoFile: File | null = null;
  private heroFile: File | null = null;
  isUploadingLogo = false;
  isUploadingHero = false;

  quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'image'],
      ['clean']
    ]
  };

  private settingsSubscription?: Subscription;

  constructor(
    private welcomeContentService: WelcomeContentService,
    private siteSettingsService: SiteSettingsService,
    private authService: AuthService,
    private storage: Storage,
    private router: Router,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    this.settingsSubscription = this.siteSettingsService.readOnlyMode$.subscribe((readOnly) => {
      this.readOnlyMode = readOnly;
    });

    const user = await firstValueFrom(
      this.authService.currentUser$.pipe(filter((u) => u !== null), take(1))
    );
    if (!user?.isAdmin || !user.emailVerified) {
      this.router.navigate(['/admin/dashboard']);
      return;
    }
    this.currentUser = { uid: user.uid, isAdmin: user.isAdmin, emailVerified: user.emailVerified };

    try {
      this.content = await this.welcomeContentService.loadWelcomeContent();
      this.logoPreviewUrl = this.content.logoImageUrl || DEFAULT_LOGO_IMAGE_URL;
      this.heroPreviewUrl = this.content.heroImageUrl || DEFAULT_HERO_IMAGE_URL;
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

  onLogoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const validation = this.validateImageFile(file);
    if (!validation.valid) {
      void this.showToast(validation.error || 'Invalid image file', 'danger');
      input.value = '';
      return;
    }

    this.logoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.logoPreviewUrl = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  onHeroSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const validation = this.validateImageFile(file);
    if (!validation.valid) {
      void this.showToast(validation.error || 'Invalid image file', 'danger');
      input.value = '';
      return;
    }

    this.heroFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.heroPreviewUrl = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  resetLogoImage() {
    this.logoFile = null;
    this.logoPreviewUrl = DEFAULT_LOGO_IMAGE_URL;
    this.content.logoImageUrl = DEFAULT_LOGO_IMAGE_URL;
  }

  resetHeroImage() {
    this.heroFile = null;
    this.heroPreviewUrl = DEFAULT_HERO_IMAGE_URL;
    this.content.heroImageUrl = DEFAULT_HERO_IMAGE_URL;
  }

  onEditorCreated(quill: any) {
    const toolbar = quill.getModule('toolbar');
    if (!toolbar || !this.currentUser) {
      return;
    }

    toolbar.addHandler('image', () => {
      const input = document.createElement('input');
      input.setAttribute('type', 'file');
      input.setAttribute('accept', 'image/jpeg,image/jpg,image/png,image/webp,image/bmp,image/tiff,image/avif,image/heic');
      input.click();

      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          return;
        }

        const validation = this.validateImageFile(file);
        if (!validation.valid) {
          await this.showToast(validation.error || 'Invalid image file', 'danger');
          return;
        }

        try {
          const url = await this.uploadImageFile(file, 'inline');
          const range = quill.getSelection(true);
          quill.insertEmbed(range.index, 'image', url, 'user');
          quill.setSelection(range.index + 1, 'silent');
        } catch (error) {
          console.error('Failed to upload inline image:', error);
          await this.showToast('Failed to upload image', 'danger');
        }
      };
    });
  }

  async save() {
    if (this.readOnlyMode) {
      await this.showToast('Site is in read-only mode. Changes cannot be saved.', 'warning');
      return;
    }

    const socialError = this.validateLinks(this.content.socialLinks, 'social');
    if (socialError) {
      await this.showToast(socialError, 'danger');
      return;
    }
    const supportError = this.validateLinks(this.content.supportLinks, 'support');
    if (supportError) {
      await this.showToast(supportError, 'danger');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Saving welcome page...'
    });
    await loading.present();
    this.isSaving = true;

    try {
      if (this.logoFile) {
        this.isUploadingLogo = true;
        this.content.logoImageUrl = await this.uploadImageFile(this.logoFile, 'logo');
        this.logoFile = null;
        this.logoPreviewUrl = this.content.logoImageUrl;
      }

      if (this.heroFile) {
        this.isUploadingHero = true;
        this.content.heroImageUrl = await this.uploadImageFile(this.heroFile, 'hero');
        this.heroFile = null;
        this.heroPreviewUrl = this.content.heroImageUrl;
      }

      await this.welcomeContentService.saveWelcomeContent(this.prepareContentForSave());
      await this.showToast('Welcome page saved. SEO pages will rebuild shortly.', 'success');
    } catch (error) {
      console.error('Failed to save welcome page content:', error);
      await this.showToast('Failed to save welcome page content', 'danger');
    } finally {
      this.isSaving = false;
      this.isUploadingLogo = false;
      this.isUploadingHero = false;
      await loading.dismiss();
    }
  }

  cancel() {
    this.router.navigate(['/admin/dashboard']);
  }

  addSocialLink() {
    this.content.socialLinks = [
      ...this.content.socialLinks,
      { label: '', url: '', icon: 'link-outline' }
    ];
  }

  removeSocialLink(index: number) {
    this.content.socialLinks = this.content.socialLinks.filter((_, i) => i !== index);
  }

  addSupportLink() {
    this.content.supportLinks = [
      ...this.content.supportLinks,
      { label: '', url: '', icon: 'link-outline' }
    ];
  }

  removeSupportLink(index: number) {
    this.content.supportLinks = this.content.supportLinks.filter((_, i) => i !== index);
  }

  private prepareContentForSave(): WelcomePageContent {
    return {
      ...this.content,
      socialLinks: normalizeWelcomeLinks(this.content.socialLinks),
      supportLinks: normalizeWelcomeLinks(this.content.supportLinks)
    };
  }

  private validateLinks(links: WelcomePageLink[], sectionName: string): string | null {
    for (const link of links) {
      const label = (link.label || '').trim();
      const url = (link.url || '').trim();
      if (!url) {
        continue;
      }
      if (!label) {
        return `Each ${sectionName} link needs a button label.`;
      }
      if (!/^https?:\/\//i.test(url)) {
        return `${sectionName} links must start with http:// or https://`;
      }
    }
    return null;
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

  private validateImageFile(file: File): { valid: boolean; error?: string } {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/bmp',
      'image/tiff',
      'image/tif',
      'image/avif',
      'image/heic',
      'image/heif'
    ];

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Only JPEG, PNG, WebP, BMP, TIFF, AVIF, and HEIC images are allowed.' };
    }

    if (file.size > 5 * 1024 * 1024) {
      return { valid: false, error: 'Image must be smaller than 5 MB.' };
    }

    return { valid: true };
  }

  private async uploadImageFile(file: File, prefix: string): Promise<string> {
    if (!this.currentUser?.uid) {
      throw new Error('Not authenticated');
    }

    const validation = this.validateImageFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid image file');
    }

    const timestamp = Date.now();
    const originalName = file.name.toLowerCase();
    const extension = originalName.substring(originalName.lastIndexOf('.'));
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif', '.avif', '.heic', '.heif'];
    const safeExtension = allowedExtensions.includes(extension) ? extension : '.jpg';
    const baseName = originalName.replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9-]/g, '_').substring(0, 40);
    const sanitizedFileName = `${prefix}_${baseName}_${timestamp}${safeExtension}`;
    const filename = `welcome-page/images/${this.currentUser.uid}/${sanitizedFileName}`;
    const storageRef = ref(this.storage, filename);

    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  }
}
