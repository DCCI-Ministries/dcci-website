# Contact Form Setup Guide

This guide will help you set up the contact form feature for the DCCI Ministries website.

## What's Been Added

### 1. Contact Form Component
- **Location:** `src/app/components/contact-form.component.*`
- **Features:** 
  - Responsive design with Ionic components
  - Form validation (required fields, email format, minimum lengths)
  - Success/error messaging
  - Accessible design with proper ARIA labels
  - Dark mode support
  - **Honeypot protection** against basic bots

### 2. Contact Service
- **Location:** `src/app/services/contact.service.ts`
- **Purpose:** Handles form submission and communicates with Firebase Functions

### 3. Firebase Functions
- **Location:** `functions/` directory
- **Purpose:** Receives form submissions and sends emails to hatun@dcciministries.com
- **Email Format:** Subject will be "Contact Form: {user_subject}" for easy sorting

### 4. Integration
- Contact form has been added to the home page above the social media section
- Form styling matches the existing site theme

## Setup Steps

### Step 1: Install Firebase Functions Dependencies
```bash
cd functions
npm install
```

### Step 2: Configure Email Credentials
You need to set up Gmail credentials for sending emails. **Important:** Use an App Password, not your regular password.

#### Generate Gmail App Password:
1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Enable 2-Factor Authentication if not already enabled
3. Go to Security → App Passwords
4. Generate a new app password for "Mail"
5. Copy the generated password

#### Set Firebase Config:
```bash
# Set sender email credentials (Gmail / Google Workspace)
firebase functions:config:set mail.user="your-email@gmail.com"
firebase functions:config:set mail.pass="your-app-password"

# Set recipient email — who receives contact form submissions (see "Email Routing" below)
firebase functions:config:set mail.to="admin@accessiblewebmedia.com"
```

**Note:** The code reads `mail.user`, `mail.pass`, and `mail.to` from Firebase config (see `functions/src/index.ts`). There is no `contact.email` — use `mail.to` for the recipient.

### Step 3: Build and Deploy Functions
```bash
# From project root
npm run deploy:functions
```

Or manually:
```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

### Step 4: Update Environment Configuration
Update your environment files with the Firebase Functions URL:

```typescript
// src/environments/environment.ts
export const environment = {
  // ... existing config
  firebaseFunctionsUrl: "https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net"
};
```

Replace `YOUR_PROJECT_ID` with your actual Firebase project ID and `us-central1` with your preferred region.

## Testing the Contact Form

### 1. Local Testing
```bash
# Start the development server
npm start

# In another terminal, test the Firebase Function locally
cd functions
npm run serve
```

### 2. Test the Form
1. Navigate to the home page
2. Fill out the contact form
3. Submit the form
4. Check that you receive an email at hatun@dcciministries.com

### 3. Test the Firebase Function
Visit: `https://[region]-[project-id].cloudfunctions.net/testContactForm`

## Email Configuration

### Recipient Email Addresses
The contact form sends all submissions to a **single** recipient configured in Firebase:

- **Config key:** `mail.to` (set via `firebase functions:config:set mail.to="..."`)
- There is no per-environment recipient in code — you control it by what you set in Firebase config for each project/environment.

Typical choices:

- **Development/Staging**: e.g. `admin@accessiblewebmedia.com` (your own inbox for testing)
- **Production**: Either the real recipient (e.g. `hatun@dcciministries.com`) or, for the “shield” setup below, the monitor’s inbox

### Email Routing: Shield / Monitor Setup

Contact form emails are sent by **Firebase Cloud Functions** using **Gmail SMTP** (nodemailer). The recipient is whatever you set in `mail.to`. Routing happens entirely in Firebase + Gmail; Cloudflare (if used) is in front of the website only, not in the email path.

**Current design (shield for the real recipient):**  
Emails are routed to an **admin/monitor inbox** (e.g. `admin@accessiblewebmedia.com`) instead of the real recipient’s personal address. That way:

- The monitor can review submissions for spam/scams before anything reaches the real recipient.
- The real recipient’s email stays private and is not exposed on the public form or in logs.

This is often combined with **Google Workspace** for the monitor inbox (labels, filters, forwarding rules, etc.). The actual “where it goes” is still controlled by `mail.to` in Firebase config.

**Options for future developers:**

1. **Remove the shield** — Send straight to the real recipient: set `mail.to` to their address (e.g. `hatun@dcciministries.com`), redeploy functions, and optionally remove or simplify any forwarding rules in Google Workspace.
2. **Keep monitoring, different monitor** — Route to your own email: set `mail.to` to your inbox, redeploy, and use your own filters/forwarding.
3. **Change in code** — To support multiple recipients, env-specific recipients, or more complex logic, edit `functions/src/index.ts` (the `submitContactForm` handler). The recipient is currently `const to = functions.config().mail.to`; you can replace or extend that with your own logic and redeploy.

### Email Format
When someone submits the contact form, the configured recipient will receive an email with:

- **From:** Your configured Gmail address
- **To:** Environment-specific email address
- **Subject:** "Contact Form: {user_subject}"
- **Body:** 
  ```
  New contact form submission from DCCI Ministries website:
  
  Name: [User's Name]
  Email: [User's Email]
  Subject: [User's Subject]
  
  Message:
  [User's Message]
  
  ---
  This email was sent from the DCCI Ministries contact form.
  Submitted on: [Timestamp]
  ```

## Security Features

- **Input Validation:** All fields are validated on both client and server
- **Email Validation:** Proper email format validation
- **Honeypot Protection:** Hidden field to catch basic bots
- **CORS Protection:** Configured for web requests
- **Rate Limiting:** Firebase Functions built-in protection + IP logging
- **Security Headers:** XSS protection, frame options, content type options
- **Secure Credentials:** Stored in Firebase Config, not in code

## Troubleshooting

### Common Issues

1. **"Failed to send message" error**
   - Check Firebase Functions logs: `firebase functions:log`
   - Verify email credentials are set correctly
   - Ensure Gmail App Password is valid

2. **CORS errors**
   - Make sure functions are deployed: `firebase deploy --only functions`
   - Check the function URL in your environment config

3. **Form not submitting**
   - Check browser console for errors
   - Verify the contact service is properly injected
   - Check network tab for failed requests

### Debugging Steps

1. **Check Firebase Functions Logs:**
   ```bash
   firebase functions:log
   ```

2. **Test Function Locally:**
   ```bash
   cd functions
   npm run serve
   ```

3. **Verify Environment Config:**
   - Check `firebaseFunctionsUrl` in environment files
   - Ensure the URL matches your deployed function

## Customization

### Styling
- Modify `src/app/components/contact-form.component.scss`
- Uses CSS custom properties for theming
- Responsive design with mobile-first approach

### Form Fields
- Add/remove fields in `contact-form.component.ts`
- Update validation rules as needed
- Modify the Firebase Function to handle new fields

### Email Template
- Customize email format in `functions/src/index.ts`
- Modify the `emailBody` template
- Add additional email recipients if needed

## Deployment

The contact form is automatically included when you deploy the main application:

```bash
# Deploy everything
npm run deploy:production

# Or deploy just the functions
npm run deploy:functions
```

## Support

If you encounter issues:
1. Check the Firebase Functions logs
2. Verify all environment variables are set
3. Test the function locally first
4. Check the browser console for client-side errors

## Notes

- The form automatically resets after successful submission
- All submissions are logged to Firebase Functions logs
- The email subject format helps Hatun sort contact form emails
- The form is fully accessible and follows WCAG guidelines
- Dark mode support is included for better user experience 
