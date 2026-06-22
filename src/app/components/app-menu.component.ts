import { Component, ViewChild, AfterViewInit, OnDestroy, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonMenu, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonButtons, IonButton } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { MenuController } from '@ionic/angular/standalone';

@Component({
  selector: 'app-menu',
  templateUrl: './app-menu.component.html',
  styleUrls: ['./app-menu.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonMenu,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonIcon
  ]
})
export class AppMenuComponent implements AfterViewInit, OnDestroy {
  @ViewChild(IonMenu) menu!: IonMenu;
  @ViewChild('closeButton', { read: ElementRef }) closeButtonRef!: ElementRef<HTMLIonButtonElement>;
  @ViewChild('firstMenuItem', { read: ElementRef }) firstMenuItemRef!: ElementRef<HTMLElement>;
  private escapeKeyHandler?: (event: KeyboardEvent) => void;

  constructor(
    private router: Router,
    private menuController: MenuController
  ) {}

  async ngAfterViewInit() {
    // Enable the menu after view is initialized
    try {
      await this.menuController.enable(true, 'main-menu');
      console.log('Menu enabled in AppMenuComponent');

      // Add document-level Escape key listener for accessibility
      this.escapeKeyHandler = async (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          const isOpen = await this.menuController.isOpen('main-menu');
          if (isOpen) {
            await this.closeMenu();
            event.preventDefault();
            event.stopPropagation();
          }
        }
      };
      document.addEventListener('keydown', this.escapeKeyHandler);
    } catch (error) {
      console.error('Error enabling menu:', error);
    }
  }

  ngOnDestroy() {
    // Clean up escape key listener
    if (this.escapeKeyHandler) {
      document.removeEventListener('keydown', this.escapeKeyHandler);
    }
  }

  onMenuWillOpen() {
    // Blur any focused elements in the main content before menu opens
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
  }

  onMenuOpen() {
    // Focus the close button when menu opens (accessibility best practice)
    setTimeout(() => {
      if (this.closeButtonRef?.nativeElement) {
        const button = this.closeButtonRef.nativeElement.querySelector('button');
        if (button) {
          (button as HTMLElement).focus();
        }
      }
    }, 150);
  }

  onMenuClose() {
    // Return focus to the menu trigger button when menu closes (accessibility best practice)
    setTimeout(() => {
      const menuButton = document.querySelector('ion-button.menu-button') as HTMLElement;
      if (menuButton) {
        const button = menuButton.shadowRoot?.querySelector('button') as HTMLElement;
        if (button) {
          button.focus();
        }
      }
    }, 100);
  }

  async closeMenu() {
    await this.menuController.close('main-menu');
  }

  async open() {
    try {
      if (this.menu) {
        await this.menu.setOpen(true);
      } else {
        await this.menuController.open('main-menu');
      }
    } catch (error) {
      console.error('Error in menu.open():', error);
    }
  }

  async navigateToWelcome() {
    await this.closeMenu();
    this.router.navigate(['/home']);
  }

  async navigateToArticles() {
    await this.closeMenu();
    this.router.navigate(['/articles']);
  }

  async navigateToArchives() {
    await this.closeMenu();
    this.router.navigate(['/archives']);
  }

  async navigateToSupport() {
    await this.closeMenu();
    const currentUrl = this.router.url;
    if (currentUrl === '/welcome' || currentUrl === '/home') {
      // Already on main page, scroll to section if it exists (welcome has it; home/under-construction may not)
      setTimeout(() => this.scrollToSection('support-section'), 100);
    } else {
      // Navigate to home (under construction), then scroll after navigation if section exists
      await this.router.navigate(['/home']);
      setTimeout(() => this.scrollToSection('support-section'), 300);
    }
  }

  async navigateToContact() {
    await this.closeMenu();
    const currentUrl = this.router.url;
    if (currentUrl === '/welcome' || currentUrl === '/home') {
      // Already on main page, scroll to section if it exists
      setTimeout(() => this.scrollToSection('contact-form'), 100);
    } else {
      // Navigate to home (under construction), then scroll after navigation if section exists
      await this.router.navigate(['/home']);
      setTimeout(() => this.scrollToSection('contact-form'), 300);
    }
  }

  private scrollToSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

