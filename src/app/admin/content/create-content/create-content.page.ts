import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonButton,
  IonIcon,
  IonInput,
  IonTextarea,
  IonLabel,
  IonItem,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonBackButton,
  IonButtons,
  IonChip,
  IonSpinner,
  LoadingController,
  ToastController
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { AuthService, AdminUser } from '../../../services/auth';
import { ContentService } from '../../../services/content.service';
import { SiteSettingsService } from '../../../services/site-settings.service';
import { QuillModule } from 'ngx-quill';
import Quill from 'quill';
import { firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { Timestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-create-content',
  templateUrl: './create-content.page.html',
  styleUrls: ['./create-content.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonButton,
    IonIcon,
    IonInput,
    IonTextarea,
    IonLabel,
    IonItem,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonBackButton,
    IonButtons,
    IonChip,
    IonSpinner,
    CommonModule,
    FormsModule,
    QuillModule
  ],
  providers: [ContentService]
})
export class CreateContentPage implements OnInit {
  title: string = '';
  excerpt: string = '';
  content: string = '';
  tagsInput: string = '';
  tags: string[] = [];
  slug: string = '';
  showSlugField: boolean = false;
  currentUser: AdminUser | null = null;
  isSaving: boolean = false;
  isPublishing: boolean = false;
  savedContentId: string | null = null;
  isEditMode: boolean = false;
  isArchiveMode: boolean = false;
  thumbnailUrl: string = '';
  thumbnailFile: File | null = null;
  isUploadingThumbnail: boolean = false;
  readOnlyMode: boolean = false;
  // Archive-specific fields
  originalDate: string = '';
  originalAuthor: string = '';
  archiveSource: string = 'wayback machine';

