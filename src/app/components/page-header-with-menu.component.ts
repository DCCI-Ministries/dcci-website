import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { MenuController } from '@ionic/angular/standalone';
import { ScrollService } from '../services/scroll.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-page-header-with-menu',
  templateUrl: './page-header-with-menu.component.html',
  styleUrls: ['./page-header-with-menu.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, IonButton, IonIcon]
})
export class PageHeaderWithMenuComponent implements OnInit, OnDestroy {
  isScrolled = false;
  private scrollSubscription?: Subscription;

  constructor(
    private menuController: MenuController,
    private scrollService: ScrollService
  ) {}

  ngOnInit() {
    // Subscribe to scroll state changes
    this.scrollSubscription = this.scrollService.getScrollState().subscribe(
      isScrolled => {
        this.isScrolled = isScrolled;
      }
    );
  }

  ngOnDestroy() {
    if (this.scrollSubscription) {
      this.scrollSubscription.unsubscribe();
    }
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

