import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { SettingsService } from '../../../services/settings.service';
import { AzureDevOpsSettingsDto } from '../../../models/settings.model';

@Component({
  selector: 'app-azure-devops-settings',
  templateUrl: './azure-devops-settings.component.html',
  styleUrls: ['./azure-devops-settings.component.scss']
})
export class AzureDevOpsSettingsComponent implements OnInit {
  settings: AzureDevOpsSettingsDto | null = null;
  azureDevOpsForm: FormGroup;
  loading = false;
  error = '';
  success = '';
  showPat = false;
  testConnectionStatus: 'success' | 'error' | null = null;
  testConnectionMessage = '';

  constructor(
    public authService: AuthService,
    private settingsService: SettingsService,
    private fb: FormBuilder
  ) {
    this.azureDevOpsForm = this.fb.group({
      organizationUrl: ['', [
        Validators.required, 
        Validators.pattern(/^https:\/\/dev\.azure\.com\/[\w-]+\/?$/)
      ]],
      personalAccessToken: ['', [Validators.required, Validators.minLength(20)]],
      projectName: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    if (!this.authService.canViewAzureDevOpsPat()) {
      this.error = 'You do not have permission to view Azure DevOps settings';
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    this.settingsService.getAzureDevOpsSettings().subscribe({
      next: (settings) => {
        this.settings = settings;
        
        // If the user can edit, populate the form
        if (this.authService.canEditAzureDevOpsPat() && settings) {
          this.azureDevOpsForm.patchValue({
            organizationUrl: settings.organizationUrl || `https://dev.azure.com/${settings.organization || ''}`,
            personalAccessToken: settings.personalAccessToken || '',
            projectName: settings.project || ''
          });
        }
        
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to load Azure DevOps settings';
        this.loading = false;
        
        // For demo purposes, create mock data if API fails
        if (!this.settings) {
          this.createMockSettings();
        }
      }
    });
  }

  saveAzureDevOpsSettings(): void {
    if (!this.authService.canEditAzureDevOpsPat()) {
      this.error = 'You do not have permission to update Azure DevOps settings';
      return;
    }

    if (this.azureDevOpsForm.invalid) {
      // Mark all fields as touched to trigger validation messages
      Object.keys(this.azureDevOpsForm.controls).forEach(key => {
        const control = this.azureDevOpsForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    const formValues = this.azureDevOpsForm.value;
    
    // Extract organization from URL
    const orgUrl = formValues.organizationUrl;
    const orgMatch = orgUrl.match(/^https:\/\/dev\.azure\.com\/([\w-]+)\/?$/);
    const organization = orgMatch ? orgMatch[1] : '';

    const settings = {
      organization: organization,
      organizationUrl: formValues.organizationUrl,
      project: formValues.projectName,
      personalAccessToken: formValues.personalAccessToken
    };

    // In a real app, you would send this to the backend
    // For demo purposes, store in localStorage
    localStorage.setItem('azureDevOpsSettings', JSON.stringify(settings));
    
    // Simulate API call with timeout
    setTimeout(() => {
      this.settings = settings as AzureDevOpsSettingsDto;
      this.success = 'Azure DevOps settings saved successfully';
      this.loading = false;
    }, 800);
  }

  testConnection(): void {
    if (this.azureDevOpsForm.invalid) {
      // Mark all fields as touched to trigger validation messages
      Object.keys(this.azureDevOpsForm.controls).forEach(key => {
        const control = this.azureDevOpsForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    this.loading = true;
    this.testConnectionStatus = null;
    this.testConnectionMessage = '';
    this.error = '';
    this.success = '';

    // Simulate API call for testing connection
    setTimeout(() => {
      const random = Math.random();
      if (random > 0.3) { // 70% success rate for demo
        this.testConnectionStatus = 'success';
        this.testConnectionMessage = 'Connection successful! Your Azure DevOps credentials are valid.';
        this.success = this.testConnectionMessage;
      } else {
        this.testConnectionStatus = 'error';
        this.testConnectionMessage = 'Connection failed. Please check your credentials and try again.';
        this.error = this.testConnectionMessage;
      }
      this.loading = false;
    }, 1500);
  }

  togglePatVisibility(): void {
    this.showPat = !this.showPat;
  }

  // Create mock settings for demo purposes
  private createMockSettings(): void {
    this.settings = {
      organization: 'demo-organization',
      organizationUrl: 'https://dev.azure.com/demo-organization',
      project: 'Demo Project',
      personalAccessToken: '•••••••••••••••••••••••••••••'
    };
    
    // Populate form with mock data if user can edit
    if (this.authService.canEditAzureDevOpsPat()) {
      this.azureDevOpsForm.patchValue({
        organizationUrl: this.settings.organizationUrl,
        projectName: this.settings.project,
        personalAccessToken: '' // Don't prefill the PAT for security reasons
      });
    }
  }
} 