import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin-guard';
import { adminOnlyGuard } from './guards/admin-only-guard';
import { maintenanceGuard } from './guards/maintenance-guard';

export const routes: Routes = [
  {
    path: 'admin/maintenance',
    loadComponent: () => import('./admin/maintenance/maintenance.page').then((m) => m.MaintenancePage)
  },
  {
    path: '',
    redirectTo: 'welcome',
    pathMatch: 'full',
  },
  {
    path: 'home',
    redirectTo: 'welcome',
    pathMatch: 'full'
  },
  {
    path: 'welcome',
    loadComponent: () => import('./welcome/welcome.page').then( m => m.WelcomePage),
    canActivate: [maintenanceGuard]
  },
  {
    path: 'auth/action',
    loadComponent: () => import('./auth/action/action.page').then( m => m.ActionPage),
    canActivate: [maintenanceGuard]
  },
  {
    path: 'admin/login',
    loadComponent: () => import('./admin/login/login.page').then( m => m.LoginPage),
    canActivate: [maintenanceGuard]
  },
  {
    path: 'admin/verify-email',
    loadComponent: () => import('./admin/verify-email/verify-email.page').then( m => m.VerifyEmailPage),
    canActivate: [maintenanceGuard]
  },
  {
    path: 'admin/dashboard',
    loadComponent: () => import('./admin/dashboard/dashboard.page').then( m => m.DashboardPage),
    canActivate: [maintenanceGuard, adminGuard]
  },
  {
    path: 'admin/forgot-password',
    loadComponent: () => import('./admin/forgot-password/forgot-password.page').then( m => m.ForgotPasswordPage),
    canActivate: [maintenanceGuard]
  },
  {
    path: 'admin/reset-password',
    loadComponent: () => import('./admin/reset-password/reset-password.page').then( m => m.ResetPasswordPage),
    canActivate: [maintenanceGuard]
  },
  {
    path: 'admin/verification-required',
    loadComponent: () => import('./admin/verification-required/verification-required.page').then( m => m.VerificationRequiredPage),
    canActivate: [maintenanceGuard]
  },
  {
    path: 'admin/content/create',
    loadComponent: () => import('./admin/content/create-content/create-content.page').then( m => m.CreateContentPage),
    canActivate: [maintenanceGuard, adminOnlyGuard]
  },
  {
    path: 'admin/content/archive',
    loadComponent: () => import('./admin/content/create-content/create-content.page').then( m => m.CreateContentPage),
    canActivate: [maintenanceGuard, adminOnlyGuard]
  },
  {
    path: 'admin/content/manage',
    loadComponent: () => import('./admin/content/manage-content/manage-content.page').then( m => m.ManageContentPage),
    canActivate: [maintenanceGuard, adminOnlyGuard]
  },
  {
    path: 'admin/content/drafts',
    loadComponent: () => import('./admin/content/drafts/drafts.page').then( m => m.DraftsPage),
    canActivate: [maintenanceGuard, adminOnlyGuard]
  },
  {
    path: 'admin/content/published',
    loadComponent: () => import('./admin/content/published/published.page').then( m => m.PublishedPage),
    canActivate: [maintenanceGuard, adminOnlyGuard]
  },
  {
    path: 'admin/content/edit/:id',
    loadComponent: () => import('./admin/content/create-content/create-content.page').then( m => m.CreateContentPage),
    canActivate: [maintenanceGuard, adminOnlyGuard]
  },
  {
    path: 'admin/youtube-settings',
    loadComponent: () => import('./admin/youtube-settings/youtube-settings.page').then( m => m.YouTubeSettingsPage),
    canActivate: [maintenanceGuard, adminGuard]
  },
  {
    path: 'admin/user-management',
    loadComponent: () => import('./admin/user-management/user-management.page').then( m => m.UserManagementPage),
    canActivate: [maintenanceGuard, adminOnlyGuard]
  },
  {
    path: 'admin/emergency-controls',
    loadComponent: () => import('./admin/emergency-controls/emergency-controls.page').then( m => m.EmergencyControlsPage),
    canActivate: [maintenanceGuard, adminOnlyGuard]
  },
  {
    path: 'article/:slug',
    loadComponent: () => import('./article/article.page').then( m => m.ArticlePage),
    canActivate: [maintenanceGuard]
  },
  {
    path: 'articles',
    loadComponent: () => import('./articles/articles.page').then( m => m.ArticlesPage),
    canActivate: [maintenanceGuard]
  },
  {
    path: 'archives',
    loadComponent: () => import('./archives/archives.page').then( m => m.ArchivesPage),
    canActivate: [maintenanceGuard]
  },
  {
    path: 'contact',
    loadComponent: () => import('./contact/contact.page').then( m => m.ContactPage),
    canActivate: [maintenanceGuard]
  },
  {
    path: 'report-problem',
    loadComponent: () => import('./report-problem/report-problem.page').then( m => m.ReportProblemPage),
    canActivate: [maintenanceGuard]
  },
  {
    path: 'privacy',
    loadComponent: () => import('./privacy/privacy.page').then( m => m.PrivacyPage),
    canActivate: [maintenanceGuard]
  },
  {
    path: 'privacy-policy',
    redirectTo: 'privacy',
    pathMatch: 'full'
  },
  {
    path: 'terms',
    loadComponent: () => import('./terms/terms.page').then( m => m.TermsPage),
    canActivate: [maintenanceGuard]
  },
  {
    path: 'terms-of-use',
    redirectTo: 'terms',
    pathMatch: 'full'
  },
  {
    path: 'disclaimer',
    loadComponent: () => import('./disclaimer/disclaimer.page').then( m => m.DisclaimerPage),
    canActivate: [maintenanceGuard]
  },
  {
    path: 'accessibility',
    loadComponent: () => import('./accessibility/accessibility.page').then( m => m.AccessibilityPage),
    canActivate: [maintenanceGuard]
  },
  {
    path: 'unsubscribe',
    loadComponent: () => import('./unsubscribe/unsubscribe.page').then( m => m.UnsubscribePage),
    canActivate: [maintenanceGuard]
  },

];
