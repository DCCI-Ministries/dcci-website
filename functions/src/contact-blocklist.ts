import blocklistJson = require('./config/contact-blocklist.json');

export interface ContactBlocklist {
  blockedEmails: string[];
  blockedIps: string[];
}

export const CONTACT_BLOCKLIST: ContactBlocklist = blocklistJson;
