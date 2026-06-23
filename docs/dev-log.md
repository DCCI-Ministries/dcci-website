# Dev Log

## 2026-06-21

### Welcome Page — Admin-Editable Content (SEO-Safe)
- **New admin screen:** Dashboard → **Welcome Page** (`/admin/welcome-settings`), full admins only
- **Editable sections:** Header tagline, hero title/subtitle, mission, social blurb, support blurb, testimony, and SEO title/description
- **Editors:** Quill rich-text for body sections; plain fields for headings and short text
- **Storage:** Firestore `siteSettings/welcome` (public read for live page; full-admin write)
- **Live site:** Angular welcome page loads content in real time; layout and styling unchanged
- **SEO:** Astro `public-site/src/pages/welcome/index.astro` reads the same data at build time
- **Auto-rebuild:** Cloud Function `onWelcomePageUpdate` triggers Astro redeploy when welcome content changes
- **Files added:**
  - `src/app/models/welcome-content.model.ts`
  - `src/app/services/welcome-content.service.ts`
  - `src/app/admin/welcome-settings/*`
  - `public-site/src/lib/welcomeContent.ts`

### Contact Form — Direct Delivery, Privacy, and High Security
- **Email routing:** Contact form emails go **directly** to the configured ministry inbox (now from `config/site-contacts.json`)
- **Removed:** Admin/monitor inbox shield (`mail.to` no longer used for contact form)
- **Firestore privacy:** Message content (name, email, subject, body) is **not** stored. Each successful send logs only:
  - `submittedAt`
  - `newsletterOptIn` (boolean)
- **Dashboard:** Messages count uses `contacts` collection size; Recent Activity shows “Contact form submission received” (no sender names)
- **Website problem reports** still email the configured technical admin inbox

#### Contact form security layers (legit-user friendly)
- **Removed** blanket VPN IP blocking (legitimate VPN users can submit)
- **Added** disposable/throwaway email domain blocking
- **Added** link rules: max 3 links per message; URL shorteners blocked (bit.ly, tinyurl, etc.)
- **Added** per-email rate limit: 3 submissions per 24 hours
- **Kept** 5-minute per-IP cooldown (recorded only after successful send)
- **Reduced** minimum form fill time from 10s to 8s
- **Added** Firebase App Check wiring (invisible reCAPTCHA v3) — optional until site key + `security.enforce_app_check` are configured
- **New Firestore collections (metadata only):** `contactRateLimits`, `contactEmailRateLimits`
- **Files:** `functions/src/contact-security.ts`, `functions/src/sanitization.ts`, `src/app/services/contact.service.ts`, `src/main.ts`

#### Documentation note
- Privacy pages previously listed “reCAPTCHA” as active spam protection; it was **documented ahead of implementation**. App Check + reCAPTCHA v3 code exists as of this date but requires Firebase Console setup and `appCheckRecaptchaSiteKey` in production environment files.

#### Privacy policy and reporting documentation (same day, follow-up)
- **Updated** public privacy policy (Angular `src/app/privacy/privacy.page.html` + Astro `public-site/src/pages/privacy.astro`):
  - New section: contact form, spam protection, and global access (no reCAPTCHA, no VPN blocking, no full message storage in DB)
  - Accurate third-party / retention wording for contact form
- **New** [docs/contact-form-privacy-and-reporting.md](./contact-form-privacy-and-reporting.md) — privacy tradeoffs, why no reCAPTCHA/VPN blocking, Hatun reporting guide for site manager
- **Updated** [owners-guide.md](./owners-guide.md) — Hatun training summary, privacy bind explained
- **Updated** [CONTACT_FORM_SETUP.md](../CONTACT_FORM_SETUP.md) — design philosophy section
- **New** [technical-contact-handoff.md](./technical-contact-handoff.md) — safe developer handoff for `technicalAdminEmail` (UK/EU technical contact)
- **Updated** [config/README.md](../config/README.md) — links handoff guide; clarifies three email roles
- **Deprecated** [IP_BLOCKING_SETUP.md](../IP_BLOCKING_SETUP.md)
- **Removed** obsolete VPN error handling from `contact-form.component.ts`

---

## 2025-01-XX (Recent Updates)

