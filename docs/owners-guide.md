# Owner's Guide - DCCI Ministries Website

## 👋 Welcome, Ministry Leader!

This guide is written specifically for you - the owner of the DCCI Ministries website. It's designed to be easy to understand, even if you're not technical. Keep this guide handy for reference and share it with any new developers who take over the project.

## 🎯 What This Website Does

### **Automatic Content Creation**
- **YouTube Videos → Articles**: Your YouTube videos automatically become website articles
- **No Manual Work**: Content updates happen automatically when you upload videos
- **Always Fresh**: Your website stays current with minimal effort

### **Easy Content Management**
- **Simple Editor**: Write custom articles using an easy-to-use editor (similar to Word)
- **Media Embedding**: Easily add videos, images, and other media to articles
- **Draft System**: Save articles as drafts and publish when ready

### **Professional Appearance**
- **Modern Design**: Clean, professional look that reflects your ministry
- **Mobile-Friendly**: Works perfectly on phones, tablets, and computers
- **Fast Loading**: Quick page loads for better visitor experience

## 🚨 Emergency Situations

### **If the Website Goes Down**
1. **Don't Panic**: This is usually temporary
2. **Check Your Email**: Look for notifications from Firebase or Cloudflare
3. **Contact Your Developer**: Use the contact information below
4. **Social Media**: Let your community know you're working on it

### **If You Can't Reach Your Developer**
1. **Wait 24-48 Hours**: Sometimes developers are temporarily unavailable
2. **Check This Guide**: Look for solutions in the troubleshooting section
3. **Contact Backup Support**: Use the emergency contacts listed below
4. **Document Everything**: Write down what happened and when

### **If You Need a New Developer**
1. **Gather Information**: Collect all the details about your current setup
2. **Share This Documentation**: Give the new developer access to this folder
3. **Provide Access**: Share your Firebase and domain login information
4. **Set Expectations**: Be clear about what you need and when

## 🔑 Important Access Information

