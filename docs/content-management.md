# Content Management Guide - DCCI Ministries Website

## 📝 Overview

The DCCI Ministries website uses a custom Content Management System (CMS) built with Quill editor and Firebase backend. This guide explains how to create, edit, and manage content effectively.

## 🎯 Content Types

### **Automatic Content**
- **YouTube Videos**: Automatically converted to articles
- **Scheduled Posts**: Pre-scheduled content publication
- **RSS Feeds**: Imported content from external sources

### **Manual Content**
- **Custom Articles**: Written using Quill editor
- **Welcome Page**: Editable sections via Admin → Welcome Page (see below)
- **Static Pages**: About, Contact, Legal pages
- **Media Galleries**: Image and video collections
- **Blog Posts**: Regular ministry updates

## Editing the Welcome Page

Full **Admin** users can edit the public welcome page without changing its look or breaking SEO.

### **How to open the editor**
1. Log into the admin dashboard
2. Under **Quick Actions**, click **Welcome Page**
3. Or go directly to `/admin/welcome-settings`

See **[Admin Dashboard — Welcome Page](./admin-dashboard.md#welcome-page-editor)** for the full draft → preview → publish workflow and how to roll back to a previous version.

### **Recommended workflow**
1. Edit sections in the admin form
2. **Save draft** — safe to leave; visitors still see the old page
3. **Preview** — opens `/admin/welcome-preview` (admin-only, yellow banner)
4. If it looks good, **Publish live** — updates `/welcome` and rebuilds the SEO page for Google
5. If you dislike the result, use **Previous versions** → **Load into editor** or **Publish** an older snapshot

### **What you can edit**
| Section | Editor type |
|---------|-------------|
| Header tagline | Text field |
| Logo image | Upload (Firebase Storage) |
| Hero title & subtitle | Text fields |
| Hero banner image | Upload (Firebase Storage) |
| Mission | Heading + Quill body (images supported) |
| Social media intro | Heading + Quill body |
| Social links | Add/remove links — each has **button label**, **URL**, and **icon** |
| Support intro | Heading + Quill body |
| Support links | Add/remove links — each has **button label**, **URL**, and **icon** |
| Testimony statement & verse | Text + Quill |
| SEO title & description | Text fields (for search engines) |

**Not editable in this screen** (built into the page layout): contact form, newsletter signup, content carousel, footer.

### **How it works**
- **Draft:** Save changes without affecting the live `/welcome` page
- **Preview:** Opens an admin-only preview of your draft (`/admin/welcome-preview`)
- **Publish live:** Replaces the public page and triggers an SEO rebuild
- **Version history:** Each publish archives the previous live page (last 10) — load into the editor or publish again

### **Storage**
- **Live:** Firestore `siteSettings/welcome` (public read)
- **Draft:** `adminSettings/welcomeDraft` (admin only)
- **Versions:** `adminSettings/welcomeVersions/versions/{id}` (admin only)

### **Read-only mode**
If the site is in **read-only mode** (Site Management / Emergency Controls), Save draft, Preview, and Publish are disabled.

---

### **Editor Interface**
The Quill editor provides a familiar, Word-like experience with these features:

#### **Toolbar Options**
- **Text Formatting**: Bold, italic, underline, strikethrough
- **Headings**: H1, H2, H3, H4, H5, H6
- **Lists**: Bulleted and numbered lists
- **Alignment**: Left, center, right, justify
- **Links**: Insert and edit hyperlinks
- **Media**: Images, videos, and files
- **Tables**: Create and edit data tables
- **Code**: Inline and block code formatting

#### **Advanced Features**
- **Custom Styles**: Ministry-specific formatting
- **Embedded Content**: YouTube videos, social media posts
- **File Attachments**: PDFs, documents, audio files
- **Collaborative Editing**: Multiple users can edit simultaneously

### **Creating New Content**

#### **Step 1: Access the Editor**
1. Log into the admin area
2. Click "Create New Article" or "Add Content"
3. Select content type (Article, Page, etc.)

#### **Step 2: Basic Information**
- **Title**: Enter a descriptive, SEO-friendly title
- **Excerpt**: Write a brief summary (150-160 characters)
- **Tags**: Add relevant keywords for organization
- **Category**: Select appropriate content category

#### **Step 3: Content Creation**
1. **Start Writing**: Use the editor to write your content
2. **Format Text**: Apply headings, lists, and formatting
3. **Add Media**: Insert images, videos, and files
4. **Review Content**: Preview before publishing

#### **Step 4: Publishing**
- **Draft**: Save as draft for later editing
- **Publish**: Make content live immediately
- **Schedule**: Set future publication date
- **Private**: Create content visible only to admins

### **Content Best Practices**

#### **Writing Guidelines**
- **Clear Headings**: Use descriptive headings (H1, H2, H3)
- **Short Paragraphs**: Keep paragraphs under 3-4 sentences
- **Bullet Points**: Use lists for easy scanning
- **Call to Action**: Include clear next steps for readers

#### **SEO Optimization**
- **Meta Title**: 50-60 characters maximum
- **Meta Description**: 150-160 characters
- **Keywords**: Include relevant search terms naturally
- **Internal Links**: Link to related content on your site

#### **Accessibility**
- **Alt Text**: Describe images for screen readers
- **Headings**: Use proper heading hierarchy
- **Color Contrast**: Ensure text is readable
- **Keyboard Navigation**: Test with keyboard only

## 🖼️ Media Management

### **Image Guidelines**

#### **Supported Formats**
- **Web Images**: JPG, PNG, WebP
- **Vector Graphics**: SVG
- **File Sizes**: Maximum 5MB per image
- **Dimensions**: Recommended 1200px width for featured images

#### **Image Optimization**
- **Compression**: Use WebP format when possible
- **Responsive Images**: Upload high-quality originals
- **Alt Text**: Always include descriptive alt text
- **Captions**: Add captions for context

#### **Adding Images**
1. **Upload New Image**:
   - Click the image icon in the editor
   - Select "Upload Image"
   - Choose file from your computer
   - Add alt text and caption
   - Click "Insert"

2. **Select from Library**:
   - Click the image icon
   - Choose "Select from Library"
   - Browse existing images
   - Select and insert

3. **Image Settings**:
   - **Size**: Small, medium, large, full-width
   - **Alignment**: Left, center, right
   - **Link**: Make image clickable
   - **Caption**: Add descriptive text below

### **Video Integration**

#### **YouTube Videos**
1. **Automatic Integration**:
   - New YouTube videos automatically become articles
   - No manual work required
   - SEO-optimized automatically

2. **Manual Embedding**:
   - Copy YouTube video URL
   - Click video icon in editor
   - Paste URL and click "Embed"
   - Video appears in your content

#### **Other Video Sources**
- **Vimeo**: Similar embedding process
- **Local Videos**: Upload video files directly
- **Live Streams**: Embed live content

### **File Attachments**
- **Supported Formats**: PDF, DOC, DOCX, TXT
- **File Size Limit**: 10MB per file
- **Security**: Files are scanned for malware
- **Organization**: Files are categorized by type

## 📊 Content Organization

### **Categories and Tags**

#### **Categories**
- **Main Categories**: Ministry updates, teachings, events
- **Subcategories**: Specific topics within main areas
- **Hierarchy**: Parent-child relationships
- **Navigation**: Categories appear in site navigation

#### **Tags**
- **Keywords**: Specific topics and themes
- **Search**: Help visitors find related content
- **Organization**: Group similar content
- **SEO**: Improve search engine visibility

### **Content Status**

#### **Draft**
- **Private**: Only visible to content creators
- **Editing**: Can be modified before publishing
- **Review**: Ready for approval process
- **Scheduling**: Can be scheduled for future publication

#### **Published**
- **Live**: Visible to all visitors
- **Public**: Indexed by search engines
- **Social**: Can be shared on social media
- **Comments**: Open for visitor interaction

#### **Archived**
- **Historical**: Old content moved to archive
- **Accessible**: Still available but not featured
- **SEO**: Maintains search engine value
- **Storage**: Optimized for long-term storage

## 🔄 Content Workflow

### **Creation Process**
1. **Planning**: Determine content type and purpose
2. **Research**: Gather information and resources
3. **Writing**: Create content using Quill editor
4. **Review**: Self-review and editing
5. **Approval**: Submit for review (if required)
6. **Publishing**: Make content live

### **Editing Process**
1. **Identify Changes**: Determine what needs updating
2. **Make Edits**: Use Quill editor to modify content
3. **Review Changes**: Preview modifications
4. **Update Metadata**: Modify title, tags, or category if needed
5. **Republish**: Update live content

### **Content Review**
- **Self-Review**: Check for errors and clarity
- **Peer Review**: Have others review content
- **Fact-Checking**: Verify information accuracy
- **SEO Review**: Optimize for search engines

## 📱 Mobile Content Management

### **Mobile Editor**
- **Responsive Design**: Editor works on all devices
- **Touch-Friendly**: Optimized for mobile devices
- **Auto-Save**: Content saved automatically
- **Offline Support**: Work without internet connection

### **Mobile Best Practices**
- **Short Content**: Keep mobile content concise
- **Large Touch Targets**: Ensure buttons are easy to tap
- **Fast Loading**: Optimize images for mobile
- **Readable Text**: Use appropriate font sizes

## 🔍 Content Discovery

### **Search Functionality**
- **Full-Text Search**: Search within article content
- **Tag Search**: Find content by tags
- **Category Search**: Browse by content category
- **Advanced Search**: Filter by date, author, type

### **Content Recommendations**
- **Related Content**: Suggest similar articles
- **Popular Content**: Highlight trending articles
- **Recent Updates**: Show latest content
- **Featured Content**: Promote important articles

## 📈 Content Analytics

### **Performance Metrics**
- **Page Views**: How many people view content
- **Time on Page**: How long visitors stay
- **Bounce Rate**: Percentage of single-page visits
- **Social Shares**: How often content is shared

### **Engagement Metrics**
- **Comments**: Visitor interaction and feedback
- **Likes/Reactions**: Content popularity indicators
- **Click-Through Rate**: Link effectiveness
- **Conversion Rate**: Goal completion percentage

## 🚨 Troubleshooting

### **Common Issues**

#### **Editor Not Loading**
- Check internet connection
- Clear browser cache
- Try different browser
- Contact support if persistent

#### **Content Not Saving**
- Check auto-save is enabled
- Verify internet connection
- Try refreshing page
- Check browser console for errors

#### **Media Not Uploading**
- Verify file format is supported
- Check file size limits
- Ensure stable internet connection
- Try smaller file size

#### **Formatting Issues**
- Use editor formatting tools
- Avoid copying from Word/Google Docs
- Use plain text for complex formatting
- Check HTML source if needed

### **Getting Help**
- **Documentation**: Check this guide first
- **Support Team**: Contact development team
- **Community**: Ask other content creators
- **Training**: Request additional training sessions

## 📋 Content Checklist

### **Before Publishing**
- [ ] Content is complete and accurate
- [ ] Images have alt text and captions
- [ ] Links are working and relevant
- [ ] SEO metadata is optimized
- [ ] Content is proofread
- [ ] Images are properly sized
- [ ] Mobile experience is tested

### **After Publishing**
- [ ] Content displays correctly
- [ ] Links work properly
- [ ] Images load correctly
- [ ] Mobile view is optimized
- [ ] Social sharing works
- [ ] Analytics are tracking
- [ ] Search indexing is working

---

## 🎯 Success Tips

**Consistency**: Post content regularly to build audience
**Quality**: Focus on valuable, helpful content
**Engagement**: Encourage comments and interaction
**Optimization**: Continuously improve based on analytics
**Accessibility**: Ensure content is usable by everyone

---

**This guide should be updated as new features are added to the CMS.**
**Last Updated**: [Current Date]  
**Next Review**: [Monthly]  
**Support Contact**: [Development Team] 
