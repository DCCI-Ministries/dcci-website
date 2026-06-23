import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonButton,
  IonIcon
} from '@ionic/angular/standalone';
import { MenuController } from '@ionic/angular/standalone';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { VersionService } from '../services/version.service';
import { AnalyticsService } from '../services/analytics.service';
import { WelcomeContentService } from '../services/welcome-content.service';
import { ContactFormComponent } from '../components/contact-form.component';
import { NewsletterSignupComponent } from '../components/newsletter-signup.component';
import { ContentCarouselComponent } from '../components/content-carousel.component';
import { FooterComponent } from '../components/footer.component';
import { ScrollService } from '../services/scroll.service';
import {
  DEFAULT_HERO_IMAGE_URL,
  DEFAULT_LOGO_IMAGE_URL,
  mergeWelcomeContent,
  WelcomePageContent,
  WelcomePageLink,
  linkIconName
} from '../models/welcome-content.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.page.html',
  styleUrls: ['./welcome.page.scss'],
  imports: [CommonModule, IonContent, IonButton, IonIcon, ContactFormComponent, NewsletterSignupComponent, ContentCarouselComponent, FooterComponent],
  standalone: true
})
export class WelcomePage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(IonContent) content!: IonContent;
  version: string;
  isScrolled = false;
  isPreviewMode = false;
  previewVersionId = '';
  previewVersionTitle = '';
  pageContent: WelcomePageContent = mergeWelcomeContent(null);
  sanitizedMissionContent: SafeHtml = '';
  sanitizedSocialContent: SafeHtml = '';
  sanitizedSupportContent: SafeHtml = '';
  sanitizedTestimonyVerse: SafeHtml = '';

  private scrollSubscription?: Subscription;
  private contentSubscription?: Subscription;

  constructor(
    private versionService: VersionService,
    private analyticsService: AnalyticsService,
    private menuController: MenuController,
    private scrollService: ScrollService,
    private welcomeContentService: WelcomeContentService,
    private sanitizer: DomSanitizer,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.version = this.versionService.getVersion();
    this.isPreviewMode = this.route.snapshot.data['welcomePreview'] === true;
    if (!this.isPreviewMode) {
      this.analyticsService.trackPageView('/welcome').catch(() => {
        // Ignore tracking errors; already logged by service
      });
    }
  }

  get logoImageUrl(): string {
    return this.pageContent.logoImageUrl || DEFAULT_LOGO_IMAGE_URL;
  }

  get heroImageUrl(): string {
    return this.pageContent.heroImageUrl || DEFAULT_HERO_IMAGE_URL;
  }

  ngOnInit() {
    if (this.isPreviewMode) {
      void this.loadPreviewContent();
    } else {
      this.welcomeContentService.initialize();
      this.contentSubscription = this.welcomeContentService.content$.subscribe((content) => {
        this.pageContent = content;
        this.updateSanitizedContent(content);
      });
    }

    this.scrollSubscription = this.scrollService.getScrollState().subscribe(
      isScrolled => {
        this.isScrolled = isScrolled;
      }
    );
  }

  backToEditor() {
    this.router.navigate(['/admin/welcome-settings']);
  }

  private async loadPreviewContent() {
    const versionId = this.route.snapshot.queryParamMap.get('versionId');
    const versionTitle = this.route.snapshot.queryParamMap.get('versionTitle');

    if (versionId) {
      this.previewVersionId = versionId;
      this.previewVersionTitle = versionTitle || 'Saved version';
      try {
        this.pageContent = await this.welcomeContentService.loadVersionContent(versionId);
        this.updateSanitizedContent(this.pageContent);
      } catch (error) {
        console.error('Failed to load saved version preview:', error);
        this.pageContent = mergeWelcomeContent(null);
        this.updateSanitizedContent(this.pageContent);
      }
      return;
    }

    try {
      const draft = await this.welcomeContentService.loadDraftContent();
      const published = await this.welcomeContentService.loadPublishedContent();
      this.pageContent = draft ?? published;
      this.updateSanitizedContent(this.pageContent);
    } catch (error) {
      console.error('Failed to load welcome page preview:', error);
      this.pageContent = mergeWelcomeContent(null);
      this.updateSanitizedContent(this.pageContent);
    }
  }

  async ngAfterViewInit() {
    if (this.content) {
      await this.scrollService.registerScrollContainer(this.content);
    }
  }

  ngOnDestroy() {
    this.scrollSubscription?.unsubscribe();
    this.contentSubscription?.unsubscribe();
  }

  scrollToTop() {
    this.content.scrollToTop(500);
  }

  linkIcon(link: WelcomePageLink): string {
    return linkIconName(link);
  }

  onLogoClick(event: Event) {
    event.preventDefault();
    this.scrollToTop();
  }

  async openMenu() {
    try {
      const mainContent = document.getElementById('main-content');
      if (mainContent) {
        const focusedElement = mainContent.querySelector(':focus') as HTMLElement;
        if (focusedElement) {
          focusedElement.blur();
        }
        if (document.activeElement && mainContent.contains(document.activeElement)) {
          (document.activeElement as HTMLElement).blur();
        }
      }

      await this.menuController.enable(true, 'main-menu');
      await new Promise(resolve => setTimeout(resolve, 100));

      const isOpen = await this.menuController.isOpen('main-menu');
      if (!isOpen) {
        const result = await this.menuController.open('main-menu');
        if (!result) {
          await this.menuController.toggle('main-menu');
        }
      } else {
        await this.menuController.close('main-menu');
      }
    } catch (error) {
      console.error('Error opening menu:', error);
      try {
        await this.menuController.toggle('main-menu');
      } catch (toggleError) {
        console.error('Toggle also failed:', toggleError);
      }
    }
  }

  private updateSanitizedContent(content: WelcomePageContent) {
    this.sanitizedMissionContent = this.sanitizer.bypassSecurityTrustHtml(content.missionContent);
    this.sanitizedSocialContent = this.sanitizer.bypassSecurityTrustHtml(content.socialContent);
    this.sanitizedSupportContent = this.sanitizer.bypassSecurityTrustHtml(content.supportContent);
    this.sanitizedTestimonyVerse = this.sanitizer.bypassSecurityTrustHtml(this.normalizeVerseHtml(content.testimonyVerse));
  }

  private normalizeVerseHtml(html: string): string {
    const trimmed = (html || '').trim();
    if (!trimmed) {
      return '';
    }
    if (trimmed.startsWith('<')) {
      return trimmed;
    }
    return `<p>${trimmed}</p>`;
  }
}
