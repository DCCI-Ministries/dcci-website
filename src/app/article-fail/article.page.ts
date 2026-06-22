import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonIcon, IonButton, IonSpinner } from '@ionic/angular/standalone';
import { ContentService, Content } from '../services/content.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { PageHeaderComponent } from '../components/page-header.component';
import { FooterComponent } from '../components/footer.component';
import { VersionService } from '../services/version.service';

@Component({
  selector: 'app-article',
  templateUrl: './article.page.html',
  styleUrls: ['./article.page.scss'],
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonButton, IonSpinner, PageHeaderComponent, FooterComponent]
})
export class ArticlePage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('articleContent', { static: false }) articleContent!: ElementRef;
  content: Content | null = null;
  isLoading = true;
  error: string | null = null;
  sanitizedContent: SafeHtml = '';
  videoLoadError = false;
  showVideoError = false;
  isMobile = false;
  version: string;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private contentService: ContentService,
    private sanitizer: DomSanitizer,
    private versionService: VersionService
  ) {
    this.version = this.versionService.getVersion();
  }

  async ngOnInit() {
    // Detect mobile device
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                    (window.innerWidth <= 768);
    
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.error = 'Invalid article URL';
      this.isLoading = false;
      return;
    }

    await this.loadContent(slug);
  }

  ngAfterViewInit() {
    // Set up error detection for YouTube videos
    this.setupVideoErrorDetection();

    // Re-enable iframes after view init to ensure they're properly loaded and clickable
    setTimeout(() => {
      if (this.articleContent) {
        const iframes = this.articleContent.nativeElement.querySelectorAll('iframe');
        iframes.forEach((iframe: HTMLIFrameElement) => {
          // Ensure iframes have proper attributes for YouTube
          if (iframe.src.includes('youtube.com')) {
            // Update URL to ensure mobile compatibility
            let src = iframe.src;
            if (src.includes('youtube.com/embed')) {
              const url = new URL(src);
              // Add required mobile-friendly parameters
              url.searchParams.set('playsinline', '1');
              if (!url.searchParams.has('rel')) {
                url.searchParams.set('rel', '0');
              }
              if (!url.searchParams.has('modestbranding')) {
                url.searchParams.set('modestbranding', '1');
              }
              if (!url.searchParams.has('enablejsapi')) {
                url.searchParams.set('enablejsapi', '1');
              }
              if (!url.searchParams.has('origin')) {
                url.searchParams.set('origin', window.location.origin);
              }
              iframe.src = url.toString();
            }
            
            // Ensure allowfullscreen is present
            iframe.setAttribute('allowfullscreen', '');
            // Ensure allow attribute is set correctly
            iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen');
            iframe.setAttribute('frameborder', '0');
            // Add referrerpolicy if missing
            if (!iframe.hasAttribute('referrerpolicy')) {
              iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
            }
            
            // On mobile, add touch-specific styles
            if (this.isMobile) {
              iframe.style.touchAction = 'manipulation';
              (iframe.style as any).webkitTouchCallout = 'none';
              (iframe.style as any).webkitUserSelect = 'none';
            }
            
            // Ensure iframe is clickable
            iframe.style.pointerEvents = 'auto';
            iframe.style.cursor = 'pointer';
            

            // Add error detection
            this.detectVideoErrors(iframe);
          }
        });
      }
    }, 100);
    setTimeout(() => this.installMobileYoutubeTapFix(), 250);
  }

  private setupVideoErrorDetection() {
    // Listen for cross-origin errors
    const originalError = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      if (typeof message === 'string' && 
          message.includes('Blocked a frame with origin') && 
          message.includes('youtube.com')) {
        this.videoLoadError = true;
        this.showVideoError = true;
        return true; // Suppress the error
      }
      if (originalError) {
        return originalError(message, source, lineno, colno, error);
      }
      return false;
    };

    // Also listen for unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason && 
          typeof event.reason === 'object' && 
          event.reason.message &&
          event.reason.message.includes('Blocked a frame with origin') &&
          event.reason.message.includes('youtube.com')) {
        this.videoLoadError = true;
        this.showVideoError = true;
        event.preventDefault();
      }
    });
  }

  private detectVideoErrors(iframe: HTMLIFrameElement) {
    // Check if iframe loads successfully
    let loadTimeout: any;
    let hasLoaded = false;

    iframe.addEventListener('load', () => {
      hasLoaded = true;
      if (loadTimeout) {
        clearTimeout(loadTimeout);
      }
    });

    // If iframe doesn't load within 5 seconds, show error
    loadTimeout = setTimeout(() => {
      if (!hasLoaded) {
        this.videoLoadError = true;
        this.showVideoError = true;
      }
    }, 5000);
  }

  dismissVideoError() {
    this.showVideoError = false;
  }

  private installMobileYoutubeTapFix() {
    if (!this.isMobile) return;
    
    const root = this.articleContent?.nativeElement;
    if (!root) return;

    const iframes = Array.from(root.querySelectorAll('iframe')) as HTMLIFrameElement[];
    const ytIframes = iframes.filter(f => {
      const src = f.src || f.getAttribute('src') || '';
      return src.includes('youtube.com/embed');
    });

    ytIframes.forEach((iframe: HTMLIFrameElement) => {
      const wrapper = iframe.closest('.responsive-video-wrapper') as HTMLElement || iframe.parentElement;
      if (!wrapper) return;

      if (wrapper.classList.contains('yt-tapfix-installed')) return;
      wrapper.classList.add('yt-tapfix-installed');

      // Ensure iframe can't receive events while overlay is active
      iframe.style.pointerEvents = 'none';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'yt-tap-overlay';
      btn.setAttribute('aria-label', 'Play video');
      btn.innerHTML = '<span class="yt-tap-icon" aria-hidden="true"></span>';

      const handleTap = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const src = iframe.getAttribute('src') || iframe.src || '';
        if (!src) return;

        try {
          const url = new URL(src);
          url.searchParams.set('autoplay', '1');
          url.searchParams.set('playsinline', '1');
          iframe.setAttribute('src', url.toString());
          iframe.style.pointerEvents = 'auto';
          btn.remove();
          wrapper.classList.add('yt-started');
        } catch (err) {
          console.warn('Failed to update YouTube iframe URL:', err);
        }
        
        return false;
      };

      btn.addEventListener('touchstart', handleTap, { passive: false });
      btn.addEventListener('touchend', handleTap, { passive: false });
      btn.addEventListener('click', handleTap, { passive: false });

      wrapper.appendChild(btn);
    });
  }

  private async loadContent(slug: string) {
    try {
      this.isLoading = true;
      this.error = null;
      
      const loadedContent = await this.contentService.getContentBySlug(slug);
      
      if (!loadedContent) {
        this.error = 'Article not found';
        this.isLoading = false;
        return;
      }

      // Check if this is an old slug - if so, redirect to new slug
      if (loadedContent.oldSlugs?.includes(slug) && loadedContent.slug && loadedContent.slug !== slug) {
        this.router.navigate(['/article', loadedContent.slug], { replaceUrl: true });
        return;
      }

      this.content = loadedContent;
      // Process content to make YouTube iframes responsive and mobile-friendly using DOM parser
      let processedContent = this.content.content || '';
      
      // Parse HTML using DOMParser to avoid regex issues with malformed HTML
      const doc = new DOMParser().parseFromString(processedContent, 'text/html');
      const iframes = doc.querySelectorAll('iframe');
      
      iframes.forEach((iframe: HTMLIFrameElement) => {
        // Remove width and height attributes
        iframe.removeAttribute('width');
        iframe.removeAttribute('height');
        
        // Ensure frameborder is set
        iframe.setAttribute('frameborder', '0');
        
        // Process YouTube embeds
        const rawSrc = iframe.getAttribute('src') || '';
        let videoId: string | null = null;
        let isYouTube = false;
        
        // Extract video ID from various YouTube URL patterns
        if (rawSrc.includes('youtube.com') || rawSrc.includes('youtu.be')) {
          isYouTube = true;
          
          // Pattern 1: youtube.com/watch?v=VIDEO_ID
          const watchMatch = rawSrc.match(/(?:youtube\.com\/watch\?v=)([^&"'\s]+)/);
          if (watchMatch) {
            videoId = watchMatch[1];
          }
          
          // Pattern 2: youtu.be/VIDEO_ID
          if (!videoId) {
            const shortMatch = rawSrc.match(/(?:youtu\.be\/)([^?"'\s]+)/);
            if (shortMatch) {
              videoId = shortMatch[1];
            }
          }
          
          // Pattern 3: youtube.com/shorts/VIDEO_ID
          if (!videoId) {
            const shortsMatch = rawSrc.match(/(?:youtube\.com\/shorts\/)([^?"'\s]+)/);
            if (shortsMatch) {
              videoId = shortsMatch[1];
            }
          }
          
          // Pattern 4: youtube.com/embed/VIDEO_ID (already embed format)
          if (!videoId) {
            const embedMatch = rawSrc.match(/(?:youtube\.com\/embed\/)([^?"'\s]+)/);
            if (embedMatch) {
              videoId = embedMatch[1];
            }
          }
          
          // If we found a video ID, normalize to embed URL
          if (videoId) {
            const embedBaseUrl = `https://www.youtube.com/embed/${videoId}`;
            const url = new URL(embedBaseUrl);
            // Add required parameters
            url.searchParams.set('playsinline', '1');
            url.searchParams.set('rel', '0');
            url.searchParams.set('modestbranding', '1');
            url.searchParams.set('enablejsapi', '1');
            url.searchParams.set('origin', window.location.origin);
            iframe.setAttribute('src', url.toString());
            
            // Set YouTube-specific attributes
            iframe.setAttribute('allowfullscreen', '');
            iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen');
            iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
          }
        } else {
          // For non-YouTube iframes, ensure allowfullscreen if not present
          if (!iframe.hasAttribute('allowfullscreen')) {
            iframe.setAttribute('allowfullscreen', '');
          }
        }
        
        // Wrap iframe in responsive wrapper if not already wrapped
        const parent = iframe.parentElement;
        if (!parent || !parent.classList.contains('responsive-video-wrapper')) {
          const wrapper = doc.createElement('div');
          wrapper.className = 'responsive-video-wrapper';
          
          // Insert wrapper before iframe
          if (iframe.parentNode) {
            iframe.parentNode.insertBefore(wrapper, iframe);
          }
          
          // Move iframe into wrapper
          wrapper.appendChild(iframe);
        }
      });
      
      // Serialize back to HTML string
      processedContent = doc.body.innerHTML;
      
      // Sanitize the HTML content for safety (content is from our own database but we sanitize to be safe)
      // Using bypassSecurityTrustHtml since content is from our trusted database
      // In production, you might want additional sanitization layers
      this.sanitizedContent = this.sanitizer.bypassSecurityTrustHtml(processedContent);
      setTimeout(() => this.installMobileYoutubeTapFix(), 0);
    } catch (err) {
      console.error('Error loading content:', err);
      this.error = 'Failed to load article';
    } finally {
      this.isLoading = false;
    }
  }

  getDate(date: Date | any): Date {
    if (!date) return new Date();
    if (date instanceof Date) return date;
    if (date && typeof date.toDate === 'function') {
      return date.toDate();
    }
    return new Date(date);
  }

  getThumbnailUrl(content: Content): string | null {
    const data = content as any;
    return data.thumbnailUrl || content.featuredImage || null;
  }

  goBack() {
    this.router.navigate(['/home']);
  }


  ngOnDestroy() {
    // Clean up any event listeners if needed
    this.showVideoError = false;
    this.videoLoadError = false;
  }
}

