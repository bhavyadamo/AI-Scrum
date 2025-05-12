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
  
  // Role options for dropdown
  roleOptions = [
    { value: UserRole.Admin, label: 'Admin' },
    { value: UserRole.ScrumMaster, label: 'Scrum Master' },
    { value: UserRole.Member, label: 'Member' }
  ];

  constructor(
    public authService: AuthService,
    private settingsService: SettingsService,
    private fb: FormBuilder
  ) { }

  ngOnInit(): void {
    this.loadUserRoles();
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
        this.error = err.message || 'Failed to load user roles';
        this.loading = false;
      }
    });
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
      default:
        return 'badge bg-secondary';
    }
  }
} 