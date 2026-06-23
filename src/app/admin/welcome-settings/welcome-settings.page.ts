import { Component, OnDestroy, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
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
  MAX_WELCOME_VERSIONS,
  mergeWelcomeContent,
  normalizeWelcomeLinks,
  WELCOME_LINK_ICON_OPTIONS,
  WelcomePageContent,
  WelcomePageLink,
  WelcomePageVersionSummary,
  versionDisplaySubtitle,
  versionDisplayTitle
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
  versions: WelcomePageVersionSummary[] = [];
  maxWelcomeVersions = MAX_WELCOME_VERSIONS;
  versionsLoadFailed = false;
  isLoading = true;
  isSaving = false;
  savingAction: 'draft' | 'publish' | 'preview' | 'discard' | 'restore' | 'delete' | 'metadata' | null = null;
  versionDisplayTitle = versionDisplayTitle;
  versionDisplaySubtitle = versionDisplaySubtitle;
  hasDraft = false;
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
    private toastController: ToastController,
    private alertController: AlertController,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    this.settingsSubscription = this.siteSettingsService.readOnlyMode$.subscribe((readOnly) => {
      this.readOnlyMode = readOnly;
    });

    const user = await firstValueFrom(
      this.authService.currentUser$.pipe(filter((u) => u !== null), take(1))
    );
    if (!this.authService.isFullAdmin() || !user.emailVerified) {
      this.router.navigate(['/admin/dashboard']);
      return;
    }
    this.currentUser = { uid: user.uid, isAdmin: user.isAdmin, emailVerified: user.emailVerified };

    try {
      await this.reloadEditorState();
    } catch (error) {
      console.error('Failed to load welcome page content:', error);
      const message =
        error instanceof Error && error.message.includes('permission')
          ? 'Could not load welcome page — deploy Firestore rules (firebase deploy --only firestore:rules)'
          : 'Failed to load welcome page content';
      await this.showToast(message, 'danger');
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

  async saveDraft() {
    if (!(await this.prepareAndValidate())) {
      return;
    }

    const loading = await this.presentLoading('Saving draft...');
    this.beginSaving('draft');

    try {
      await this.uploadPendingImages();
      await this.welcomeContentService.saveDraft(this.prepareContentForSave());
      this.hasDraft = true;
      await this.showToast('Draft saved. Preview before publishing.', 'success');
    } catch (error) {
      console.error('Failed to save welcome page draft:', error);
      await this.showToast('Failed to save draft', 'danger');
    } finally {
      await this.endSaving(loading);
    }
  }

  async preview() {
    if (!(await this.prepareAndValidate())) {
      return;
    }

    const loading = await this.presentLoading('Preparing preview...');
    this.beginSaving('preview');

    try {
      await this.uploadPendingImages();
      await this.welcomeContentService.saveDraft(this.prepareContentForSave());
      this.hasDraft = true;
      await this.router.navigate(['/admin/welcome-preview']);
    } catch (error) {
      console.error('Failed to open preview:', error);
      await this.showToast('Failed to open preview', 'danger');
    } finally {
      await this.endSaving(loading);
    }
  }

  async publish() {
    if (this.readOnlyMode) {
      await this.showToast('Site is in read-only mode. Publishing is disabled.', 'warning');
      return;
    }

    if (!(await this.prepareAndValidate())) {
      return;
    }

    const alert = await this.alertController.create({
      header: 'Publish welcome page?',
      message: 'Visitors will see these changes immediately. The current live page will be saved in version history.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Publish', role: 'confirm' }
      ]
    });
    this.blurActiveElement();
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'confirm') {
      await this.confirmPublish();
    }
  }

  async discardDraft() {
    const alert = await this.alertController.create({
      header: 'Discard draft?',
      message: 'Your saved draft will be deleted and the editor will reload the live published page.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Discard draft', role: 'destructive' }
      ]
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'destructive') {
      await this.confirmDiscardDraft();
    }
  }

  async restoreVersionToEditor(version: WelcomePageVersionSummary) {
    const alert = await this.alertController.create({
      header: 'Load previous version?',
      message: `Load the version "${versionDisplayTitle(version)}" into the editor as a draft? Nothing goes live until you publish.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Load into editor', role: 'confirm' }
      ]
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'confirm') {
      await this.confirmRestoreToDraft(version.versionId);
    }
  }

  async publishVersion(version: WelcomePageVersionSummary) {
    if (this.readOnlyMode) {
      await this.showToast('Site is in read-only mode. Publishing is disabled.', 'warning');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Publish this version?',
      message: `Replace the live welcome page with "${versionDisplayTitle(version)}"? The current live page will be archived first.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Publish version', role: 'confirm' }
      ]
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'confirm') {
      await this.confirmPublishVersion(version.versionId);
    }
  }

  async deleteVersion(version: WelcomePageVersionSummary) {
    if (this.readOnlyMode) {
      await this.showToast('Site is in read-only mode. Deleting versions is disabled.', 'warning');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Delete saved version?',
      message: `Remove the backup "${versionDisplayTitle(version)}"? This cannot be undone. The live welcome page is not affected.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Delete', role: 'destructive' }
      ]
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'destructive') {
      await this.confirmDeleteVersion(version.versionId);
    }
  }

  formatArchivedDate(version: WelcomePageVersionSummary): string {
    const ts = version.archivedAt as { toDate?: () => Date } | undefined;
    if (ts && typeof ts.toDate === 'function') {
      return ts.toDate().toLocaleString();
    }
    return version.label || version.versionId;
  }

  previewSavedVersion(version: WelcomePageVersionSummary) {
    void this.router.navigate(['/admin/welcome-preview'], {
      queryParams: {
        versionId: version.versionId,
        versionTitle: versionDisplayTitle(version)
      }
    });
  }

  async editVersionDetails(version: WelcomePageVersionSummary) {
    if (this.readOnlyMode) {
      await this.showToast('Site is in read-only mode. Editing version labels is disabled.', 'warning');
      return;
    }

    let saved: { displayTitle: string; displayDescription: string } | undefined;

    const alert = await this.alertController.create({
      header: 'Name this version',
      message: 'Add a title and optional note so you can find this backup later. These are only visible to admins.',
      inputs: [
        {
          name: 'displayTitle',
          type: 'text',
          placeholder: 'e.g. Easter 2026 welcome page',
          value: version.displayTitle || ''
        },
        {
          name: 'displayDescription',
          type: 'textarea',
          placeholder: 'Optional note (not shown on the public site)',
          value: version.displayDescription || ''
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          role: 'confirm',
          handler: (data) => {
            saved = {
              displayTitle: String(data?.displayTitle ?? '').trim(),
              displayDescription: String(data?.displayDescription ?? '').trim()
            };
          }
        }
      ]
    });
    this.blurActiveElement();
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'confirm' && saved) {
      await this.confirmUpdateVersionMetadata(
        version.versionId,
        saved.displayTitle,
        saved.displayDescription
      );
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

  private async confirmPublish() {
    const loading = await this.presentLoading('Publishing welcome page...');
    this.beginSaving('publish');

    try {
      await this.uploadPendingImages();
      await this.welcomeContentService.publishContent(this.prepareContentForSave());
      this.hasDraft = true;
      await this.reloadEditorState();
      await this.showToast('Welcome page published. SEO pages will rebuild shortly.', 'success');
    } catch (error) {
      console.error('Failed to publish welcome page:', error);
      await this.showToast('Failed to publish welcome page', 'danger');
    } finally {
      await this.endSaving(loading);
    }
  }

  private async confirmDiscardDraft() {
    const loading = await this.presentLoading('Discarding draft...');

    try {
      await this.welcomeContentService.discardDraft();
      await this.reloadEditorState();
      await this.showToast('Draft discarded. Editor shows the live page.', 'success');
    } catch (error) {
      console.error('Failed to discard draft:', error);
      await this.showToast('Failed to discard draft', 'danger');
    } finally {
      await this.endSaving(loading);
    }
  }

  private async confirmRestoreToDraft(versionId: string) {
    const loading = await this.presentLoading('Loading version...');
    this.beginSaving('restore');

    try {
      this.content = await this.welcomeContentService.restoreVersionToDraft(versionId);
      this.syncImagePreviews();
      this.hasDraft = true;
      await this.showToast('Version loaded into editor. Publish when ready.', 'success');
    } catch (error) {
      console.error('Failed to restore version:', error);
      await this.showToast('Failed to load version', 'danger');
    } finally {
      await this.endSaving(loading);
    }
  }

  private async confirmPublishVersion(versionId: string) {
    const loading = await this.presentLoading('Publishing version...');
    this.beginSaving('publish');

    try {
      await this.welcomeContentService.publishVersion(versionId);
      await this.reloadEditorState();
      await this.showToast('Previous version published live.', 'success');
    } catch (error) {
      console.error('Failed to publish version:', error);
      await this.showToast('Failed to publish version', 'danger');
    } finally {
      await this.endSaving(loading);
    }
  }

  private async confirmUpdateVersionMetadata(
    versionId: string,
    displayTitle: string,
    displayDescription: string
  ) {
    const loading = await this.presentLoading('Saving version label...');
    this.beginSaving('metadata');

    try {
      await this.welcomeContentService.updateVersionMetadata(versionId, displayTitle, displayDescription);
      await this.reloadEditorState();
      await this.showToast('Version label saved.', 'success');
    } catch (error) {
      console.error('Failed to update version metadata:', error);
      await this.showToast('Failed to save version label', 'danger');
    } finally {
      await this.endSaving(loading);
    }
  }

  private async confirmDeleteVersion(versionId: string) {
    const loading = await this.presentLoading('Deleting version...');
    this.beginSaving('delete');

    try {
      await this.welcomeContentService.deleteVersion(versionId);
      await this.reloadEditorState();
      await this.showToast('Saved version deleted.', 'success');
    } catch (error) {
      console.error('Failed to delete version:', error);
      await this.showToast('Failed to delete version', 'danger');
    } finally {
      await this.endSaving(loading);
    }
  }

  private blurActiveElement() {
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }
  }

  private async presentLoading(message: string) {
    this.blurActiveElement();
    const loading = await this.loadingController.create({ message });
    await loading.present();
    return loading;
  }

  private beginSaving(action: 'draft' | 'publish' | 'preview' | 'discard' | 'restore' | 'delete' | 'metadata') {
    this.ngZone.run(() => {
      this.isSaving = true;
      this.savingAction = action;
      this.cdr.markForCheck();
    });
  }

  private async endSaving(loading: HTMLIonLoadingElement) {
    this.ngZone.run(() => {
      this.isSaving = false;
      this.savingAction = null;
      this.cdr.markForCheck();
    });
    try {
      await loading.dismiss();
    } catch {
      // Overlay may already be dismissed
    }
  }

  private async reloadEditorState() {
    const { content, hasDraft } = await this.welcomeContentService.loadEditorContent();
    this.content = content;
    this.hasDraft = hasDraft;
    this.syncImagePreviews();
    try {
      this.versions = await this.welcomeContentService.listVersions();
      this.versionsLoadFailed = false;
    } catch (error) {
      console.warn('Could not list welcome versions:', error);
      this.versions = [];
      this.versionsLoadFailed = true;
    }
    this.ngZone.run(() => this.cdr.markForCheck());
  }

  private syncImagePreviews() {
    this.logoPreviewUrl = this.content.logoImageUrl || DEFAULT_LOGO_IMAGE_URL;
    this.heroPreviewUrl = this.content.heroImageUrl || DEFAULT_HERO_IMAGE_URL;
    this.logoFile = null;
    this.heroFile = null;
  }

  private async prepareAndValidate(): Promise<boolean> {
    if (this.readOnlyMode) {
      await this.showToast('Site is in read-only mode. Changes cannot be saved.', 'warning');
      return false;
    }

    const socialError = this.validateLinks(this.content.socialLinks, 'social');
    if (socialError) {
      await this.showToast(socialError, 'danger');
      return false;
    }
    const supportError = this.validateLinks(this.content.supportLinks, 'support');
    if (supportError) {
      await this.showToast(supportError, 'danger');
      return false;
    }
    return true;
  }

  private async uploadPendingImages() {
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

    this.isUploadingLogo = false;
    this.isUploadingHero = false;
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
