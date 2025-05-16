import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { SettingsService } from '../../../services/settings.service';
import { UserRole, UserRoleDto, UpdateUserRoleRequest } from '../../../models/settings.model';

@Component({
  selector: 'app-user-roles',
  templateUrl: './user-roles.component.html',
  styleUrls: ['./user-roles.component.scss']
})
export class UserRolesComponent implements OnInit {
  userRoles: UserRoleDto[] = [];
  loading = false;
  error = '';
  success = '';
  defaultRole = UserRole.Member; // Default role for new users
  
  // Role options for dropdown
  roleOptions = [
    { value: UserRole.Admin, label: 'Admin' },
    { value: UserRole.ScrumMaster, label: 'Scrum Master' },
    { value: UserRole.Member, label: 'Member' },
    { value: UserRole.Viewer, label: 'Viewer' }
  ];

  constructor(
    public authService: AuthService,
    private settingsService: SettingsService,
    private fb: FormBuilder
  ) { }

  ngOnInit(): void {
    this.loadUserRoles();
    this.loadDefaultRole();
  }

  loadUserRoles(): void {
    if (!this.authService.canViewUserRoles()) {
      this.error = 'You do not have permission to view user roles';
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    this.settingsService.getUserRoles().subscribe({
      next: (roles) => {
        this.userRoles = roles;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading user roles:', err);
        this.error = err.message || 'Failed to load user roles';
        this.loading = false;
      }
    });
  }

  loadDefaultRole(): void {
    // Load default role from settings service or localStorage
    const savedDefaultRole = localStorage.getItem('defaultUserRole');
    if (savedDefaultRole) {
      this.defaultRole = savedDefaultRole as UserRole;
    }
  }

  saveDefaultRole(): void {
    if (!this.authService.canEditUserRoles()) {
      this.error = 'You do not have permission to change default role';
      return;
    }

    this.loading = true;
    this.error = '';
    
    // Save to localStorage for demo purposes
    localStorage.setItem('defaultUserRole', this.defaultRole);
    
    // Simulate API call
    setTimeout(() => {
      this.loading = false;
      this.success = `Default role has been set to ${this.defaultRole}`;
    }, 500);
  }

  saveAllRoles(): void {
    if (!this.authService.canEditUserRoles()) {
      this.error = 'You do not have permission to change user roles';
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    // Simulate an API call with a timeout
    setTimeout(() => {
      this.loading = false;
      this.success = 'Successfully saved all role changes';
    }, 800);
  }

  updateUserRole(user: UserRoleDto, newRole: UserRole): void {
    if (!this.authService.canEditUserRoles()) {
      this.error = 'You do not have permission to change user roles';
      return;
    }

    if (user.role === newRole) {
      return; // No change needed
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    const request: UpdateUserRoleRequest = {
      userId: user.userId,
      role: newRole
    };

    this.settingsService.updateUserRole(request).subscribe({
      next: () => {
        user.role = newRole; // Update locally
        this.success = `Successfully updated ${user.userName}'s role to ${newRole}`;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error updating user role:', err);
        this.error = err.message || 'Failed to update user role';
        this.loading = false;
      }
    });
  }

  getRoleBadgeClass(role: UserRole): string {
    switch (role) {
      case UserRole.Admin:
        return 'badge bg-danger';
      case UserRole.ScrumMaster:
        return 'badge bg-warning text-dark';
      case UserRole.Member:
        return 'badge bg-info text-dark';
      case UserRole.Viewer:
        return 'badge bg-secondary';
      default:
        return 'badge bg-secondary';
    }
  }
} 