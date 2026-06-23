/**
 * Welcome page content defaults and merge helper for Astro build time.
 * Keep in sync with src/app/models/welcome-content.model.ts
 */

export const DEFAULT_LOGO_IMAGE_URL = '/assets/icon/icon-no-text.webp';
export const DEFAULT_HERO_IMAGE_URL = '/assets/icon/hero.webp';

export interface WelcomePageLink {
  label: string;
  url: string;
  icon?: string;
}

export const DEFAULT_SOCIAL_LINKS: WelcomePageLink[] = [
  { label: 'YouTube', url: 'https://www.youtube.com/@DCCIMinistries', icon: 'logo-youtube' },
  { label: 'Rumble', url: 'https://rumble.com/user/DCCIMinistries', icon: 'play-circle-outline' },
  { label: 'X', url: 'https://twitter.com/dcciministries', icon: 'close-outline' }
];

export const DEFAULT_SUPPORT_LINKS: WelcomePageLink[] = [
  { label: 'PayPal', url: 'https://paypal.me/dcciministries2019?locale.x=en_GB', icon: 'card-outline' },
  { label: 'Patreon', url: 'https://patreon.com/HatunTash', icon: 'heart-outline' },
  { label: 'CashApp', url: 'https://cash.app/$HatunTashDCCI', icon: 'wallet-outline' }
];

export interface WelcomePageContent {
  headerTagline: string;
  heroTitle: string;
  heroSubtitle: string;
  logoImageUrl: string;
  heroImageUrl: string;
  missionHeading: string;
  missionContent: string;
  socialHeading: string;
  socialContent: string;
  socialLinks: WelcomePageLink[];
  supportHeading: string;
  supportContent: string;
  supportLinks: WelcomePageLink[];
  testimonyStatement: string;
  testimonyVerse: string;
  seoTitle: string;
  seoDescription: string;
}

export const DEFAULT_WELCOME_CONTENT: WelcomePageContent = {
  headerTagline: 'Defend Christ Critique Islam',
  heroTitle: 'Welcome to DCCI Ministries',
  heroSubtitle: 'Proclaiming Jesus Christ where truth is costly.',
  logoImageUrl: DEFAULT_LOGO_IMAGE_URL,
  heroImageUrl: DEFAULT_HERO_IMAGE_URL,
  missionHeading: 'Our Mission',
  missionContent:
    '<p>Our motivation is love for Muslims to bring them to repentance and faith in Christ for eternal life. We seek to preach the Gospel to Muslims using apologetics and polemics, regularly engaging with Muslims at Speakers Corner.</p>' +
    '<p>Like the Apostle Paul, "we do not use deception, nor do we distort the Word of God" (2 Cor 4:2). Rather "we demolish arguments and every pretension that sets itself up against the knowledge of God."</p>',
  socialHeading: 'Stay Connected',
  socialContent: '<p>Follow us on social media for ministry updates and announcements.</p>',
  socialLinks: DEFAULT_SOCIAL_LINKS.map((link) => ({ ...link })),
  supportHeading: 'Support This Ministry',
  supportContent:
    '<p>Your generosity helps us continue proclaiming the Gospel and supporting those who are seeking truth.</p>',
  supportLinks: DEFAULT_SUPPORT_LINKS.map((link) => ({ ...link })),
  testimonyStatement: 'Jesus is LORD',
  testimonyVerse:
    'John 20:31 but these are written so that you may believe that Jesus is the Christ, the Son of God, and that by believing you may have life in his name',
  seoTitle: 'DCCI Ministries - Defend Christ, Critique Islam',
  seoDescription:
    'Proclaiming Jesus Christ where truth is costly. DCCI Ministries engages with Islam through apologetics and polemics, preaching the Gospel with love and truth.'
};

type LegacyWelcomeData = Partial<WelcomePageContent> & {
  youtubeUrl?: string;
  rumbleUrl?: string;
  xUrl?: string;
  paypalUrl?: string;
  patreonUrl?: string;
  cashAppUrl?: string;
};

function normalizeWelcomeLink(link: WelcomePageLink): WelcomePageLink {
  return {
    label: (link.label || '').trim(),
    url: (link.url || '').trim(),
    icon: link.icon || 'link-outline'
  };
}

function normalizeWelcomeLinks(links: WelcomePageLink[] | undefined): WelcomePageLink[] {
  return (links || []).map(normalizeWelcomeLink).filter((link) => link.url.length > 0);
}

function cloneDefaultLinks(links: WelcomePageLink[]): WelcomePageLink[] {
  return links.map((link) => ({ ...link }));
}

function migrateLegacySocialLinks(data: LegacyWelcomeData): WelcomePageLink[] | null {
  const legacy: WelcomePageLink[] = [];
  if (data.youtubeUrl?.trim()) {
    legacy.push({ label: 'YouTube', url: data.youtubeUrl.trim(), icon: 'logo-youtube' });
  }
  if (data.rumbleUrl?.trim()) {
    legacy.push({ label: 'Rumble', url: data.rumbleUrl.trim(), icon: 'play-circle-outline' });
  }
  if (data.xUrl?.trim()) {
    legacy.push({ label: 'X', url: data.xUrl.trim(), icon: 'close-outline' });
  }
  return legacy.length > 0 ? legacy : null;
}

function migrateLegacySupportLinks(data: LegacyWelcomeData): WelcomePageLink[] | null {
  const legacy: WelcomePageLink[] = [];
  if (data.paypalUrl?.trim()) {
    legacy.push({ label: 'PayPal', url: data.paypalUrl.trim(), icon: 'card-outline' });
  }
  if (data.patreonUrl?.trim()) {
    legacy.push({ label: 'Patreon', url: data.patreonUrl.trim(), icon: 'heart-outline' });
  }
  if (data.cashAppUrl?.trim()) {
    legacy.push({ label: 'CashApp', url: data.cashAppUrl.trim(), icon: 'wallet-outline' });
  }
  return legacy.length > 0 ? legacy : null;
}

function resolveSocialLinks(data: LegacyWelcomeData): WelcomePageLink[] {
  const fromArray = normalizeWelcomeLinks(data.socialLinks);
  if (fromArray.length > 0) {
    return fromArray;
  }
  const migrated = migrateLegacySocialLinks(data);
  if (migrated) {
    return migrated;
  }
  return cloneDefaultLinks(DEFAULT_SOCIAL_LINKS);
}

function resolveSupportLinks(data: LegacyWelcomeData): WelcomePageLink[] {
  const fromArray = normalizeWelcomeLinks(data.supportLinks);
  if (fromArray.length > 0) {
    return fromArray;
  }
  const migrated = migrateLegacySupportLinks(data);
  if (migrated) {
    return migrated;
  }
  return cloneDefaultLinks(DEFAULT_SUPPORT_LINKS);
}

export function mergeWelcomeContent(data: Partial<WelcomePageContent> | null | undefined): WelcomePageContent {
  const source = (data || {}) as LegacyWelcomeData;
  const merged: WelcomePageContent = {
    ...DEFAULT_WELCOME_CONTENT,
    ...source,
    socialLinks: resolveSocialLinks(source),
    supportLinks: resolveSupportLinks(source)
  };

  if (!merged.logoImageUrl) {
    merged.logoImageUrl = DEFAULT_LOGO_IMAGE_URL;
  }
  if (!merged.heroImageUrl) {
    merged.heroImageUrl = DEFAULT_HERO_IMAGE_URL;
  }

  return merged;
}
