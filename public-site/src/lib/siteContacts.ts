import siteContactsJson from '../../../config/site-contacts.json';

export interface SiteContacts {
  technicalAdminEmail: string;
  ministryInfoEmail: string;
  contactFormRecipientEmail: string;
  /** Previous maintainer for private dev questions — not shown on public pages. */
  technicalSuccessionContactEmail: string;
}

export const SITE_CONTACTS: SiteContacts = siteContactsJson;
