# Project Handoff Guide - DCCI Ministries Website

## 🚨 Critical Information for New Developers

**Welcome to the DCCI Ministries website project!** This guide contains everything you need to know to successfully take over and maintain this project. Read this document completely before making any changes.

## 📋 Project Overview

### **What This Project Is**
- **Modern Website**: Ionic Angular-based website for DCCI Ministries
- **Content Management**: Custom CMS with Quill editor
- **Automation**: YouTube videos automatically become website articles
- **PWA**: Progressive web app with mobile-first design
- **Firebase Backend**: Secure, scalable backend infrastructure

### **What This Project Is NOT**
- **WordPress Site**: This is a custom-built solution
- **Simple Static Site**: Complex CMS with database backend
- **Temporary Solution**: Long-term ministry website
- **Low-Priority Project**: Critical ministry communication tool

## 🔑 Access Credentials

### **Firebase Console**
- **URL**: [console.firebase.google.com](https://console.firebase.google.com)
- **Project**: dcci-ministries
- **Access Level**: Full admin access required
- **Backup**: Daily automated backups enabled

### **Domain Management**
- **Provider**: [Check with previous developer]
- **Domain**: [Your domain name]
- **DNS**: Cloudflare proxy enabled
- **SSL**: Automatic SSL certificates

### **Cloudflare**
- **URL**: [dash.cloudflare.com](https://dash.cloudflare.com)
- **Account**: [Check with previous developer]
- **Proxy**: Enabled for performance and security

### **GitHub Repository**
- **Repository**: [Your repo URL]
- **Access**: Full repository access required
- **Branches**: main (production), develop (development)

## 📧 Website / technical contact (developer handoff)

UK and EU visitors must be able to reach someone about **website, accessibility, and technical/privacy** matters. That address is **not** the ministry’s main content inbox.

| Address type | Config field | Who owns it |
|--------------|--------------|-------------|
| Ministry / content | `ministryInfoEmail` | DCCI Ministries |
| Visitor contact form | `contactFormRecipientEmail` | Ministry (Hatun) |
| Website / technical | `technicalAdminEmail` | **You** (the site maintainer) |

**When you take over:** follow **[Technical Contact Handoff](./technical-contact-handoff.md)** — edit `technicalAdminEmail` in **both** [`config/site-contacts.json`](../config/site-contacts.json) and [`functions/src/config/site-contacts.json`](../functions/src/config/site-contacts.json), set `technicalSuccessionContactEmail` to the outgoing developer, update [`config/succession-chain.md`](../config/succession-chain.md), then build and deploy.

**Contact form operations:** Recipients come from `site-contacts.json` (not Firebase `mail.to`). SMTP uses `mail.user` / `mail.pass` only. To block a harasser, edit [`config/contact-blocklist.json`](../config/contact-blocklist.json) and the functions copy — see the handoff guide.

If you need the previous maintainer urgently, email them with subject **`Urgent: Hatun Website Question`** (see succession-chain doc).

## 🏗️ Technical Architecture

### **Technology Stack**
- **Frontend**: Ionic Angular 8.0.0 + Angular 20.0.0
- **Backend**: Firebase 12.1.0 (Firestore, Storage, Auth)
- **Editor**: Quill 2.0.3 with ngx-quill wrapper
- **Build**: Angular CLI 20.0.0
- **Mobile**: Capacitor 7.4.2

### **Key Dependencies**
```json
{
  "@angular/core": "^20.0.0",
  "@ionic/angular": "^8.0.0",
  "@angular/fire": "^20.0.1",
  "firebase": "^12.1.0",
  "ngx-quill": "^28.0.1",
  "quill": "^2.0.3"
}
```

### **Project Structure**
```
src/
├── app/
│   ├── components/          # Reusable UI components
│   ├── pages/              # Route-based pages
│   ├── services/           # Business logic services
│   └── models/             # Data models
├── environments/            # Firebase configuration
├── assets/                 # Static assets
└── theme/                  # Global styles
```

## 🔐 Security & Access Control

### **Firebase Security Rules**
- **Firestore**: Role-based access control
- **Storage**: Admin-only uploads, public reads
- **Authentication**: Email/password with role management
- **Environment Variables**: Secure configuration storage

### **User Roles**
- **Admin**: Full access to all features
- **Editor**: Create and edit content
- **Viewer**: Read-only access

### **Critical Security Notes**
- **Never commit environment files** (they're gitignored)
- **Firebase keys are sensitive** - keep them secure
- **Security rules must be tested** before deployment
- **Regular security audits** are required

## 📊 Data & Content

### **Firestore Collections**
- **articles**: Website articles and content
- **users**: User accounts and roles
- **media**: Uploaded files and images
- **settings**: Site configuration

### **Content Types**
- **Automatic Articles**: Generated from YouTube videos
- **Manual Articles**: Written using Quill editor
- **Media Files**: Images, videos, documents
- **Site Settings**: Configuration and preferences

### **Backup Strategy**
- **Daily**: Automated Firebase backups
- **Weekly**: Manual backup verification
- **Monthly**: Full system backup
- **Before Changes**: Always backup before major updates

## 🚀 Deployment Process

### **Development Workflow**
1. **Local Development**: `npm start`
2. **Testing**: `npm test` and manual testing
3. **Build**: `npm run build`
4. **Deploy**: `firebase deploy`

### **Environment Management**
- **Development**: Local environment
- **Staging**: Test environment (if configured)
- **Production**: Live website

### **Deployment Checklist**
- [ ] All tests pass
- [ ] Build successful
- [ ] Environment variables correct
- [ ] Security rules updated
- [ ] Backup completed
- [ ] Rollback plan ready

## 🧪 Testing & Quality Assurance

### **Testing Strategy**
- **Unit Tests**: Component and service testing
- **Integration Tests**: Firebase service testing
- **E2E Tests**: User workflow testing
- **Accessibility Tests**: WCAG 2.1 AA compliance

### **Quality Gates**
- **Code Coverage**: Minimum 80%
- **Linting**: No ESLint errors
- **Type Safety**: No TypeScript errors
- **Performance**: < 3 second load times

### **Testing Commands**
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run lint          # Code quality
```

## 🔧 Maintenance Procedures

### **Daily Tasks**
- [ ] Check website functionality
- [ ] Monitor error logs
- [ ] Verify backups completed
- [ ] Check performance metrics

### **Weekly Tasks**
- [ ] Review error logs
- [ ] Check Firebase usage
- [ ] Monitor performance
- [ ] Update dependencies

### **Monthly Tasks**
- [ ] Security audit
- [ ] Performance optimization
- [ ] Backup verification
- [ ] Documentation updates

### **Quarterly Tasks**
- [ ] Full accessibility audit
- [ ] SEO review and optimization
- [ ] Security penetration testing
- [ ] Performance benchmarking

## 🚨 Emergency Procedures

### **Website Down**
1. **Immediate**: Check Firebase console for errors
2. **Quick Fix**: Restart Firebase functions if applicable
3. **Rollback**: Deploy previous working version
4. **Investigation**: Identify root cause
5. **Communication**: Update stakeholders

### **Data Loss**
1. **Stop**: Don't make any changes
2. **Assess**: Determine scope of loss
3. **Recover**: Restore from latest backup
4. **Investigate**: Find cause of loss
5. **Prevent**: Implement safeguards

### **Security Breach**
1. **Isolate**: Disconnect affected systems
2. **Assess**: Determine scope of breach
3. **Contain**: Stop further access
4. **Investigate**: Find breach source
5. **Recover**: Restore secure state

## 📱 Mobile Development

### **Capacitor Setup**
```bash
# Sync web code with native projects
npx cap sync

# Open in native IDEs
npx cap open ios      # Xcode
npx cap open android  # Android Studio
```

### **Platform Requirements**
- **iOS**: macOS + Xcode
- **Android**: Android Studio + SDK
- **Cross-platform**: Web-first development

## 🌐 Performance & SEO

### **Performance Targets**
- **Page Load**: < 3 seconds
- **Core Web Vitals**: All green
- **Mobile Performance**: Optimized for mobile
- **Accessibility**: WCAG 2.1 AA compliance

### **SEO Requirements**
- **Meta Tags**: Proper title and description
- **Structured Data**: JSON-LD markup
- **Sitemap**: XML sitemap generation
- **Robots.txt**: Proper crawling instructions

## 🔄 Content Management

### **Quill Editor**
- **Rich Text**: Full formatting capabilities
- **Media Embedding**: Videos, images, documents
- **Custom Toolbar**: Ministry-specific formatting
- **Auto-save**: Draft preservation

### **YouTube Integration**
- **Automatic Articles**: Videos become website content
- **API Limits**: Respect YouTube API quotas
- **Content Sync**: Regular synchronization
- **Error Handling**: Graceful failure handling

## 📚 Documentation Requirements

### **Code Documentation**
- **Inline Comments**: Complex logic explanation
- **API Documentation**: Service method descriptions
- **Component Documentation**: Usage examples
- **Change Log**: Track all modifications

### **User Documentation**
- **Owner's Guide**: Non-technical user guide
- **Admin Guide**: Content management instructions
- **Troubleshooting**: Common issue solutions
- **FAQ**: Frequently asked questions

## 🤝 Communication

### **Stakeholders**
- **Ministry Owner**: Primary content owner
- **Development Team**: Technical staff
- **Content Creators**: Article writers
- **End Users**: Website visitors

### **Communication Channels**
- **Email**: Primary communication method
- **Phone**: Emergency situations only
- **Project Management**: [Your preferred tool]
- **Status Updates**: Regular progress reports

## 📅 Important Dates & Deadlines

### **Regular Maintenance**
- **Daily**: Website monitoring
- **Weekly**: Performance review
- **Monthly**: Security audit
- **Quarterly**: Full system review

### **Content Updates**
- **YouTube Sync**: Daily automatic
- **Manual Articles**: As needed
- **Media Updates**: Weekly review
- **SEO Optimization**: Monthly review

## 🎯 Success Metrics

### **Technical Metrics**
- **Uptime**: 99.9% availability
- **Performance**: < 3 second loads
- **Security**: Zero security incidents
- **Accessibility**: 100% WCAG compliance

### **Content Metrics**
- **Article Growth**: Regular new content
- **Visitor Engagement**: Increasing time on site
- **Search Rankings**: Improving SEO performance
- **Mobile Usage**: Mobile-first optimization

## 🚀 Getting Started Checklist

### **First Day**
- [ ] Read this entire document
- [ ] Set up development environment
- [ ] Verify access to all systems
- [ ] Run the application locally
- [ ] Review current codebase

### **First Week**
- [ ] Understand the architecture
- [ ] Review security rules
- [ ] Test all major features
- [ ] Set up monitoring
- [ ] Meet with stakeholders

### **First Month**
- [ ] Complete system audit
- [ ] Update documentation
- [ ] Implement improvements
- [ ] Establish maintenance routine
- [ ] Plan future development

## 📞 Support & Resources

### **Immediate Support**
- **Previous Developer**: [Contact Information]
- **Firebase Support**: [firebase.google.com/support](https://firebase.google.com/support)
- **Angular Support**: [angular.io/support](https://angular.io/support)
- **Ionic Support**: [ionicframework.com/support](https://ionicframework.com/support)

### **Documentation Resources**
- **Project Docs**: This `/docs` folder
- **Angular Docs**: [angular.io/docs](https://angular.io/docs)
- **Firebase Docs**: [firebase.google.com/docs](https://firebase.google.com/docs)
- **Ionic Docs**: [ionicframework.com/docs](https://ionicframework.com/docs)

---

## 🎯 Final Notes

**This project is critical to the ministry's digital presence.** Take your time to understand it thoroughly before making changes. When in doubt, ask questions rather than making assumptions.

**Remember**: The ministry owner depends on this website for communication with their community. Every change affects real people.

**Good luck, and thank you for taking on this important project! 🙏**

---

**Last Updated**: [Current Date]  
**Handoff From**: [Previous Developer]  
**Next Review**: [3 months from handoff] 
