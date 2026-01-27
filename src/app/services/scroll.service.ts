import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { IonContent } from '@ionic/angular/standalone';

@Injectable({
  providedIn: 'root'
})
export class ScrollService {
  private scrollState$ = new BehaviorSubject<boolean>(false);
  private scrollElements: Set<HTMLElement> = new Set();
  private scrollHandlers: Map<HTMLElement, () => void> = new Map();
  private debounceTimers: Map<HTMLElement, any> = new Map();
  private currentState = false;

  getScrollState(): Observable<boolean> {
    return this.scrollState$.asObservable();
  }

  async registerScrollContainer(content: IonContent): Promise<void> {
    try {
      const scrollElement = await content.getScrollElement();

      // Don't register the same element twice
      if (this.scrollElements.has(scrollElement)) {
        return;
      }

      this.scrollElements.add(scrollElement);

      const handleScroll = () => {
        const scrollTop = scrollElement.scrollTop || 0;
        const newState = scrollTop > 100;

        // Clear any existing debounce timer for this element
        const existingTimer = this.debounceTimers.get(scrollElement);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        // Only update if state actually changed
        if (newState !== this.currentState) {
          // Debounce the state update to prevent rapid toggling
          const timer = setTimeout(() => {
            // Double-check the state hasn't changed during the debounce period
            const currentScrollTop = scrollElement.scrollTop || 0;
            const finalState = currentScrollTop > 100;
            if (finalState !== this.currentState) {
              this.currentState = finalState;
              this.scrollState$.next(finalState);
            }
            this.debounceTimers.delete(scrollElement);
          }, 50); // 50ms debounce to prevent rapid state changes

          this.debounceTimers.set(scrollElement, timer);
        }
      };

      scrollElement.addEventListener('scroll', handleScroll, { passive: true });
      this.scrollHandlers.set(scrollElement, handleScroll);

      // Check initial scroll position
      const initialScrollTop = scrollElement.scrollTop || 0;
      this.currentState = initialScrollTop > 100;
      this.scrollState$.next(this.currentState);
    } catch (error) {
      console.error('Error registering scroll container:', error);
    }
  }

  unregisterScrollContainer(content: IonContent): void {
    // Clean up debounce timers when unregistering
    content.getScrollElement().then(scrollElement => {
      const timer = this.debounceTimers.get(scrollElement);
      if (timer) {
        clearTimeout(timer);
        this.debounceTimers.delete(scrollElement);
      }
    }).catch(() => {
      // Ignore errors during cleanup
    });
  }

  checkScrollState(): void {
    // Check all registered scroll elements
    let foundScrolled = false;
    this.scrollElements.forEach(scrollElement => {
      const scrollTop = scrollElement.scrollTop || 0;
      if (scrollTop > 100) {
        foundScrolled = true;
      }
    });

    // Only update if state changed
    if (foundScrolled !== this.currentState) {
      this.currentState = foundScrolled;
      this.scrollState$.next(foundScrolled);
    }
  }
}