### **What You Need to Keep Safe**
- **Firebase Console Access**: [console.firebase.google.com](https://console.firebase.google.com)
- **Domain Management**: Where you bought your domain (GoDaddy, Namecheap, etc.)
- **Cloudflare Access**: [dash.cloudflare.com](https://dash.cloudflare.com)
- **GitHub Repository**: Your project's code storage

### **What to Share with New Developers**
- **This Documentation Folder**: Contains everything they need to know
- **Access Credentials**: Firebase, domain, and hosting logins
- **Project Goals**: What you want the website to accomplish
- **Timeline**: When you need things done

## 📱 Daily Website Management

### **What Happens Automatically**
- **YouTube Videos**: New videos automatically become website articles
- **Backups**: Your content is automatically backed up daily
- **Security Updates**: The system stays secure automatically
- **Performance**: Website speed is monitored and optimized

### **What You Can Do Manually**
- **Edit the Welcome Page**: Dashboard → Welcome Page (hero, mission, testimony, SEO text)
- **Write Custom Articles**: Use the editor to create special content
- **Edit Existing Articles**: Update content when needed
- **Add Media**: Upload images, embed videos, create galleries
- **Manage Comments**: Approve or moderate visitor comments

### **Content Creation Tips**
- **Keep It Simple**: Write like you're talking to a friend
- **Use Images**: People engage more with visual content
- **Include Videos**: Embed your YouTube videos in articles
- **Regular Updates**: Post new content regularly to keep visitors engaged

## 🛠️ Common Tasks

### **Adding a New Article**
1. Log into your website admin area
2. Click "Create New Article"
3. Write your content using the editor
4. Add images or videos if desired
5. Click "Publish" when ready

### **Editing an Existing Article**
1. Find the article in your admin area
2. Click "Edit"
3. Make your changes
4. Click "Save" to update

### **Adding Images to Articles**
1. In the article editor, click the image icon
2. Choose "Upload Image" or "Select from Library"
3. Select your image file
4. Add alt text for accessibility
5. Click "Insert"

### **Embedding YouTube Videos**
1. Copy the YouTube video URL
2. In the article editor, click the video icon
3. Paste the URL
4. The video will automatically embed

### **Editing the Welcome Page**
1. Log into the admin dashboard
2. Click **Welcome Page** under Quick Actions
3. Edit each section (mission, hero text, testimony, etc.)
4. Click **Save Welcome Page**
5. Visitors see changes on the welcome page; search engines get an updated page after the automatic rebuild

See **[Content Management — Editing the Welcome Page](./content-management.md#editing-the-welcome-page)** for full details.

### **Contact Form Messages**
- Visitor messages are emailed **directly to Hatun** (ministry contact form inbox)
- The website does **not** store message text in the database (only a timestamp for dashboard counts)
- **Nobody monitors Hatun's inbox** — that would violate visitor privacy. Hatun is the front line for contact mail.
- Hatun should use **Reply** in her email app to respond to genuine visitors
- **Do not click unexpected links** in message bodies — treat them like any other email
- **At the bottom of each contact form email**, Hatun can click **Report suspicious** or **Report solicitation / spam** to email the current website developer (see [Contact Form — Privacy and Reporting](./contact-form-privacy-and-reporting.md))
- Website **problem reports** (separate form) still go to the technical admin inbox

### **When Hatun Should Report to the Site Manager**

**For a specific suspicious message:** use the links at the bottom of that contact form email (easiest).

**For general issues** (spam volume, form broken, etc.), email the **technical admin address** in `config/site-contacts.json` (`technicalAdminEmail`). Use subject **`Urgent: Hatun Website Question`** when it is urgent.

Hatun cannot expect the developer to see spam or abuse in the admin panel. Report when:

- Spam volume increases noticeably
- A message looks like phishing, a scam, or a threat
- A visitor says the contact form will not submit (VPN users may hit rate limits)
- She clicked something suspicious in a message
- Anything feels like a security problem

She does **not** need to report every normal message. Full training guide: **[Contact Form — Privacy and Reporting](./contact-form-privacy-and-reporting.md)** (share this with Hatun).

## 📊 Understanding Your Website

### **Visitor Statistics**
- **Page Views**: How many people visit your pages
- **Unique Visitors**: How many different people visit
- **Popular Content**: Which articles get the most attention
- **Traffic Sources**: Where your visitors come from

### **Content Performance**
- **Most Read Articles**: Your most popular content
- **Engagement**: How long people stay on your site
- **Social Shares**: How often your content is shared
- **Search Rankings**: How well your site appears in Google

## 🔒 Security & Privacy

### **What's Protected**
- **Your Content**: All articles and media are backed up
- **Visitor Data**: Contact form message bodies are not stored in Firestore; only submission timestamps for counts
- **Contact Form**: Server-side spam filters, disposable-email blocking, link limits, and rate limiting — **no Google reCAPTCHA and no VPN blocking**, so visitors in restrictive countries can still reach you (see [Contact Form — Privacy and Reporting](./contact-form-privacy-and-reporting.md))
- **Website Access**: Only authorized users can make changes
- **Payment Information**: If you add online giving, it's secure

### **The Privacy Tradeoff (Contact Form)**
We chose **not** to store full messages in the database (even though that would help fight spam in an admin panel) because a breach or wrong access would expose private correspondence. We also **cannot** have the site manager read Hatun's inbox — that is private ministry mail. The workable model: Hatun reports problems; the developer adjusts server-side filters.
### **What You Should Do**
- **Strong Passwords**: Use unique, strong passwords
- **Regular Updates**: Keep your login information current
- **Monitor Activity**: Check for unusual activity
- **Report Issues**: Let your developer know about any problems

## 📞 Getting Help

### **When to Contact Your Developer**
- **Website Down**: Site is completely inaccessible
- **Can't Log In**: Unable to access admin area
- **Content Issues**: Articles not displaying correctly
- **Performance Problems**: Site is very slow
- **Security Concerns**: Suspicious activity or errors

### **When to Wait or Try Yourself**
- **Minor Display Issues**: Small formatting problems
- **Slow Loading**: Site takes a few extra seconds to load
- **Content Updates**: Want to change article content
- **Media Uploads**: Adding new images or videos

### **Emergency Contacts**
- **Primary Developer**: [Your Developer's Contact Info]
- **Backup Support**: [Alternative Developer Contact]
- **Hosting Support**: Firebase Support (automatic)
- **Domain Support**: Your domain provider's support

## 📋 Maintenance Checklist

### **Weekly Tasks**
- [ ] Check website is working properly
- [ ] Review new content from YouTube
- [ ] Monitor visitor statistics
- [ ] Check for any error messages

### **Monthly Tasks**
- [ ] Review content performance
- [ ] Update any outdated information
- [ ] Check website speed
- [ ] Review security status

### **Quarterly Tasks**
- [ ] Plan content strategy
- [ ] Review website goals
- [ ] Check for new features
- [ ] Update contact information

## 🎯 Success Metrics

### **What Success Looks Like**
- **More Visitors**: Increasing website traffic
- **Better Engagement**: People spending more time on your site
- **Content Growth**: Regular new articles and updates
- **Community Building**: More interaction and comments
- **Ministry Impact**: Website helps achieve ministry goals

### **How to Measure Success**
- **Track Statistics**: Monitor visitor numbers and engagement
- **Gather Feedback**: Ask visitors what they think
- **Set Goals**: Have specific targets for growth
- **Celebrate Wins**: Acknowledge when things are working well

## 🚀 Future Planning

### **Short Term (3-6 months)**
- **Content Building**: Create more articles and resources
- **Visitor Growth**: Increase website traffic
- **Community Engagement**: Build interaction with visitors

### **Long Term (6-12 months)**
- **Feature Expansion**: Add new website capabilities
- **Mobile App**: Consider creating a mobile app
- **Integration**: Connect with other ministry tools
- **Automation**: Further reduce manual work

## 📚 Additional Resources

### **Helpful Links**
- **YouTube Creator Studio**: [studio.youtube.com](https://studio.youtube.com)
- **Firebase Console**: [console.firebase.google.com](https://console.firebase.google.com)
- **Website Analytics**: Check your admin dashboard

### **Learning Resources**
- **Content Creation**: Tips for writing engaging articles
- **Video Production**: Making better YouTube videos
- **Digital Ministry**: Using technology for ministry

---

## 🆘 Emergency Quick Reference

**Website Down?**
1. Check your email for notifications
2. Try accessing from a different device
3. Contact your developer immediately
4. Use social media to inform your community

**Can't Log In?**
1. Check your password
2. Try resetting your password
3. Contact your developer for help
4. Don't share your login information

**Need New Developer?**
1. Share this documentation folder
2. Provide all access credentials
3. Explain your project goals
4. Set clear expectations and timeline

---

**Remember: This website is designed to work for you, not against you. Most things happen automatically, and when you need help, your developer is here to support you.**

**Last Updated**: June 2026  
**Next Review**: [3 months from now]  
**Contact**: [Your Developer's Information] 
