/**
 * Welcome page content defaults and Firestore fetch for Astro build time.
 * Keep in sync with src/app/models/welcome-content.model.ts
 */

export interface WelcomePageContent {
  headerTagline: string;
  heroTitle: string;
  heroSubtitle: string;
  missionHeading: string;
  missionContent: string;
  socialHeading: string;
  socialContent: string;
  supportHeading: string;
  supportContent: string;
  testimonyStatement: string;
  testimonyVerse: string;
  seoTitle: string;
  seoDescription: string;
}

export const DEFAULT_WELCOME_CONTENT: WelcomePageContent = {
  headerTagline: 'Defend Christ Critique Islam',
  heroTitle: 'Welcome to DCCI Ministries',
  heroSubtitle: 'Proclaiming Jesus Christ where truth is costly.',
  missionHeading: 'Our Mission',
  missionContent:
    '<p>Our motivation is love for Muslims to bring them to repentance and faith in Christ for eternal life. We seek to preach the Gospel to Muslims using apologetics and polemics, regularly engaging with Muslims at Speakers Corner.</p>' +
    '<p>Like the Apostle Paul, "we do not use deception, nor do we distort the Word of God" (2 Cor 4:2). Rather "we demolish arguments and every pretension that sets itself up against the knowledge of God."</p>',
  socialHeading: 'Stay Connected',
  socialContent: '<p>Follow us on social media for ministry updates and announcements.</p>',
  supportHeading: 'Support This Ministry',
  supportContent:
    '<p>Your generosity helps us continue proclaiming the Gospel and supporting those who are seeking truth.</p>',
  testimonyStatement: 'Jesus is LORD',
  testimonyVerse:
    'John 20:31 but these are written so that you may believe that Jesus is the Christ, the Son of God, and that by believing you may have life in his name',
  seoTitle: 'DCCI Ministries - Defend Christ, Critique Islam',
  seoDescription:
    'Proclaiming Jesus Christ where truth is costly. DCCI Ministries engages with Islam through apologetics and polemics, preaching the Gospel with love and truth.'
};

export function mergeWelcomeContent(data: Partial<WelcomePageContent> | null | undefined): WelcomePageContent {
  return {
    ...DEFAULT_WELCOME_CONTENT,
    ...(data || {})
  };
}
