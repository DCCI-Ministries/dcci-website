import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonButton,
  IonIcon,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonCheckbox,
  LoadingController,
  ToastController,
  AlertController
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { AuthService, AdminUser } from '../../../services/auth';
import { ContentService, Content } from '../../../services/content.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-published',
  templateUrl: './published.page.html',
  styleUrls: ['./published.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonButton,
    IonIcon,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonCheckbox,
    CommonModule,
    FormsModule
  ]
})
export class PublishedPage implements OnInit, OnDestroy {
  currentUser: AdminUser | null = null;
  published: Content[] = [];
  filteredPublished: Content[] = [];
  isLoading = false;
  searchTerm = '';
  searchType: 'title' | 'content' | 'tags' | 'date' = 'title';
  sortBy: 'date' | 'title' = 'date';
  showYouTubeArticles = true; // Default to showing YouTube articles
  showArchiveArticles = true; // Default to showing archived articles
  showWrittenArticles = true; // Default to showing new written articles

  constructor(
    private router: Router,
    private authService: AuthService,
    private contentService: ContentService,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private alertController: AlertController
  ) {}

  async ngOnInit() {
    const user = await firstValueFrom(this.authService.currentUser$);
    if (!user || !user.isAdmin || !user.emailVerified) {
      this.router.navigate(['/admin/dashboard']);
      return;
    }
    this.currentUser = user;
    await this.loadPublished();
  }

  ngOnDestroy() {}

  async loadPublished() {
    this.isLoading = true;
    try {
      this.published = await this.contentService.getPublishedContent();
      this.applyFilters();
    } catch (error) {
      console.error('Error loading published content:', error);
      await this.showToast('Failed to load published content', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  async onSearch() {
    // Use local filtering instead of service search to respect YouTube filter
    this.applyFilters();
  }

  private isYouTubeArticle(article: Content): boolean {
    const data = article as any;
    return data.type === 'youtube' || !!data.youtubeVideoId || !!data.youtubeUrl;
  }

  private isArchiveArticle(article: Content): boolean {
    const data = article as any;
    return data.archive === true;
  }

  private isWrittenArticle(article: Content): boolean {
    // Written articles are those that are NOT YouTube and NOT archived
    return !this.isYouTubeArticle(article) && !this.isArchiveArticle(article);
  }

  applyFilters() {
    let filtered = [...this.published];

    // Filter by content type checkboxes
    filtered = filtered.filter(article => {
      const isYouTube = this.isYouTubeArticle(article);
      const isArchive = this.isArchiveArticle(article);
      const isWritten = this.isWrittenArticle(article);

      // Show article if it matches any of the checked filter types
      let shouldShow = false;
      if (this.showYouTubeArticles && isYouTube) shouldShow = true;
      if (this.showArchiveArticles && isArchive) shouldShow = true;
      if (this.showWrittenArticles && isWritten) shouldShow = true;

      return shouldShow;
    });

    // Apply search filter if search term exists
    if (this.searchTerm.trim()) {
      const searchLower = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(article => {
        switch (this.searchType) {
          case 'title':
            return article.title.toLowerCase().includes(searchLower);
          case 'content':
            const contentText = article.content?.replace(/<[^>]*>/g, '').toLowerCase() || '';
            return contentText.includes(searchLower) ||
                   (article.excerpt && article.excerpt.toLowerCase().includes(searchLower));
          case 'tags':
            if (!article.tags || article.tags.length === 0) return false;
            return article.tags.some(tag => tag.toLowerCase().includes(searchLower));
          case 'date':
            const dateStr = this.getDate(article.publishedAt || article.createdAt).toLocaleDateString();
            return dateStr.includes(searchLower);
          default:
            return true;
        }
      });
    }

    // Sort
    const isOnlyShowingArchives = this.showArchiveArticles && !this.showYouTubeArticles && !this.showWrittenArticles;

    if (this.sortBy === 'title') {
      filtered.sort((a, b) => {
        const aIsArchive = this.isArchiveArticle(a);
        const bIsArchive = this.isArchiveArticle(b);

        // If only showing archives, sort normally
        // Otherwise, archives come last
        if (!isOnlyShowingArchives) {
          if (aIsArchive && !bIsArchive) return 1;
          if (!aIsArchive && bIsArchive) return -1;
        }

        return a.title.localeCompare(b.title);
      });
    } else {
      filtered.sort((a, b) => {
        const aIsArchive = this.isArchiveArticle(a);
        const bIsArchive = this.isArchiveArticle(b);

        // If only showing archives, sort normally
        // Otherwise, archives come last
        if (!isOnlyShowingArchives) {
          if (aIsArchive && !bIsArchive) return 1;
          if (!aIsArchive && bIsArchive) return -1;
        }

        const aDate = a.publishedAt || a.createdAt;
        const bDate = b.publishedAt || b.createdAt;
        const aTime = aDate instanceof Date ? aDate.getTime() : new Date(aDate as any).getTime();
        const bTime = bDate instanceof Date ? bDate.getTime() : new Date(bDate as any).getTime();
        return bTime - aTime;
      });
    }

    this.filteredPublished = filtered;
  }

  onSortChange() {
    this.applyFilters();
  }

  onYouTubeFilterChange() {
    this.applyFilters();
  }

  onArchiveFilterChange() {
    this.applyFilters();
  }

  onWrittenArticlesFilterChange() {
    this.applyFilters();
  }

  async editPublished(content: Content) {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.router.navigate(['/admin/content/edit', content.id]);
  }

  async unpublishContent(content: Content) {
    const alert = await this.alertController.create({
      header: 'Unpublish Article',
      message: `Are you sure you want to unpublish "${content.title}"? It will be moved to drafts.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Unpublish',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Unpublishing...'
            });
            await loading.present();

            try {
              await this.contentService.unpublishContent(content.id!);
              await loading.dismiss();
              await this.showToast('Content unpublished successfully');
              await this.loadPublished();
            } catch (error) {
              await loading.dismiss();
              console.error('Error unpublishing content:', error);
              await this.showToast('Failed to unpublish content', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async deletePublished(content: Content) {
    const alert = await this.alertController.create({
      header: 'Delete Article',
      message: `Are you sure you want to delete "${content.title}"? This action cannot be undone.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Deleting...'
            });
            await loading.present();

            try {
              await this.contentService.deleteContent(content.id!);
              await loading.dismiss();
              await this.showToast('Article deleted successfully');
              await this.loadPublished();
            } catch (error) {
              await loading.dismiss();
              console.error('Error deleting article:', error);
              await this.showToast('Failed to delete article', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  viewPublished(content: Content) {
    // Navigate to view/edit page
    this.router.navigate(['/admin/content/edit', content.id]);
  }

  getDate(date: Date | any): Date {
    if (!date) return new Date();
    if (date instanceof Date) return date;
    if (date && typeof date.toDate === 'function') {
      return date.toDate();
    }
    return new Date(date);
  }

  getThumbnailUrl(article: Content): string | null {
    const data = article as any;
    return data.thumbnailUrl || article.featuredImage || null;
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
}

