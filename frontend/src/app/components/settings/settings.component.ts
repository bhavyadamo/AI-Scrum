import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { SettingsService } from '../../services/settings.service';
import { SettingsDto, UserRole } from '../../models/settings.model';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  loading = {
    settings: false,
    userRoles: false,
    azureDevOps: false,
    aiModel: false
  };
  
  error = {
    settings: '',
    userRoles: '',
    azureDevOps: '',
    aiModel: ''
  };

  // Role options for demo purposes
  roleOptions = [
    { value: UserRole.Admin, label: 'Admin' },
    { value: UserRole.ScrumMaster, label: 'Scrum Master' },
    { value: UserRole.Member, label: 'Member' }
  ];

  // For demo/testing - allow changing current user role
  demoUserRole = UserRole.Admin;

  constructor(
    public authService: AuthService,
    private settingsService: SettingsService
  ) { }

  ngOnInit(): void {
    // Initialize with current user role
    const currentUser = this.authService.currentUserValue;
    if (currentUser) {
      this.demoUserRole = currentUser.role;
    }
  }

  // For demo purposes - change current user role
  changeUserRole(): void {
    this.authService.changeUserRole(this.demoUserRole);
  }
} 