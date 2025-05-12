import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { SettingsService } from '../../../services/settings.service';
import { AzureDevOpsSettingsDto, UpdateAzureDevOpsPATRequest } from '../../../models/settings.model';

@Component({
  selector: 'app-azure-devops-settings',
  templateUrl: './azure-devops-settings.component.html',
  styleUrls: ['./azure-devops-settings.component.scss']
})
export class AzureDevOpsSettingsComponent implements OnInit {
  settings: AzureDevOpsSettingsDto | null = null;
  patForm: FormGroup;
  loading = false;
  error = '';
  success = '';
  showPat = false;

  constructor(
    public authService: AuthService,
    private settingsService: SettingsService,
    private fb: FormBuilder
  ) {
    this.patForm = this.fb.group({
      personalAccessToken: ['', [Validators.required, Validators.minLength(20)]]
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
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to load Azure DevOps settings';
        this.loading = false;
      }
    });
  }

  updatePat(): void {
    if (!this.authService.canEditAzureDevOpsPat()) {
      this.error = 'You do not have permission to update Azure DevOps PAT';
      return;
    }

    if (this.patForm.invalid) {
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    const request: UpdateAzureDevOpsPATRequest = {
      personalAccessToken: this.patForm.value.personalAccessToken
    };

    this.settingsService.updateAzureDevOpsPAT(request).subscribe({
      next: () => {
        this.success = 'Azure DevOps Personal Access Token updated successfully';
        this.loading = false;
        this.loadSettings(); // Reload to get the masked version
        this.patForm.reset();
      },
      error: (err) => {
        this.error = err.message || 'Failed to update Azure DevOps PAT';
        this.loading = false;
      }
    });
  }

  togglePatVisibility(): void {
    this.showPat = !this.showPat;
  }
} 