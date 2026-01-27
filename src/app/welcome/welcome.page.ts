import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonButton,
  IonIcon
} from '@ionic/angular/standalone';
import { MenuController } from '@ionic/angular/standalone';
import { VersionService } from '../services/version.service';
import { AnalyticsService } from '../services/analytics.service';
import { ContactFormComponent } from '../components/contact-form.component';
import { NewsletterSignupComponent } from '../components/newsletter-signup.component';
import { ContentCarouselComponent } from '../components/content-carousel.component';
import { FooterComponent } from '../components/footer.component';
import { ScrollService } from '../services/scroll.service';
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
  private scrollSubscription?: Subscription;

  constructor(
    private versionService: VersionService,
    private analyticsService: AnalyticsService,
    private menuController: MenuController,
    private scrollService: ScrollService
  ) {
    this.version = this.versionService.getVersion();
    this.analyticsService.trackPageView('/welcome').catch(() => {
      // Ignore tracking errors; already logged by service
    });
  }

  ngOnInit() {
    // Subscribe to scroll state changes
    this.scrollSubscription = this.scrollService.getScrollState().subscribe(
      isScrolled => {
        this.isScrolled = isScrolled;
      }
    );
  }

  async ngAfterViewInit() {
    // Register scroll container for collapsing header
    if (this.content) {
      await this.scrollService.registerScrollContainer(this.content);
    }
  }

  ngOnDestroy() {
    if (this.scrollSubscription) {
      this.scrollSubscription.unsubscribe();
    }
  }

  scrollToTop() {
    this.content.scrollToTop(500);
  }

  onLogoClick(event: Event) {
    event.preventDefault();
    this.scrollToTop();
  }

  async openMenu() {
    try {
      // Blur any focused elements in the main content before opening menu
      // This prevents aria-hidden warnings when Ionic sets aria-hidden on main content
      const mainContent = document.getElementById('main-content');
      if (mainContent) {
        const focusedElement = mainContent.querySelector(':focus') as HTMLElement;
        if (focusedElement) {
          focusedElement.blur();
        }
        // Also blur any active element that might be in the main content
        if (document.activeElement && mainContent.contains(document.activeElement)) {
          (document.activeElement as HTMLElement).blur();
        }
      }

      // Ensure menu is enabled
      await this.menuController.enable(true, 'main-menu');

      // Wait a bit for the menu to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Try to open the menu
      const isOpen = await this.menuController.isOpen('main-menu');
      if (!isOpen) {
        const result = await this.menuController.open('main-menu');
        console.log('Menu open result:', result);
        if (!result) {
          // If open() didn't work, try toggle
          await this.menuController.toggle('main-menu');
        }
      } else {
        // If already open, close it
        await this.menuController.close('main-menu');
      }
    } catch (error) {
      console.error('Error opening menu:', error);
      // Last resort: try toggle
      try {
        await this.menuController.toggle('main-menu');
      } catch (toggleError) {
        console.error('Toggle also failed:', toggleError);
      }
    }
  }
}