  // Quill editor configuration
  quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'direction': 'rtl' }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      [{ 'color': [] }, { 'background': [] }],
      [{
        'font': [
          'arial',
          'helvetica',
          'times-new-roman',
          'courier-new',
          'georgia',
          'verdana',
          'trebuchet-ms',
          'comic-sans-ms',
          'impact',
          'lucida-console',
          'tahoma',
          'palatino',
          'garamond',
          'bookman',
          'roboto',
          'open-sans',
          'lato',
          'montserrat',
          'raleway',
          'merriweather',
          'playfair-display',
          'source-sans-pro',
          'poppins',
          'oswald',
          'ubuntu'
        ]
      }],
      [{ 'align': [] }],
      ['link', 'image', 'video'],
      ['blockquote', 'code-block'],
      ['clean']
    ]
  };

  constructor(
    private router: Router,
    private authService: AuthService,
    public contentService: ContentService,
    private siteSettingsService: SiteSettingsService,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private storage: Storage
  ) {
    // Configure Quill fonts
    this.configureQuillFonts();
    // Register custom video handler for YouTube/Vimeo
    this.registerVideoHandler();
  }

  private configureQuillFonts() {
    // Quill 2.x requires fonts to be whitelisted
    const Font = Quill.import('formats/font') as any;
    if (Font && Font.whitelist) {
      Font.whitelist = [
        'arial',
        'helvetica',
        'times-new-roman',
        'courier-new',
        'georgia',
        'verdana',
        'trebuchet-ms',
        'comic-sans-ms',
        'impact',
        'lucida-console',
        'tahoma',
        'palatino',
        'garamond',
        'bookman',
        'roboto',
        'open-sans',
        'lato',
        'montserrat',
        'raleway',
        'merriweather',
        'playfair-display',
        'source-sans-pro',
        'poppins',
        'oswald',
        'ubuntu'
      ];
      Quill.register(Font, true);
    }
  }

  private registerVideoHandler() {
    // This will be called when the editor is created
    // We'll handle video embedding in onEditorCreated
  }

  /**
   * Clean up excessive line breaks in Quill Delta content for archive mode
   * Removes excessive consecutive line breaks while preserving intentional ones (after headings, lists, etc.)
   * Only used when isArchiveMode is true
   */
  private cleanArchiveContentLineBreaks(deltaContent: string): string {
    try {
      const delta = JSON.parse(deltaContent);
      if (!delta || !delta.ops || !Array.isArray(delta.ops)) {
        return deltaContent; // Return original if invalid format
      }

      const cleanedOps: any[] = [];
      let consecutiveNewlines = 0;

      for (let i = 0; i < delta.ops.length; i++) {
        const op = delta.ops[i];
        const insert = op.insert;
        
        // Check if this op contains line breaks
        if (typeof insert === 'string') {
          const hasAttributes = op.attributes && Object.keys(op.attributes).length > 0;
          
          // If this op has attributes (header, list, blockquote, etc.), always keep it
          if (hasAttributes) {
            // Reset counter and add the op - these are intentional formatting
            consecutiveNewlines = 0;
            cleanedOps.push(op);
          } else if (insert === '\n') {
            // Single newline op - count consecutive ones
            consecutiveNewlines++;
            
            // Keep max 2 consecutive plain line breaks (for paragraph spacing)
            if (consecutiveNewlines <= 2) {
              cleanedOps.push(op);
            }
            // Otherwise skip this excessive line break
          } else if (insert.includes('\n')) {
            // Text with embedded newlines - clean them up
            // Replace 3+ consecutive newlines with max 2
            const cleanedInsert = insert.replace(/\n{3,}/g, '\n\n');
            
            if (cleanedInsert !== insert) {
              // Only update if we changed something
              cleanedOps.push({ ...op, insert: cleanedInsert });
            } else {
              cleanedOps.push(op);
            }
            
            // Update consecutive count based on trailing newlines
            const trailingNewlines = cleanedInsert.match(/\n+$/)?.[0]?.length || 0;
            consecutiveNewlines = trailingNewlines;
          } else {
            // Regular text without newlines - reset counter and add the op
            consecutiveNewlines = 0;
            cleanedOps.push(op);
          }
        } else {
          // Non-string insert (embed, etc.) - reset counter and add the op
          consecutiveNewlines = 0;
          cleanedOps.push(op);
        }
      }

      return JSON.stringify({ ops: cleanedOps });
    } catch (error) {
      console.error('Error cleaning archive content line breaks:', error);
      return deltaContent; // Return original on error
    }
  }

  onEditorCreated(quill: any) {
    // Custom video button handler for YouTube/Vimeo support
    const toolbar = quill.getModule('toolbar');
    if (toolbar) {
      toolbar.addHandler('video', () => {
        const url = prompt('Enter video URL (YouTube, Vimeo, or direct video link):');
        if (url) {
          // Parse YouTube URL
          const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
          const youtubeMatch = url.match(youtubeRegex);

          // Parse Vimeo URL
          const vimeoRegex = /(?:vimeo\.com\/)(\d+)/;
          const vimeoMatch = url.match(vimeoRegex);

          const range = quill.getSelection(true);

          if (youtubeMatch) {
            // Insert YouTube iframe
            const embedUrl = `https://www.youtube.com/embed/${youtubeMatch[1]}`;
            const iframe = `<iframe src="${embedUrl}" frameborder="0" allowfullscreen width="100%" height="400" style="max-width: 100%;"></iframe>`;
            quill.clipboard.dangerouslyPasteHTML(range.index, `<div class="ql-video-wrapper">${iframe}</div>`);
          } else if (vimeoMatch) {
            // Insert Vimeo iframe
            const embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
            const iframe = `<iframe src="${embedUrl}" frameborder="0" allowfullscreen width="100%" height="400" style="max-width: 100%;"></iframe>`;
            quill.clipboard.dangerouslyPasteHTML(range.index, `<div class="ql-video-wrapper">${iframe}</div>`);
          } else {
            // Use default video embed for direct video URLs
            quill.insertEmbed(range.index, 'video', url, 'user');
          }

          quill.setSelection(range.index + 1, 'silent');
        }
      });
    }
  }

  async ngOnInit() {
    // Subscribe to read-only mode
    this.siteSettingsService.readOnlyMode$.subscribe(readOnly => {
      this.readOnlyMode = readOnly;
    });

    // Verify user is admin and load user data
    // Wait for non-null user (filter out null values to ensure auth is ready)
    const user = await firstValueFrom(
      this.authService.currentUser$.pipe(
        filter(u => u !== null),
        take(1)
      )
    );
    if (!user || !user.isAdmin || !user.emailVerified) {
      this.router.navigate(['/admin/dashboard']);
      return;
    }
    this.currentUser = user;

    // Check if we're in archive mode
    const url = this.router.url;
    if (url.includes('/archive')) {
      this.isArchiveMode = true;
    }

    // Check if we're editing an existing content
    if (url.includes('/edit/')) {
      const contentId = url.split('/edit/')[1];
      if (contentId) {
        await this.loadContentForEdit(contentId);
      }
    }
  }

  async loadContentForEdit(contentId: string) {
    try {
      const content = await this.contentService.getContent(contentId);
      if (content) {
        this.isEditMode = true;
        this.savedContentId = content.id || null;
        this.title = content.title;
        this.excerpt = content.excerpt || '';
        this.content = content.content;
        this.tags = content.tags || [];
        this.tagsInput = this.tags.map(tag => tag.replace(/^#/, '')).join(', ');
        this.slug = content.slug || '';
        this.showSlugField = true; // Show slug field when editing
        // Load thumbnail URL
        const data = content as any;
        this.thumbnailUrl = data.thumbnailUrl || content.featuredImage || '';
        // Check if content is archived and set archive mode accordingly
        if (data.archive === true) {
          this.isArchiveMode = true;
          // Load archive-specific fields
          if (data.originalDate) {
            // Convert Date or Timestamp to date string (YYYY-MM-DD format)
            let dateValue: Date;
            if (data.originalDate instanceof Date) {
              dateValue = data.originalDate;
            } else if (data.originalDate && typeof (data.originalDate as any).toDate === 'function') {
              dateValue = (data.originalDate as any).toDate();
            } else {
              dateValue = new Date(data.originalDate);
            }
            this.originalDate = dateValue.toISOString().split('T')[0]; // Format as YYYY-MM-DD
          }
          this.originalAuthor = data.originalAuthor || '';
          this.archiveSource = data.archiveSource || 'wayback machine';
        }
      }
    } catch (error) {
      console.error('Error loading content for edit:', error);
      await this.showToast('Failed to load content', 'danger');
    }
  }

  onTagsInput() {
    // Parse tags from input - split by comma and clean up
    this.tags = this.tagsInput
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .map(tag => {
        // Add # if not present
        if (tag.startsWith('#')) {
          return tag;
        }
        return '#' + tag;
      });
  }

  /**
   * Validates thumbnail image file for security
   * Only allows safe static image formats (JPEG, PNG, WebP, etc.)
   * Explicitly excludes GIF, AVI, SVG, and other potentially dangerous formats
   */
  private validateThumbnailFile(file: File): { valid: boolean; error?: string } {
    // Maximum file size: 5MB
    const MAX_FILE_SIZE = 5 * 1024 * 1024;

    // Allowed MIME types - only safe static image formats
    const ALLOWED_MIME_TYPES = [
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

    // Allowed file extensions (case-insensitive)
    const ALLOWED_EXTENSIONS = [
      '.jpg',
      '.jpeg',
      '.png',
      '.webp',
      '.bmp',
      '.tiff',
      '.tif',
      '.avif',
      '.heic',
      '.heif'
    ];

    // Explicitly blocked MIME types
    const BLOCKED_MIME_TYPES = [
      'image/gif',
      'image/svg+xml',
      'image/svg',
      'video/',
      'audio/',
      'application/',
      'text/',
      'model/'
    ];

    // Check file size
    if (file.size === 0) {
      return { valid: false, error: 'File is empty' };
    }

    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `Image size must be less than 5MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB` };
    }

    // Check if file type is explicitly blocked
    const lowerMimeType = file.type.toLowerCase();
    for (const blockedType of BLOCKED_MIME_TYPES) {
      if (lowerMimeType.startsWith(blockedType)) {
        return { valid: false, error: `File type not allowed. GIF, SVG, video, and other non-image files are not permitted.` };
      }
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(lowerMimeType)) {
      return { valid: false, error: `Invalid file type. Only JPEG, PNG, WebP, BMP, TIFF, AVIF, and HEIC images are allowed.` };
    }

    // Validate file extension (additional security layer)
    const fileName = file.name.toLowerCase();
    const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));

    if (!hasValidExtension) {
      return { valid: false, error: `Invalid file extension. Only .jpg, .jpeg, .png, .webp, .bmp, .tiff, .avif, and .heic files are allowed.` };
    }

    // Additional security: Check for double extensions (e.g., image.jpg.exe)
    const parts = fileName.split('.');
    if (parts.length > 2) {
      const lastExt = '.' + parts[parts.length - 1];
      const secondLastExt = '.' + parts[parts.length - 2];
      // If the last extension is not in allowed list, or if there's a suspicious pattern
      if (!ALLOWED_EXTENSIONS.includes(lastExt) ||
          (secondLastExt && !ALLOWED_EXTENSIONS.includes(secondLastExt) && secondLastExt !== '.tar')) {
        return { valid: false, error: 'Suspicious file name detected. Please use a standard image file.' };
      }
    }

    return { valid: true };
  }

  /**
   * Validates image dimensions
   * Returns a promise that resolves to validation result
   */
  private validateImageDimensions(file: File, maxDimension: number): Promise<{ valid: boolean; error?: string }> {
    return new Promise((resolve) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e: any) => {
        img.onload = () => {
          if (img.width > maxDimension || img.height > maxDimension) {
            resolve({
              valid: false,
              error: `Image dimensions must not exceed ${maxDimension}x${maxDimension} pixels. Current size: ${img.width}x${img.height}px`
            });
          } else {
            resolve({ valid: true });
          }
        };

        img.onerror = () => {
          // If we can't load the image, it might be corrupted, but we'll allow it
          // since MIME type and extension validation already passed
          resolve({ valid: true });
        };

        img.src = e.target.result;
      };

      reader.onerror = () => {
        resolve({ valid: true }); // Allow if we can't read, other validations will catch issues
      };

      reader.readAsDataURL(file);
    });
  }

  async onThumbnailSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      // Comprehensive validation
      const validation = this.validateThumbnailFile(file);
      if (!validation.valid) {
        this.showToast(validation.error || 'Invalid file', 'danger');
        // Clear the input
        input.value = '';
        return;
      }

      // Validate image dimensions
      const MAX_DIMENSION = 4000;
      const dimensionValidation = await this.validateImageDimensions(file, MAX_DIMENSION);
      if (!dimensionValidation.valid) {
        this.showToast(dimensionValidation.error || 'Invalid image dimensions', 'danger');
        // Clear the input
        input.value = '';
        return;
      }

      this.thumbnailFile = file;

      // Show preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.thumbnailUrl = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  async uploadThumbnail(): Promise<string | null> {
    // If no new file selected, return existing thumbnail URL (or null)
    if (!this.thumbnailFile) {
      // Return existing thumbnailUrl if it's already a URL (starts with http/https)
      // This preserves existing thumbnails when editing without changing them
      if (this.thumbnailUrl && (this.thumbnailUrl.startsWith('http://') || this.thumbnailUrl.startsWith('https://'))) {
        return this.thumbnailUrl;
      }
      // If thumbnailUrl is empty or was removed, return null
      return null;
    }

    if (!this.currentUser) {
      await this.showToast('User not authenticated', 'danger');
      return null;
    }

    // Re-validate file before upload (security: prevent tampering between selection and upload)
    const validation = this.validateThumbnailFile(this.thumbnailFile);
    if (!validation.valid) {
      await this.showToast(validation.error || 'Invalid file. Upload blocked for security.', 'danger');
      this.thumbnailFile = null;
      this.thumbnailUrl = '';
      return null;
    }

    this.isUploadingThumbnail = true;

    try {
      // Ensure user is authenticated
      if (!this.currentUser || !this.currentUser.uid) {
        await this.showToast('User not authenticated. Please log in again.', 'danger');
        return null;
      }

      // Create a unique filename with safe characters and proper extension
      const timestamp = Date.now();
      // Get file extension from original filename (validate it's safe)
      const originalName = this.thumbnailFile.name.toLowerCase();
      const extension = originalName.substring(originalName.lastIndexOf('.'));
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif', '.avif', '.heic', '.heif'];
      const safeExtension = allowedExtensions.includes(extension) ? extension : '.jpg'; // Default to .jpg if extension is missing

      // Sanitize filename: remove all non-alphanumeric except dots and hyphens, then add timestamp
      const baseName = originalName.replace(/\.[^.]*$/, ''); // Remove extension
      const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9-]/g, '_').substring(0, 50); // Limit length
      const sanitizedFileName = `${sanitizedBaseName}_${timestamp}${safeExtension}`;

      const filename = `thumbnails/${this.currentUser.uid}/${sanitizedFileName}`;
      const storageRef = ref(this.storage, filename);

      // Upload file (metadata is optional and may cause issues if Storage isn't fully configured)
      console.log('[Thumbnail Upload] Starting upload to:', filename);
      console.log('[Thumbnail Upload] File type:', this.thumbnailFile.type);
      console.log('[Thumbnail Upload] File size:', this.thumbnailFile.size, 'bytes');

      // Try upload without metadata first (simpler, more compatible)
      await uploadBytes(storageRef, this.thumbnailFile);
      console.log('[Thumbnail Upload] Upload successful');

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);
      console.log('[Thumbnail Upload] Download URL:', downloadURL);

      this.thumbnailUrl = downloadURL;
      this.thumbnailFile = null; // Clear file after successful upload

      return downloadURL;
    } catch (error: any) {
      console.error('Error uploading thumbnail:', error);
      console.error('Error code:', error?.code);
      console.error('Error message:', error?.message);

      let errorMessage = 'Failed to upload thumbnail. Please try again.';

      // Check for specific error codes
      if (error?.code === 'storage/unauthorized') {
        errorMessage = 'Permission denied. Please ensure you are logged in as an admin.';
      } else if (error?.code === 'storage/quota-exceeded') {
        errorMessage = 'Storage quota exceeded. Please contact support.';
      } else if (error?.code === 'storage/unauthenticated') {
        errorMessage = 'Not authenticated. Please log in again.';
      } else if (error?.message?.includes('CORS') || error?.message?.includes('preflight')) {
        errorMessage = 'Firebase Storage is not enabled. Please enable Storage in Firebase Console and deploy storage rules. See STORAGE_SETUP.md for instructions.';
      } else if (error?.message?.includes('bucket') || error?.code === 'storage/unknown') {
        errorMessage = 'Firebase Storage is not set up. Please enable Storage in Firebase Console.';
      }

      // Log full error for debugging
      console.error('[Thumbnail Upload] Full error object:', {
        code: error?.code,
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      });

      await this.showToast(errorMessage, 'danger');
      return null;
    } finally {
      this.isUploadingThumbnail = false;
    }
  }

  removeThumbnail() {
    this.thumbnailUrl = '';
    this.thumbnailFile = null;
  }

  private async showToast(message: string, color: 'success' | 'danger' = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'top'
    });
    await toast.present();
  }

  private validateForm(): boolean {
    if (!this.title.trim()) {
      this.showToast('Please enter a title', 'danger');
      return false;
    }
    if (!this.content.trim()) {
      this.showToast('Please enter content', 'danger');
      return false;
    }
    return true;
  }

  async saveDraft() {
    // Check if read-only mode is enabled (admins can still write, this is just UI check)
    // Firestore rules are authoritative
    if (this.readOnlyMode) {
      await this.showToast('Site is in read-only mode. Save disabled.', 'danger');
      return;
    }

    if (!this.validateForm()) {
      return;
    }

    // Ensure auth is ready before writing
    if (!this.currentUser) {
      // Wait for user to load if not ready
      const user = await firstValueFrom(
        this.authService.currentUser$.pipe(
          filter(u => u !== null),
          take(1)
        )
      );
      if (!user || !user.isAdmin) {
        this.showToast('User not authenticated or not an admin', 'danger');
        return;
      }
      this.currentUser = user;
    }

    // Debug: Check admin status
    if (!this.currentUser.isAdmin) {
      console.error('[CreateContent] User is not an admin:', this.currentUser);
      this.showToast('You do not have admin privileges', 'danger');
      return;
    }

    // Debug logging
    console.log('[CreateContent] Current user:', {
      uid: this.currentUser.uid,
      email: this.currentUser.email,
      isAdmin: this.currentUser.isAdmin,
      emailVerified: this.currentUser.emailVerified
    });
    console.log('[CreateContent] Admin check: User should have adminUsers/' + this.currentUser.uid + ' with isAdmin=true');

    this.isSaving = true;
    const loading = await this.loadingController.create({
      message: 'Saving draft...'
    });
    await loading.present();

    try {
      // Upload thumbnail if a new file was selected
      // Note: If Storage isn't enabled, this will fail gracefully
      const thumbnailUrl = await this.uploadThumbnail();

      // If upload failed but we have a file, warn user but continue
      if (this.thumbnailFile && !thumbnailUrl) {
        const continueWithoutThumbnail = confirm(
          'Thumbnail upload failed. This usually means Firebase Storage is not enabled.\n\n' +
          'Would you like to continue publishing without a thumbnail?\n\n' +
          'To fix this:\n' +
          '1. Go to Firebase Console → Storage\n' +
          '2. Click "Get Started" to enable Storage\n' +
          '3. Run: firebase deploy --only storage\n\n' +
          'See STORAGE_SETUP.md for detailed instructions.'
        );
        if (!continueWithoutThumbnail) {
          this.isSaving = false;
          await loading.dismiss();
          return;
        }
      }

      // Clean up line breaks for archive content only
      let processedContent = this.content.trim();
      if (this.isArchiveMode) {
        processedContent = this.cleanArchiveContentLineBreaks(processedContent);
      }

      const contentData: any = {
        title: this.title.trim(),
        excerpt: this.excerpt.trim(),
        content: processedContent,
        status: 'draft',
        authorId: this.currentUser.uid,
        authorEmail: this.currentUser.email,
        tags: this.tags.length > 0 ? this.tags : undefined
      };

      // Add archive flag and archive-specific fields if in archive mode
      if (this.isArchiveMode) {
        contentData.archive = true;

        // Add original date if provided
        if (this.originalDate && this.originalDate.trim()) {
          const dateObj = new Date(this.originalDate);
          if (!isNaN(dateObj.getTime())) {
            contentData.originalDate = Timestamp.fromDate(dateObj);
          }
        }

        // Add original author if provided
        if (this.originalAuthor && this.originalAuthor.trim()) {
          contentData.originalAuthor = this.originalAuthor.trim();
        }

        // Add archive source (default to "wayback machine" if not entered)
        contentData.archiveSource = (this.archiveSource && this.archiveSource.trim())
          ? this.archiveSource.trim()
          : 'wayback machine';
      }

      // Add thumbnailUrl (include null to allow clearing)
      contentData.thumbnailUrl = thumbnailUrl || null;

      if (this.savedContentId) {
        // Update existing draft
        // Preserve archive flag and archive fields if they were already set (unless we're explicitly in archive mode)
        if (!this.isArchiveMode) {
          const existingContent = await this.contentService.getContent(this.savedContentId);
          if (existingContent) {
            const data = existingContent as any;
            if (data.archive === true) {
              contentData.archive = true;
              // Preserve archive-specific fields
              if (data.originalDate) {
                contentData.originalDate = data.originalDate;
              }
              if (data.originalAuthor) {
                contentData.originalAuthor = data.originalAuthor;
              }
              if (data.archiveSource) {
                contentData.archiveSource = data.archiveSource;
              }
            }
          }
        }
        console.log('[CreateContent] Updating existing draft, ID:', this.savedContentId);
        console.log('[CreateContent] Current user UID (will be preserved from existing doc):', this.currentUser.uid);
        await this.contentService.updateDraft(this.savedContentId, contentData, this.slug.trim() || undefined);
        await this.showToast('Draft updated successfully');
      } else {
        // Create new draft
        console.log('[CreateContent] Creating new draft');
        console.log('[CreateContent] Current user UID (will be used as authorId):', this.currentUser.uid);
        this.savedContentId = await this.contentService.saveDraft(contentData, this.slug.trim() || undefined);
        await this.showToast('Draft saved successfully');
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      await this.showToast('Failed to save draft. Please try again.', 'danger');
    } finally {
      this.isSaving = false;
      await loading.dismiss();
    }
  }

  async publish() {
    // Check if read-only mode is enabled (admins can still write, this is just UI check)
    // Firestore rules are authoritative
    const readOnlyMode = await firstValueFrom(this.siteSettingsService.readOnlyMode$);
    if (readOnlyMode) {
      await this.showToast('Site is in read-only mode. Publish disabled.', 'danger');
      return;
    }

    if (!this.validateForm()) {
      return;
    }

    // Ensure auth is ready before writing
    if (!this.currentUser) {
      // Wait for user to load if not ready
      const user = await firstValueFrom(
        this.authService.currentUser$.pipe(
          filter(u => u !== null),
          take(1)
        )
      );
      if (!user || !user.isAdmin) {
        this.showToast('User not authenticated or not an admin', 'danger');
        return;
      }
      this.currentUser = user;
    }

    this.isPublishing = true;
    const loading = await this.loadingController.create({
      message: 'Publishing content...'
    });
    await loading.present();

    try {
      // Upload thumbnail if a new file was selected
      // Note: If Storage isn't enabled, this will fail gracefully
      const thumbnailUrl = await this.uploadThumbnail();

      // If upload failed but we have a file, warn user but continue
      if (this.thumbnailFile && !thumbnailUrl) {
        const continueWithoutThumbnail = confirm(
          'Thumbnail upload failed. This usually means Firebase Storage is not enabled.\n\n' +
          'Would you like to continue publishing without a thumbnail?\n\n' +
          'To fix this:\n' +
          '1. Go to Firebase Console → Storage\n' +
          '2. Click "Get Started" to enable Storage\n' +
          '3. Run: firebase deploy --only storage\n\n' +
          'See STORAGE_SETUP.md for detailed instructions.'
        );
        if (!continueWithoutThumbnail) {
          this.isPublishing = false;
          await loading.dismiss();
          return;
        }
      }

      const isUpdate = !!this.savedContentId;
      console.log('[CreateContent] Publishing content');
      console.log('[CreateContent] Operation:', isUpdate ? 'UPDATE (existing document)' : 'CREATE (new document)');
      console.log('[CreateContent] Document ID:', this.savedContentId || '(new document)');
      console.log('[CreateContent] Current user UID:', this.currentUser.uid);
      if (isUpdate) {
        console.log('[CreateContent] Note: authorId will be preserved from existing document (immutable)');
      } else {
        console.log('[CreateContent] Note: authorId will be set to current user (new document)');
      }

      // Clean up line breaks for archive content only
      let processedContent = this.content.trim();
      if (this.isArchiveMode) {
        processedContent = this.cleanArchiveContentLineBreaks(processedContent);
      }

      const contentData: any = {
        title: this.title.trim(),
        excerpt: this.excerpt.trim(),
        content: processedContent,
        status: 'published',
        authorId: this.currentUser.uid,
        authorEmail: this.currentUser.email,
        tags: this.tags.length > 0 ? this.tags : undefined
      };

      // Add archive flag and archive-specific fields if in archive mode
      if (this.isArchiveMode) {
        contentData.archive = true;

        // Add original date if provided
        if (this.originalDate && this.originalDate.trim()) {
          const dateObj = new Date(this.originalDate);
          if (!isNaN(dateObj.getTime())) {
            contentData.originalDate = Timestamp.fromDate(dateObj);
          }
        }

        // Add original author if provided
        if (this.originalAuthor && this.originalAuthor.trim()) {
          contentData.originalAuthor = this.originalAuthor.trim();
        }

        // Add archive source (default to "wayback machine" if not entered)
        contentData.archiveSource = (this.archiveSource && this.archiveSource.trim())
          ? this.archiveSource.trim()
          : 'wayback machine';
      } else if (this.savedContentId) {
        // Preserve archive flag and archive fields if they were already set (when updating existing content)
        const existingContent = await this.contentService.getContent(this.savedContentId);
        if (existingContent) {
          const data = existingContent as any;
          if (data.archive === true) {
            contentData.archive = true;
            // Preserve archive-specific fields
            if (data.originalDate) {
              contentData.originalDate = data.originalDate;
            }
            if (data.originalAuthor) {
              contentData.originalAuthor = data.originalAuthor;
            }
            if (data.archiveSource) {
              contentData.archiveSource = data.archiveSource;
            }
          }
        }
      }

      // Add thumbnailUrl (include null to allow clearing)
      contentData.thumbnailUrl = thumbnailUrl || null;

      const contentId = await this.contentService.publish(contentData, this.savedContentId || undefined, this.slug.trim() || undefined);

      this.savedContentId = contentId;
      await this.showToast('Content published successfully!');

      // Navigate back to dashboard after a short delay
      setTimeout(() => {
        this.router.navigate(['/admin/dashboard']);
      }, 1500);
    } catch (error) {
      console.error('Error publishing content:', error);
      await this.showToast('Failed to publish content. Please try again.', 'danger');
    } finally {
      this.isPublishing = false;
      await loading.dismiss();
    }
  }

  cancel() {
    this.router.navigate(['/admin/dashboard']);
  }
}

