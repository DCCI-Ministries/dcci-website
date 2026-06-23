import { Injectable, Injector, NgZone, runInInjectionContext } from '@angular/core';

import { Auth as FirebaseAuth } from '@angular/fire/auth';

import { Firestore,

  collection,

  deleteDoc,

  doc,

  getDoc,

  getDocs,

  onSnapshot,

  orderBy,

  query,

  serverTimestamp,

  setDoc

} from '@angular/fire/firestore';

import { BehaviorSubject, Observable } from 'rxjs';

import {

  DEFAULT_WELCOME_CONTENT,

  MAX_WELCOME_VERSIONS,

  mergeWelcomeContent,

  normalizeWelcomeLinks,

  WelcomePageContent,

  WelcomePageVersionSummary

} from '../models/welcome-content.model';



const PUBLISHED_DOC_PATH = 'siteSettings/welcome';

const DRAFT_DOC_PATH = 'adminSettings/welcomeDraft';

const VERSIONS_PARENT_DOC = 'adminSettings/welcomeVersions';

const VERSIONS_COLLECTION_PATH = `${VERSIONS_PARENT_DOC}/versions`;



@Injectable({

  providedIn: 'root'

})

export class WelcomeContentService {

  private contentSubject = new BehaviorSubject<WelcomePageContent>(DEFAULT_WELCOME_CONTENT);

  public content$: Observable<WelcomePageContent> = this.contentSubject.asObservable();



  private unsubscribe?: () => void;



  constructor(

    private firestore: Firestore,

    private auth: FirebaseAuth,

    private injector: Injector,

    private ngZone: NgZone

  ) {}



  /** Live public welcome page — listens to published content only. */

  initialize(): void {

    if (this.unsubscribe) {

      return;

    }



    runInInjectionContext(this.injector, () => {

      const contentRef = doc(this.firestore, PUBLISHED_DOC_PATH);



      this.unsubscribe = onSnapshot(

        contentRef,

        (snapshot) => {

          this.ngZone.run(() => {

            if (snapshot.exists()) {

              this.contentSubject.next(mergeWelcomeContent(snapshot.data() as Partial<WelcomePageContent>));

            } else {

              this.contentSubject.next(DEFAULT_WELCOME_CONTENT);

            }

          });

        },

        (error) => {

          console.error('Error loading welcome page content:', error);

          this.ngZone.run(() => {

            this.contentSubject.next(DEFAULT_WELCOME_CONTENT);

          });

        }

      );

    });

  }



  getCurrentContent(): WelcomePageContent {

    return this.contentSubject.value;

  }



  async loadPublishedContent(): Promise<WelcomePageContent> {

    return await this.loadDoc(PUBLISHED_DOC_PATH);

  }



  async loadDraftContent(): Promise<WelcomePageContent | null> {

    try {

      const snapshot = await this.firestoreOp(() =>

        getDoc(doc(this.firestore, DRAFT_DOC_PATH))

      );

      if (!snapshot.exists()) {

        return null;

      }

      return mergeWelcomeContent(snapshot.data() as Partial<WelcomePageContent>);

    } catch (error) {

      console.warn('Could not load welcome draft (check Firestore rules are deployed):', error);

      return null;

    }

  }



  /** Editor loads draft when present, otherwise the live published page. */

  async loadEditorContent(): Promise<{ content: WelcomePageContent; hasDraft: boolean }> {

    const published = await this.loadPublishedContent();

    const draft = await this.loadDraftContent();

    if (draft) {

      return { content: draft, hasDraft: true };

    }

    return { content: published, hasDraft: false };

  }



  async saveDraft(content: WelcomePageContent): Promise<void> {

    const currentUser = this.requireUser();

    const fields = this.buildContentFields(content);

    await this.firestoreOp(() =>

      setDoc(doc(this.firestore, DRAFT_DOC_PATH), {

        ...fields,

        updatedAt: serverTimestamp(),

        updatedBy: currentUser.uid

      }, { merge: true })

    );

  }



  async publishContent(content: WelcomePageContent): Promise<void> {

    const currentUser = this.requireUser();

    const fields = this.buildContentFields(content);



    const currentPublished = await this.firestoreOp(() =>

      getDoc(doc(this.firestore, PUBLISHED_DOC_PATH))

    );



    if (currentPublished.exists()) {

      await this.archiveSnapshot(

        currentPublished.data() as Partial<WelcomePageContent>,

        currentUser.uid,

        'Before publish'

      );

    } else {

      await this.archiveSnapshot(

        DEFAULT_WELCOME_CONTENT,

        currentUser.uid,

        'Before first publish (site defaults)'

      );

    }



    const payload = {

      ...fields,

      updatedAt: serverTimestamp(),

      updatedBy: currentUser.uid,

      publishedAt: serverTimestamp(),

      publishedBy: currentUser.uid

    };



    await this.firestoreOp(() =>

      setDoc(doc(this.firestore, PUBLISHED_DOC_PATH), payload, { merge: true })

    );

    await this.firestoreOp(() =>

      setDoc(doc(this.firestore, DRAFT_DOC_PATH), payload, { merge: true })

    );



    await this.pruneVersions();

  }



