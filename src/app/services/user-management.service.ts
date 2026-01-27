import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, doc, getDocs, getDoc, updateDoc, query, orderBy } from '@angular/fire/firestore';
import { Auth as FirebaseAuth } from '@angular/fire/auth';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService, AdminUser } from './auth';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
  // Allowed emails for user management access (extra security layer)
  // These emails can access User Management even if they're admins in Firestore
  private readonly ALLOWED_EMAILS = ['admin@accessiblewebmedia.com', 'hatun@dcciministries.com'];

  constructor(
    private firestore: Firestore,
    private injector: Injector,
    private authService: AuthService,
    private auth: FirebaseAuth,
    private http: HttpClient
  ) {}

  /**
   * Check if current user is allowed to access user management
   */
  async isAllowedToManageUsers(): Promise<boolean> {
    const user = await firstValueFrom(this.authService.currentUser$);
    if (!user || !user.isAdmin) {
      return false;
    }
    
    // Extra security: only specific emails can access
    return this.ALLOWED_EMAILS.includes(user.email);
  }

  /**
   * Get all users from Firestore
   */
  async getAllUsers(): Promise<AdminUser[]> {
    return await runInInjectionContext(this.injector, async () => {
      try {
        const usersRef = collection(this.firestore, 'adminUsers');
        // Try to order by createdAt, but handle case where it might not exist
        let q;
        try {
          q = query(usersRef, orderBy('createdAt', 'desc'));
        } catch (e) {
          // If orderBy fails (e.g., no index), just get all users
          q = query(usersRef);
        }
        const querySnapshot = await getDocs(q);
        
        const users: AdminUser[] = [];
        const currentUser = this.auth.currentUser;
        
        querySnapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data() as any;
          let createdAt: Date;
          if (data.createdAt) {
            if (data.createdAt.toDate && typeof data.createdAt.toDate === 'function') {
              createdAt = data.createdAt.toDate();
            } else if (data.createdAt instanceof Date) {
              createdAt = data.createdAt;
            } else {
              createdAt = new Date(data.createdAt);
            }
          } else {
            createdAt = new Date();
          }
          
          let lastLoginAt: Date | undefined;
          if (data.lastLoginAt) {
            if (data.lastLoginAt.toDate && typeof data.lastLoginAt.toDate === 'function') {
              lastLoginAt = data.lastLoginAt.toDate();
            } else if (data.lastLoginAt instanceof Date) {
              lastLoginAt = data.lastLoginAt;
            } else {
              lastLoginAt = new Date(data.lastLoginAt);
            }
          }
          
          // Get emailVerified from Firebase Auth if available (for current user only)
          // Otherwise use Firestore value
          let emailVerified = data.emailVerified === true;
          if (currentUser && currentUser.email === data.email) {
            emailVerified = currentUser.emailVerified;
            // Sync current user's verified status to Firestore
            if (currentUser.emailVerified && !data.emailVerified) {
              updateDoc(doc(this.firestore, 'adminUsers', docSnapshot.id), {
                emailVerified: true
              }).catch(err => console.error('Error syncing emailVerified:', err));
            }
          }
          
          const user: AdminUser = {
            uid: docSnapshot.id,
            email: data.email,
            isAdmin: data.isAdmin === true,
            userRole: data.userRole !== undefined && data.userRole !== null ? data.userRole : null,
            emailVerified,
            createdAt,
            lastLoginAt
          };
          users.push(user);
        });
        
        // Sort by createdAt if orderBy didn't work
        users.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
        return users;
      } catch (error) {
        console.error('Error getting users:', error);
        throw error;
      }
    });
  }

  /**
   * Update user role
   * When setting role to "Admin" or "Moderator", updates both isAdmin and userRole
   * When setting role to "Pending" or null, sets isAdmin to false
   */
  async updateUserRole(userId: string, role: 'Pending' | 'Admin' | 'Moderator' | null): Promise<void> {
    return await runInInjectionContext(this.injector, async () => {
      try {
        const userRef = doc(this.firestore, 'adminUsers', userId);
        
        // If role is "Admin" or "Moderator", set both isAdmin and userRole
        // If role is "Pending" or null, set isAdmin to false and update userRole
        const updateData: any = {
          userRole: role
        };
        
        if (role === 'Admin' || role === 'Moderator') {
          updateData.isAdmin = true;
        } else {
          updateData.isAdmin = false;
        }
        
        await updateDoc(userRef, updateData);
      } catch (error) {
        console.error('Error updating user role:', error);
        throw error;
      }
    });
  }

  /**
   * Delete a user from both Firebase Auth and Firestore
   * Calls a Cloud Function to handle the deletion (requires Admin SDK)
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      // Get current user's auth token
      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        throw new Error('Not authenticated');
      }

      // Get ID token for authentication
      const idToken = await currentUser.getIdToken(true); // Force refresh to ensure valid token

      // Call Cloud Function to delete user from both Auth and Firestore
      const response = await firstValueFrom(
        this.http.post<{ success: boolean; message: string; userId: string }>(
          `${environment.firebaseFunctionsUrl}/deleteUser`,
          { userId },
          {
            headers: new HttpHeaders({
              'Authorization': `Bearer ${idToken}`,
              'Content-Type': 'application/json'
            })
          }
        )
      );

      if (!response.success) {
        throw new Error(response.message || 'Failed to delete user');
      }
    } catch (error: any) {
      console.error('Error deleting user:', error);
      // If it's an HTTP error, extract the error message
      if (error.error && error.error.error) {
        throw new Error(error.error.error);
      }
      throw error;
    }
  }
}
