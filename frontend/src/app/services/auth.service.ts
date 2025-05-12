import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { UserRole } from '../models/settings.model';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  token?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // For demo purposes, we'll use a mock user
  private currentUserSubject = new BehaviorSubject<UserProfile | null>({
    id: 'current-user',
    name: 'Demo User',
    email: 'demo@example.com',
    role: UserRole.Admin, // Set as Admin for demo purposes
  });

  public currentUser$: Observable<UserProfile | null> = this.currentUserSubject.asObservable();

  constructor() { }

  public get currentUserValue(): UserProfile | null {
    return this.currentUserSubject.value;
  }

  public isAuthenticated(): boolean {
    return !!this.currentUserSubject.value;
  }

  public hasRole(role: UserRole): boolean {
    const user = this.currentUserSubject.value;
    if (!user) return false;
    
    return user.role === role;
  }

  public isAdmin(): boolean {
    return this.hasRole(UserRole.Admin);
  }

  public isScrumMaster(): boolean {
    return this.hasRole(UserRole.ScrumMaster);
  }

  public isMember(): boolean {
    return this.hasRole(UserRole.Member);
  }

  public canEditUserRoles(): boolean {
    return this.isAdmin();
  }

  public canViewUserRoles(): boolean {
    return this.isAdmin() || this.isScrumMaster();
  }

  public canEditAzureDevOpsPat(): boolean {
    return this.isAdmin();
  }

  public canViewAzureDevOpsPat(): boolean {
    return this.isAdmin() || this.isScrumMaster();
  }

  public canEditAiModelSettings(): boolean {
    return this.isAdmin() || this.isScrumMaster();
  }

  public canViewAiModelSettings(): boolean {
    return true; // All roles can view
  }

  // For demo purposes, this method allows changing the current user's role
  public changeUserRole(role: UserRole): void {
    const user = this.currentUserSubject.value;
    if (user) {
      user.role = role;
      this.currentUserSubject.next(user);
    }
  }
} 