import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { SettingsService } from '../../../services/settings.service';
import { AiModelSettingsDto, UpdateAiModelSettingsRequest } from '../../../models/settings.model';

@Component({
  selector: 'app-ai-model-settings',
  templateUrl: './ai-model-settings.component.html',
  styleUrls: ['./ai-model-settings.component.scss']
})
export class AiModelSettingsComponent implements OnInit {
  settings: AiModelSettingsDto | null = null;
  loading = false;
  error = '';
  success = '';

  constructor(
    public authService: AuthService,
    private settingsService: SettingsService,
    private fb: FormBuilder
  ) { }

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.loading = true;
    this.error = '';
    this.success = '';

    this.settingsService.getAiModelSettings().subscribe({
      next: (settings) => {
        this.settings = settings;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to load AI model settings';
        this.loading = false;
      }
    });
  }

  toggleAutoUpdate(): void {
    if (!this.authService.canEditAiModelSettings()) {
      this.error = 'You do not have permission to update AI model settings';
      return;
    }

    if (!this.settings) {
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    const newValue = !this.settings.enableAutoUpdate;
    
    const request: UpdateAiModelSettingsRequest = {
      enableAutoUpdate: newValue
    };

    this.settingsService.updateAiModelSettings(request).subscribe({
      next: () => {
        if (this.settings) {
          this.settings.enableAutoUpdate = newValue;
        }
        this.success = `AI Model Auto-Update ${newValue ? 'enabled' : 'disabled'} successfully`;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to update AI model settings';
        this.loading = false;
      }
    });
  }
} 