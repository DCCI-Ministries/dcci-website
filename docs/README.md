# DCCI Ministries Website Documentation

This directory contains comprehensive documentation for the DCCI Ministries website project, covering technical architecture, development setup, content management, and operational procedures.

## 📚 Documentation Structure

### 🚀 **For Developers**
- **[Project Overview](./project-overview.md)** - Project mission, scope, and development phases
- **[Technical Architecture](./technical-architecture.md)** - System design, technology stack, and architecture patterns
- **[Development Setup](./development-setup.md)** - Step-by-step development environment setup
- **[Technical Contact Handoff](./technical-contact-handoff.md)** - **Replace the website/technical email safely** (UK/EU contact requirements; do not change ministry inboxes)
- **[Breaking Changes & Gotchas](./breaking-changes-gotchas.md)** - Critical breaking changes and common issues to watch for
- **[Future-Proofing for Node 22+](./future-proofing-node22.md)** - Long-term maintenance and Node 22+ compatibility
- **[Project Handoff](./project-handoff.md)** - Essential information for new developers taking over the project

### 👥 **For Content Owners & Non-Technical Users**
- **[Owner's Guide](./owners-guide.md)** - Non-technical guide for ministry owners and content managers
- **[Content Management](./content-management.md)** - How to create, edit, and manage website content
- **[Emergency Procedures](./emergency-procedures.md)** - Step-by-step procedures for critical situations

### 🛠️ **For Operations & Maintenance**
- **[Troubleshooting](./troubleshooting.md)** - Common issues and their solutions
- **[Emergency Procedures](./emergency-procedures.md)** - Critical incident response procedures
- **[Admin Access and Email Guard](./admin-access-and-email-guard.md)** - How Firestore admin status and the email allowlist work together; why admins must be added to the guard to access User Management and other guard-gated features

### 📧 **Contact Form & Email**
- **[Contact form — recovery & independence plan](./contact-form-recovery-and-independence-plan.md)** — **URGENT:** recover Firestore messages, fix Hatun delivery, remove dependency on developer email
- **[Meeting agenda — Hatun `info@` email setup](./meeting-agenda-hatun-email-setup.md)** — Cloudflare or Google forwarding, replies from `info@`, Firebase SMTP (live session checklist)
- **[Technical Contact Handoff](./technical-contact-handoff.md)** - Change `technicalAdminEmail` when a new developer maintains the site (EU/UK technical contact)
- **[Contact Form Setup](../CONTACT_FORM_SETUP.md)** (project root) - Technical setup, security layers, deployment
- **[Contact Form — Privacy and Reporting](./contact-form-privacy-and-reporting.md)** - Why no reCAPTCHA or VPN blocking; privacy tradeoffs; **Hatun reporting guide** for the site manager

### 🏠 **Welcome Page (Admin-Editable)**
- Documented in **[Content Management — Editing the Welcome Page](./content-management.md#editing-the-welcome-page)** — admin-editable welcome page sections with Quill, Firestore storage, and Astro SEO rebuild

## 🎯 **Quick Start for Developers**

1. **Read [Project Overview](./project-overview.md)** to understand the project scope
2. **Follow [Development Setup](./development-setup.md)** to get your environment ready
3. **Review [Breaking Changes & Gotchas](./breaking-changes-gotchas.md)** to avoid common pitfalls
4. **Check [Future-Proofing Guide](./future-proofing-node22.md)** for long-term maintenance
5. **Check [Technical Architecture](./technical-architecture.md)** for system design details

## 🚨 **Critical Information**

- **Node Version**: Use Node 20.x (see `.nvmrc` file)
- **Icon Loading**: Requires `setAssetPath(document.baseURI)` and SVG asset copying
- **Firebase**: Use ESM imports, not require() syntax
- **Cursor AI**: Be specific about what you want and what not to do

## 📖 **Documentation Standards**

- All technical procedures include step-by-step instructions
- Code examples are provided where relevant
- Troubleshooting sections include diagnostic steps
- Emergency procedures are clearly marked and prioritized

## 🔄 **Keeping Documentation Updated**

- Update relevant docs when making architectural changes
- Add new gotchas to the breaking changes document
- Keep emergency procedures current with actual system configuration
- Document any workarounds or temporary fixes implemented

---

*For questions about this documentation or the project, refer to the [Project Handoff](./project-handoff.md) document for contact information.* 
