import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { SettingsService } from '../../services/settings.service';
import { SettingsDto, UserRole } from '../../models/settings.model';
import { TeamService } from '../../services/team.service';
import { TaskService } from '../../services/task.service';

// Interface for team member structure
interface TeamMember {
  id: string;
  displayName: string;
  selected: boolean;
  team?: string;
  email?: string;
  currentWorkload?: number;
}

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

  // Team Filters & Iteration Settings
  defaultIterationPath = 'Techoil\\2.3.23';
  enableTeamFilter = true;
  teamName = 'RND';
  teamMembers: TeamMember[] = [];
  loadingTeamMembers = false;
  teamMembersError = '';
  successMessage = '';

  constructor(
    public authService: AuthService,
    private settingsService: SettingsService,
    private teamService: TeamService,
    private taskService: TaskService
  ) { }

  ngOnInit(): void {
    // Initialize with current user role
    const currentUser = this.authService.currentUserValue;
    if (currentUser) {
      this.demoUserRole = currentUser.role;
    }

    // Load saved team filter settings
    this.loadTeamFilterSettings();
  }

  // For demo purposes - change current user role
  changeUserRole(): void {
    this.authService.changeUserRole(this.demoUserRole);
  }

  // Load team filter settings from local storage
  loadTeamFilterSettings(): void {
    const savedSettings = localStorage.getItem('teamFilterSettings');
    
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      
      this.enableTeamFilter = settings.enableTeamFilter ?? true;
      this.teamName = settings.teamName ?? 'RND';
      this.defaultIterationPath = settings.defaultIterationPath ?? 'Techoil\\2.3.23';
    }
  }

  // Load team members from the API
  loadTeamMembers(): void {
    this.loadingTeamMembers = true;
    this.teamMembersError = '';
    
    // Get previously saved settings with selected members
    const savedSettings = localStorage.getItem('teamFilterSettings');
    const savedMembers = savedSettings ? JSON.parse(savedSettings).selectedMembers || [] : [];
    
    console.log('Previously selected members:', savedMembers);
    
    // Construct query parameters for the API call
    const iterationPath = this.defaultIterationPath;
    const teamName = this.teamName;
    
    console.log(`Loading team members for team: ${teamName}, iteration: ${iterationPath}`);
    
    // Make the API call with the query parameters
    this.teamService.getTeamMembersByTeam(teamName, iterationPath).subscribe({
      next: (members: any[]) => {
        console.log('API Response for team members:', members);
        
        // Process the response
        this.teamMembers = members.map(m => {
          // Check if this member was previously selected
          const wasSelected = savedMembers.some((sm: any) => 
            sm.id === m.id || sm.displayName === m.displayName
          );
          
          return {
            id: m.id,
            displayName: m.displayName,
            team: m.team || 'RND Team',
            email: m.email || m.uniqueName || '',
            currentWorkload: m.currentWorkload || 0,
            selected: wasSelected // Mark as selected if previously selected
          };
        });
        
        console.log('Processed team members with selection state:', this.teamMembers);
        this.loadingTeamMembers = false;
      },
      error: (err) => {
        console.error('Error loading team members:', err);
        this.teamMembersError = 'Failed to load team members. Please try again.';
        this.loadingTeamMembers = false;
      }
    });
  }
  
  // Save team filter settings
  saveTeamFilterSettings(): void {
    // Get selected team members
    const selectedMembers = this.teamMembers
      .filter(m => m.selected)
      .map(m => ({
        id: m.id,
        displayName: m.displayName,
        team: m.team || 'RND Team',
        email: m.email
      }));
    
    console.log('Saving selected team members:', selectedMembers);
    
    // Create settings object
    const settings = {
      enableTeamFilter: this.enableTeamFilter,
      teamName: this.teamName,
      defaultIterationPath: this.defaultIterationPath,
      selectedMembers: selectedMembers
    };
    
    // Save to local storage
    localStorage.setItem('teamFilterSettings', JSON.stringify(settings));
    
    // Show success message
    this.successMessage = `Saved ${selectedMembers.length} team members successfully!`;
    setTimeout(() => {
      this.successMessage = '';
    }, 3000);
  }

  // Save iteration settings
  saveIterationSettings(): void {
    localStorage.setItem('defaultIterationPath', this.defaultIterationPath);
    
    // Show success message
    this.successMessage = 'Iteration settings saved successfully!';
    setTimeout(() => {
      this.successMessage = '';
    }, 3000);
  }

  // Get the count of selected team members
  getSelectedMembersCount(): number {
    return this.teamMembers.filter(m => m.selected).length;
  }
} 