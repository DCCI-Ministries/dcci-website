import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { Auth as FirebaseAuth } from '@angular/fire/auth';
import { Firestore, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  DEFAULT_WELCOME_CONTENT,
  mergeWelcomeContent,
  normalizeWelcomeLinks,
  WelcomePageContent
} from '../models/welcome-content.model';

@Injectable({
  providedIn: 'root'
})
export class WelcomeContentService {
  private readonly DOC_PATH = 'siteSettings/welcome';

  private contentSubject = new BehaviorSubject<WelcomePageContent>(DEFAULT_WELCOME_CONTENT);
  public content$: Observable<WelcomePageContent> = this.contentSubject.asObservable();

  private unsubscribe?: () => void;

  constructor(
    private firestore: Firestore,
    private auth: FirebaseAuth,
    private injector: Injector
  ) {}

  initialize(): void {
    if (this.unsubscribe) {
      return;
    }

    runInInjectionContext(this.injector, () => {
      const contentRef = doc(this.firestore, this.DOC_PATH);

      this.unsubscribe = onSnapshot(
        contentRef,
        (snapshot) => {
          if (snapshot.exists()) {
            this.contentSubject.next(mergeWelcomeContent(snapshot.data() as Partial<WelcomePageContent>));
          } else {
            this.contentSubject.next(DEFAULT_WELCOME_CONTENT);
          }
        },
        (error) => {
          console.error('Error loading welcome page content:', error);
          this.contentSubject.next(DEFAULT_WELCOME_CONTENT);
        }
      );
    });
  }

  getCurrentContent(): WelcomePageContent {
    return this.contentSubject.value;
  }

  async loadWelcomeContent(): Promise<WelcomePageContent> {
    return await runInInjectionContext(this.injector, async () => {
      const contentRef = doc(this.firestore, this.DOC_PATH);
      const snapshot = await getDoc(contentRef);
      if (snapshot.exists()) {
        return mergeWelcomeContent(snapshot.data() as Partial<WelcomePageContent>);
      }
      return DEFAULT_WELCOME_CONTENT;
    });
  }

  async saveWelcomeContent(content: WelcomePageContent): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }

    await runInInjectionContext(this.injector, async () => {
      const contentRef = doc(this.firestore, this.DOC_PATH);
      const payload: WelcomePageContent = {
        headerTagline: content.headerTagline,
        heroTitle: content.heroTitle,
        heroSubtitle: content.heroSubtitle,
        logoImageUrl: content.logoImageUrl,
        heroImageUrl: content.heroImageUrl,
        missionHeading: content.missionHeading,
        missionContent: content.missionContent,
        socialHeading: content.socialHeading,
        socialContent: content.socialContent,
        socialLinks: normalizeWelcomeLinks(content.socialLinks),
        supportHeading: content.supportHeading,
        supportContent: content.supportContent,
        supportLinks: normalizeWelcomeLinks(content.supportLinks),
        testimonyStatement: content.testimonyStatement,
        testimonyVerse: content.testimonyVerse,
        seoTitle: content.seoTitle,
        seoDescription: content.seoDescription,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid
      };

      await setDoc(contentRef, payload, { merge: true });
    });
  }

  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }
}
