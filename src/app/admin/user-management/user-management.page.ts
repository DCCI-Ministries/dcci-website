import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonItem,
  IonLabel,
    IonSelect,
    IonSelectOption,
    IonIcon,
    IonSpinner,
    IonChip,
    IonButton,
    ToastController,
  LoadingController,
  AlertController
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { AuthService, AdminUser } from '../../services/auth';
import { UserManagementService } from '../../services/user-management.service';
import { firstValueFrom } from 'rxjs';
import { UserRole, getRoleColor, getRoleDisplayName } from '../../models/user-roles';

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.page.html',
  styleUrls: ['./user-management.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonIcon,
    IonSpinner,
    IonChip,
    IonButton,
    CommonModule,
    FormsModule
  ]
})
export class UserManagementPage implements OnInit, OnDestroy {
  currentUser: AdminUser | null = null;
  users: AdminUser[] = [];
  isLoading = false;
  isSaving = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private userManagementService: UserManagementService,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private alertController: AlertController
  ) {}

  async ngOnInit() {
    const user = await firstValueFrom(this.authService.currentUser$);
    
    // Check if user exists
    if (!user) {
      await this.showToast('You must be logged in to access this page.', 'danger');
      this.router.navigate(['/admin/dashboard']);
      return;
    }
    
    // Check if user is admin with dashboard role
    if (!this.authService.isAdmin()) {
      await this.showToast('Access denied. Admin privileges required.', 'danger');
      this.router.navigate(['/admin/dashboard']);
      return;
    }
    
    // Check if email is verified
    if (!user.emailVerified) {
      await this.showToast('Access denied. Please verify your email address before accessing user management.', 'danger');
      this.router.navigate(['/admin/dashboard']);
      return;
    }
    
    // Extra security check: only allowed emails can access
    const isAllowed = await this.userManagementService.isAllowedToManageUsers();
    if (!isAllowed) {
      await this.showToast('Access denied. You do not have permission to manage users.', 'danger');
      this.router.navigate(['/admin/dashboard']);
      return;
    }
    
    this.currentUser = user;
    await this.loadUsers();
  }

  ngOnDestroy() {}

  async loadUsers() {
    this.isLoading = true;
    try {
      this.users = await this.userManagementService.getAllUsers();
    } catch (error) {
      console.error('Error loading users:', error);
      await this.showToast('Failed to load users', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  async onRoleChange(user: AdminUser, newRole: UserRole) {
    // Prevent changing your own role
    if (user.uid === this.currentUser?.uid) {
      await this.showToast('You cannot change your own role', 'warning');
      // Reset the dropdown value
      const userIndex = this.users.findIndex(u => u.uid === user.uid);
      if (userIndex !== -1) {
        this.users[userIndex].userRole = this.users[userIndex].userRole || 'Pending';
      }
      return;
    }

    // Don't update if role hasn't changed
    if (user.userRole === newRole) {
      return;
    }

    // Show confirmation for privileged role assignment
    if (newRole === 'SuperAdmin') {
      const alert = await this.alertController.create({
        header: 'Assign Super Admin Role',
        message: `Assign Super Admin to ${user.email}? This grants full access to every dashboard feature. Ministry lead (Hatun) should hold this role.`,
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => this.resetRoleDropdown(user)
          },
          {
            text: 'Assign Super Admin',
            handler: async () => {
              await this.updateUserRole(user, newRole);
            }
          }
        ]
      });
      await alert.present();
    } else if (newRole === 'Admin') {
      const alert = await this.alertController.create({
        header: 'Assign Admin Role',
        message: `Assign Admin to ${user.email}? This grants access to most dashboard features (content, welcome page, user management).`,
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => this.resetRoleDropdown(user)
          },
          {
            text: 'Assign Admin',
            handler: async () => {
              await this.updateUserRole(user, newRole);
            }
          }
        ]
      });
      await alert.present();
    } else if (newRole === 'Moderator') {
      const alert = await this.alertController.create({
        header: 'Assign Moderator Role',
        message: `Assign Moderator to ${user.email}? Limited dashboard access only (e.g. YouTube settings). Most admin tools stay hidden.`,
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => this.resetRoleDropdown(user)
          },
          {
            text: 'Assign Moderator',
            handler: async () => {
              await this.updateUserRole(user, newRole);
            }
          }
        ]
      });
      await alert.present();
    } else if (newRole === 'User') {
      const alert = await this.alertController.create({
        header: 'Assign User Role',
        message: `Assign User to ${user.email}? No dashboard access. Profiles and article comments are a future feature.`,
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => this.resetRoleDropdown(user)
          },
          {
            text: 'Assign User',
            handler: async () => {
              await this.updateUserRole(user, newRole);
            }
          }
        ]
      });
      await alert.present();
    } else {
      await this.updateUserRole(user, newRole);
    }
  }

  private resetRoleDropdown(user: AdminUser) {
    const userIndex = this.users.findIndex(u => u.uid === user.uid);
    if (userIndex !== -1) {
      this.users[userIndex].userRole = user.userRole || 'Pending';
    }
  }

  async updateUserRole(user: AdminUser, role: UserRole) {
    if (this.isSaving) return;

    this.isSaving = true;
    const loading = await this.loadingController.create({
      message: 'Updating user role...'
    });
    await loading.present();

    try {
      await this.userManagementService.updateUserRole(user.uid, role);
      await loading.dismiss();
      
      // Reload users to get fresh data from Firestore
      await this.loadUsers();
      
      await this.showToast('User role updated successfully', 'success');
    } catch (error) {
      await loading.dismiss();
      console.error('Error updating user role:', error);
      await this.showToast('Failed to update user role', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  getRoleDisplayName = getRoleDisplayName;
  getRoleColor = getRoleColor;

  async confirmDeleteUser(user: AdminUser) {
    // Prevent deleting yourself
    if (user.uid === this.currentUser?.uid) {
      await this.showToast('You cannot delete your own account', 'warning');
      return;
    }

    // Show strong warning about permanent deletion
    const alert = await this.alertController.create({
      header: '⚠️ DELETE USER',
      subHeader: 'This action is PERMANENT and IRREVERSIBLE',
      message: `You are about to permanently delete:\n\n${user.email}\n\nThis will:\n• Permanently remove all user data from the system\n• Delete the user's admin account\n• Remove all associated permissions and roles\n• Cannot be undone\n\n⚠️ WARNING: This action cannot be reversed!\n\nType "DELETE" below to confirm:`,
      inputs: [
        {
          name: 'confirmText',
          type: 'text',
          placeholder: 'Type DELETE to confirm',
          attributes: {
            required: true
          }
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: 'Delete Permanently',
          role: 'destructive',
          cssClass: 'danger-button',
          handler: async (data) => {
            // Require typing "DELETE" to confirm
            if (!data || !data.confirmText || data.confirmText.trim() !== 'DELETE') {
              // Show error message
              const errorAlert = await this.alertController.create({
                header: 'Confirmation Required',
                message: 'You must type "DELETE" exactly to confirm deletion.',
                buttons: ['OK']
              });
              await errorAlert.present();
              return false; // Keep the dialog open
            }
            
            // Proceed with deletion
            await this.deleteUser(user);
            return true;
          }
        }
      ],
      cssClass: 'delete-user-alert'
    });

    await alert.present();
  }

  async deleteUser(user: AdminUser) {
    if (this.isSaving) return;

    // Double-check: prevent deleting yourself
    if (user.uid === this.currentUser?.uid) {
      await this.showToast('You cannot delete your own account', 'warning');
      return;
    }

    this.isSaving = true;
    const loading = await this.loadingController.create({
      message: 'Deleting user...'
    });
    await loading.present();

    try {
      await this.userManagementService.deleteUser(user.uid);
      await loading.dismiss();
      
      // Reload users to get fresh data from Firestore
      await this.loadUsers();
      
      await this.showToast(`User ${user.email} has been permanently deleted`, 'success');
    } catch (error) {
      await loading.dismiss();
      console.error('Error deleting user:', error);
      await this.showToast('Failed to delete user', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'top'
    });
    await toast.present();
  }
}