  async discardDraft(): Promise<void> {

    this.requireUser();

    await this.firestoreOp(() => deleteDoc(doc(this.firestore, DRAFT_DOC_PATH)));

  }



  async listVersions(): Promise<WelcomePageVersionSummary[]> {

    const snapshot = await this.firestoreOp(() => {

      const versionsRef = collection(this.firestore, VERSIONS_COLLECTION_PATH);

      const q = query(versionsRef, orderBy('archivedAt', 'desc'));

      return getDocs(q);

    });

    return snapshot.docs.map((versionDoc) => {

      const data = versionDoc.data();

      return {

        versionId: versionDoc.id,

        archivedAt: data['archivedAt'],

        archivedBy: data['archivedBy'] as string | undefined,

        label: data['label'] as string | undefined,

        displayTitle: data['displayTitle'] as string | undefined,

        displayDescription: data['displayDescription'] as string | undefined

      };

    });

  }



  async loadVersionContent(versionId: string): Promise<WelcomePageContent> {

    const snapshot = await this.firestoreOp(() =>

      getDoc(doc(this.firestore, VERSIONS_COLLECTION_PATH, versionId))

    );

    if (!snapshot.exists()) {

      throw new Error('Version not found');

    }

    return mergeWelcomeContent(snapshot.data() as Partial<WelcomePageContent>);

  }



  async deleteVersion(versionId: string): Promise<void> {

    this.requireUser();

    await this.firestoreOp(() =>

      deleteDoc(doc(this.firestore, VERSIONS_COLLECTION_PATH, versionId))

    );

  }



  async updateVersionMetadata(

    versionId: string,

    displayTitle: string,

    displayDescription: string

  ): Promise<void> {

    this.requireUser();

    await this.firestoreOp(() =>

      setDoc(

        doc(this.firestore, VERSIONS_COLLECTION_PATH, versionId),

        {

          displayTitle: displayTitle.trim(),

          displayDescription: displayDescription.trim()

        },

        { merge: true }

      )

    );

  }



  async restoreVersionToDraft(versionId: string): Promise<WelcomePageContent> {

    const content = await this.loadVersionContent(versionId);

    await this.saveDraft(content);

    return content;

  }



  async publishVersion(versionId: string): Promise<void> {

    const content = await this.loadVersionContent(versionId);

    await this.publishContent(content);

  }



  /** @deprecated Use publishContent — kept for any stale callers. */

  async saveWelcomeContent(content: WelcomePageContent): Promise<void> {

    await this.publishContent(content);

  }



  destroy(): void {

    if (this.unsubscribe) {

      this.unsubscribe();

      this.unsubscribe = undefined;

    }

  }



  private async loadDoc(path: string): Promise<WelcomePageContent> {

    const snapshot = await this.firestoreOp(() => getDoc(doc(this.firestore, path)));

    if (snapshot.exists()) {

      return mergeWelcomeContent(snapshot.data() as Partial<WelcomePageContent>);

    }

    return DEFAULT_WELCOME_CONTENT;

  }



  /**

   * One Firebase call per invocation — injection context is not preserved across await

   * inside a single runInInjectionContext callback.

   */

  private firestoreOp<T>(operation: () => Promise<T>): Promise<T> {

    return this.ngZone.run(() => runInInjectionContext(this.injector, operation));

  }



  /** Plain content fields only — timestamps must be set inside firestoreOp(). */

  private buildContentFields(content: WelcomePageContent) {

    return {

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

      seoDescription: content.seoDescription

    };

  }



  private async archiveSnapshot(

    data: Partial<WelcomePageContent>,

    userId: string,

    label: string

  ): Promise<void> {

    const versionId = Date.now().toString();

    const fields = this.buildContentFields(mergeWelcomeContent(data));

    await this.firestoreOp(() =>

      setDoc(doc(this.firestore, VERSIONS_PARENT_DOC), { initialized: true }, { merge: true })

    );

    await this.firestoreOp(() =>

      setDoc(doc(this.firestore, VERSIONS_COLLECTION_PATH, versionId), {

        ...fields,

        versionId,

        updatedAt: serverTimestamp(),

        updatedBy: userId,

        archivedAt: serverTimestamp(),

        archivedBy: userId,

        label

      })

    );

  }



  private async pruneVersions(): Promise<void> {

    const snapshot = await this.firestoreOp(() => {

      const versionsRef = collection(this.firestore, VERSIONS_COLLECTION_PATH);

      const q = query(versionsRef, orderBy('archivedAt', 'desc'));

      return getDocs(q);

    });

    const excess = snapshot.docs.slice(MAX_WELCOME_VERSIONS);

    for (const versionDoc of excess) {

      await this.firestoreOp(() => deleteDoc(versionDoc.ref));

    }

  }



  private requireUser() {

    const currentUser = this.auth.currentUser;

    if (!currentUser) {

      throw new Error('Not authenticated');

    }

    return currentUser;

  }

}