### Admin Content Creation - Thumbnail Upload Security
- **Enhanced Image Upload Validation**:
  - Implemented strict file type validation allowing only safe static image formats:
    - Allowed: JPEG, PNG, WebP, BMP, TIFF, AVIF, HEIC, HEIF
    - Explicitly blocked: GIF, SVG, AVI, video files, audio files, and other non-image formats
  - Added comprehensive security checks:
    - MIME type validation (both client and server-side)
    - File extension validation (additional security layer)
    - Double extension detection (prevents `image.jpg.exe` attacks)
    - File size limit: 5MB maximum
    - Image dimension validation: maximum 4000x4000 pixels
  - Updated Firebase Storage rules to enforce strict image type validation server-side
  - Added WebP conversion suggestion with link to [ToWebP.io](https://towebp.io/) for better compression
- **Files Modified**:
  - `src/app/admin/content/create-content/create-content.page.ts` - Added `validateThumbnailFile()` and `validateImageDimensions()` functions
  - `src/app/admin/content/create-content/create-content.page.html` - Updated accept attribute and added WebP suggestion
  - `storage.rules` - Enhanced validation for thumbnails and content images

### Admin Routing - Hard Refresh Fix
- **Fixed Hard Refresh Redirect Issue**:
  - Resolved regression where hard refresh on `/admin/*` routes redirected to homepage
  - Updated admin guards to wait for Firebase Auth initialization before making routing decisions
  - Changed guards to return `UrlTree` instead of using imperative `router.navigate()` calls
  - Implemented proper async auth state checking using `onAuthStateChanged` wrapped in RxJS `defer`
  - Added timeout handling for AuthService user data loading (3-second fallback)
- **Files Modified**:
  - `src/app/guards/admin-guard.ts` - Complete refactor to use UrlTree returns and wait for auth
  - `src/app/guards/admin-only-guard.ts` - Complete refactor to use UrlTree returns and wait for auth
- **Behavior Preserved**:
  - Admin users can now hard refresh `/admin/dashboard` and stay on the page
  - Non-admin users still redirect to appropriate pages (`/home` or `/admin/dashboard`)
  - Nuclear lockdown redirects still work correctly
  - All existing redirect destinations maintained

### YouTube Sync - Removed Video Detection
- **Enhanced YouTube Sync Function**:
  - Added functionality to detect and remove articles for deleted YouTube videos
  - Collects all video IDs from uploads playlist (up to 500 videos)
  - Checks all existing YouTube articles in Firestore
  - Verifies video existence via YouTube API before deletion
  - Automatically deletes articles when:
    - Video is not in the uploads playlist, OR
    - Video doesn't exist in YouTube API, OR
    - Video is private/unlisted
  - Handles livestreams that get removed and replaced with new videos
- **Files Modified**:
  - `functions/src/index.ts` - Enhanced `syncYouTubeUploads` function with removal detection
- **Logging**:
  - Added `deletedCount` tracking
  - Enhanced console logging for removal operations

---

## 2025-11-29

### Admin Dashboard Enhancements
- `DashboardPage` now loads live stats:
  - Counts admin users directly from Firestore.
  - Pulls contact + newsletter totals via `getContactStats`.
  - Displays real site views using the `stats/siteStats.totalUniqueVisitors` aggregate.
  - Shows Firebase Storage usage (GB used, percent of free tier) using the new `getStorageUsage` Cloud Function.
- Updated dashboard UI to show storage numbers and added warnings when usage exceeds 80%.

### Visitor Analytics
- Added `trackPageView` Cloud Function with basic bot filtering and daily fingerprint deduping.
- Created `AnalyticsService` and wired `/home` + `/welcome` pages to call it on load.
- Firestore security rules now allow admins to list `adminUsers`, and protect the new `pageViews`/`stats` collections.

### Firebase Functions Platform Work
- Upgraded Cloud Functions runtime to Node 20 and bumped `firebase-admin`, `firebase-functions`, and `typescript`.
- Deployed all existing functions (`submitContactForm`, `subscribeToNewsletter`, etc.) on the new runtime.
- Added `getStorageUsage` (sums bucket usage against the 1 GB free allowance) with bucket-name fallback for `.appspot.com`.

### Deployment / Tooling Notes
- `npm run vd` now works on Node 20.x; failure earlier was due to running Node 22 locally.
- Functions + Firestore rules redeployed after each backend change (`trackPageView`, `getStorageUsage`, rules updates).
- Admin dashboard relies on HTTPS Functions URLs from `environment.firebaseFunctionsUrl`; ensure this stays current when environments change.

---

## 2025-12-XX (Recent Update)

### Admin Dashboard UI Updates
- **Quick Actions Button Reorganization**:
  - Renamed "Site Settings" to "Youtube Settings" and replaced settings icon with YouTube icon (`logo-youtube`)
  - Added new "Comments Settings" button with chat bubbles icon (`chatbubbles-outline`) for managing comment-related settings
  - Renamed "Manage Users" to "User Management" for better consistency
  - Renamed "Site Settings" (previously "View Messages" button) to "Site Management"
- **Icons Registration**:
  - Added `chatbubbles-outline` icon to `src/app/icons.ts` for the Comments Settings button
- **UI Improvements**:
  - Improved button labeling consistency (all use "Management" or "Settings" suffix pattern)
  - Better icon alignment with functionality (YouTube icon for YouTube-related features)

### Current Quick Actions Menu Structure
1. Create Content
2. Manage Content
3. Youtube Settings (YouTube icon)
4. Comments Settings (Chat bubbles icon)
5. User Management
6. Site Management

### Next Steps / TODO
- [ ] Implement routing/functionality for "Youtube Settings" button
- [ ] Implement routing/functionality for "Comments Settings" button
- [ ] Implement routing/functionality for "User Management" button (if not already implemented)
- [ ] Implement routing/functionality for "Site Management" button (if not already implemented)
- [ ] Continue with Content Creation System Implementation (see below)

---

## Next Session: Content Creation System Implementation

### Overview
Implement a full-featured content creation interface using Quill 2.0.3 (already installed) for rich text editing with support for images, links, embedded videos, and more. This will be a large update, so we'll implement it step-by-step.

### Current Status
- ✅ **Quill 2.0.3** and **ngx-quill 28.0.1** already installed in `package.json`
- ✅ Quill CSS already imported in `global.scss`
- ✅ Documentation exists in `docs/content-management.md` (needs implementation)
- ⚠️ **Note**: Previously had integration issues with newer Ionic/Node versions, but Quill 2.x should be compatible now

### Implementation Plan (Step-by-Step)

#### Phase 1: Quill Editor Integration & Testing
1. **Verify Quill 2.x Compatibility**
   - Test basic Quill editor component in a standalone test page
   - Verify toolbar renders correctly
   - Test basic text formatting (bold, italic, headings)
   - Verify no console errors with current Angular/Ionic versions

2. **Create Base Editor Component**
   - Create `src/app/components/content-editor/content-editor.component.ts`
   - Set up Quill with full toolbar configuration
   - Configure modules: toolbar, image, video, link, table
   - Test in isolation before full integration

3. **Configure Quill Modules**
   - **Toolbar**: Full formatting options (headings, lists, alignment, etc.)
   - **Image**: Upload to Firebase Storage + embed
   - **Video**: YouTube/Vimeo embed support
   - **Link**: Internal/external link insertion
   - **Table**: Table creation and editing
   - **Code**: Inline and block code formatting

#### Phase 2: Firebase Storage Integration
1. **Image Upload Handler**
   - Create Cloud Function `uploadContentImage` for secure uploads
   - Implement image compression/resizing (optional but recommended)
   - Store images in `content/images/` path in Firebase Storage
   - Return public URL for Quill to embed

2. **File Management**
   - Create media library component to browse uploaded images
   - Add image selection from library (reuse existing uploads)
   - Implement image deletion/cleanup for unused assets

#### Phase 3: Content Data Model & Firestore
1. **Content Collection Structure**
   - Design Firestore schema for articles/content:
     - `title`, `slug`, `excerpt`, `content` (Quill Delta JSON)
     - `author`, `createdAt`, `updatedAt`
     - `status` (draft, published, archived)
     - `category`, `tags`, `featuredImage`
     - `seoMeta` (title, description, keywords)

2. **Firestore Security Rules**
   - Allow admins to create/update/delete content
   - Public read access for published content only
   - Draft content only visible to admins

3. **Content Service**
   - Create `ContentService` for CRUD operations
   - Methods: `createArticle()`, `updateArticle()`, `deleteArticle()`, `getArticle()`, `listArticles()`
   - Handle Quill Delta JSON serialization/deserialization

#### Phase 4: Content Creation UI
1. **Create Article Page**
   - Route: `/admin/content/create` or `/admin/articles/new`
   - Form with: title, excerpt, category, tags
   - Quill editor component embedded
   - Save as draft / Publish buttons
   - Preview mode toggle

2. **Content List/Management Page**
   - Route: `/admin/content` or `/admin/articles`
   - Table/list view of all articles
   - Filter by status (draft/published)
   - Search functionality
   - Edit/Delete actions

3. **Edit Article Page**
   - Route: `/admin/content/edit/:id`
   - Load existing article data
   - Populate Quill editor with saved content
   - Update functionality

#### Phase 5: Advanced Features
1. **Video Embedding**
   - YouTube URL parser (extract video ID from various URL formats)
   - Vimeo embed support
   - Custom Quill blot for video embeds
   - Responsive video containers

2. **Link Management**
   - Internal link picker (link to other articles)
   - External link validation
   - Link preview/description (optional)

3. **SEO Optimization**
   - Meta title/description fields
   - Auto-generate slug from title
   - Open Graph image selection
   - Schema.org structured data (optional)

4. **Content Preview**
   - Live preview pane (side-by-side with editor)
   - Mobile preview toggle
   - Print preview

#### Phase 6: Content Display (Public-Facing)
1. **Article Display Component**
   - Route: `/article/:slug` or `/content/:slug`
   - Render Quill Delta JSON to HTML
   - Responsive image handling
   - Video embed rendering
   - Social sharing buttons

2. **Article List/Archive**
   - Homepage featured articles
   - Category pages
   - Tag pages
   - Pagination

### Technical Considerations

#### Quill 2.x Compatibility
- **Quill 2.0.3** should work with:
  - Angular 20.0.0 ✅
  - Ionic 8.7.2 ✅
  - Node 20.x ✅
- If issues arise, check:
  - `ngx-quill` version compatibility
  - Quill CSS import path
  - Zone.js compatibility (may need `NgZone.runOutsideAngular` for some Quill operations)

#### Performance
- Lazy load Quill editor (only load when creating/editing content)
- Compress images before upload (use browser Image API or Cloud Function)
- Cache rendered articles (Firestore + CDN)

#### Security
- Sanitize Quill Delta JSON before saving (prevent XSS)
- Validate image uploads (file type, size limits)
- Rate limit content creation (prevent spam)

### Testing Checklist
- [ ] Quill editor loads without errors
- [ ] Text formatting works (bold, italic, headings)
- [ ] Image upload and embedding works
- [ ] Video embedding works (YouTube, Vimeo)
- [ ] Links can be inserted and edited
- [ ] Content saves to Firestore correctly
- [ ] Content displays correctly on public pages
- [ ] Mobile editor experience is usable
- [ ] Draft vs Published status works
- [ ] SEO metadata saves and displays

### Dependencies to Verify
- `quill@^2.0.3` - Already installed ✅
- `ngx-quill@^28.0.1` - Already installed ✅
- May need additional Quill modules:
  - `quill-image-resize-module-react` (if using React version, but we need Angular equivalent)
  - Custom video embed blot (may need to create)

### Resources
- [Quill 2.x Documentation](https://quilljs.com/docs/)
- [ngx-quill GitHub](https://github.com/KillerCodeMonkey/ngx-quill)
- Existing docs: `docs/content-management.md`

### Estimated Time
- Phase 1: 2-3 hours (testing + base component)
- Phase 2: 2-3 hours (image upload)
- Phase 3: 2-3 hours (data model + service)
- Phase 4: 4-5 hours (UI pages)
- Phase 5: 3-4 hours (advanced features)
- Phase 6: 3-4 hours (public display)
- **Total**: ~16-22 hours (can be split across multiple sessions)

---
