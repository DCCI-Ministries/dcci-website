# DCCI Website (Rebuild & Archive)

This project is tested with BrowserStack

## License

This project is open source and licensed under the MIT License.
It exists to support accessibility-first web development and nonprofit ministry use.


Open-source codebase for preserving and relaunching the DCCI Ministries website.
- Tech: Angular/Ionic, Firebase Hosting
- Accessibility-first, archival “Archives” section, plus remastered posts

## Run locally
1) Copy env examples:
cp src/environments/environment.example.ts src/environments/environment.ts
cp src/environments/environment.prod.example.ts src/environments/environment.prod.ts

sql
Copy
Edit
2) Fill in local values (do not commit).
3) Install & start:
npm i
npm run start

makefile
Copy
Edit

## Contributing
PRs welcome. Please keep code accessible (WCAG), avoid adding secrets to Git.

## SEO Layer (Astro) vs Interactive Layer (Ionic)

This project uses a dual-layer architecture:

### SEO Layer (Astro) - `public-site/`
- **Purpose**: Crawlable, indexable HTML pages for search engines
- **Location**: `public-site/` directory
- **Routes**: `/`, `/welcome/`, `/articles/`, `/articles/{slug}/`, `/contact/`, `/privacy/`, `/terms/`, etc.
- **Content**: Static HTML pages with real text content, mission statements, and prominent CTAs linking to the interactive app
- **Build**: `cd public-site && npm run build`
- **Dev**: `cd public-site && npm run dev`
- **Deployment**: Built files are copied into `dist/app/` during full build

### Interactive Layer (Ionic/Angular) - Root directory
- **Purpose**: Full-featured interactive SPA with authentication, comments, bookmarks, etc.
- **Location**: Root directory (`src/app/`)
- **Routes**: `/app/**` (e.g., `/app/welcome`, `/app/articles`, `/app/article/{slug}`)
- **Admin Routes**: `/admin/**` (protected, noindex headers)
- **Build**: `npm run build` (Angular/Ionic)
- **Dev**: `npm run start`
- **Deployment**: Built to `dist/app/` (Astro files are merged in)

### Running Both Locally

1. **Ionic App** (port 4200):
   ```bash
   npm run start
   ```

2. **Astro SEO Site** (port 4321):
   ```bash
   cd public-site
   npm run dev
   ```

### Building for Production

Build both layers:
```bash
npm run build:all
```

This:
1. Builds Angular/Ionic to `dist/app/`
2. Builds Astro to `dist/public-site/`
3. Copies Astro output into `dist/app/` (preserving Ionic's `index.html`)

### Firebase Hosting Routing

- **Astro SEO pages**: Served directly as static HTML (e.g., `/welcome/`, `/articles/{slug}/`)
- **Ionic SPA**: Served via `/app/**` routes → `index.html`
- **Admin routes**: `/admin/**` → `index.html` (with `X-Robots-Tag: noindex, nofollow` headers)

### Security: firebase-admin

`firebase-admin` is **server-only** and must NEVER be imported in client code:
- ✅ Allowed: Astro frontmatter, API routes, `src/lib/firebaseAdmin.ts`
- ❌ Forbidden: Client components, `<script>` tags in Astro files

Build check: `npm run check:firebase-admin` (runs automatically before build)

## License
Code: MIT (see LICENSE)  
Content: see CONTENT-LICENSE.md
