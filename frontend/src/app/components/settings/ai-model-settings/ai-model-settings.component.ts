import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { SettingsService } from '../../../services/settings.service';
import { AiModelSettingsDto } from '../../../models/settings.model';

@Component({
  selector: 'app-ai-model-settings',
  templateUrl: './ai-model-settings.component.html',
  styleUrls: ['./ai-model-settings.component.scss']
})
export class AiModelSettingsComponent implements OnInit {
  settings: AiModelSettingsDto | null = null;
  aiModelForm: FormGroup;
  loading = false;
  error = '';
  success = '';
  showApiKey = false;

  constructor(
    public authService: AuthService,
    private settingsService: SettingsService,
    private fb: FormBuilder
  ) {
    this.aiModelForm = this.fb.group({
      modelType: ['openai', Validators.required],
      apiKey: ['', Validators.required],
      endpoint: ['', [
        // Make endpoint required only for azureopenai and custom models
        // Will be handled in custom validation
        Validators.pattern(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/)
      ]],
      enableRecommendations: [true],
      enableAutoUpdate: [true]
    });

    // Add custom validator for the endpoint field
    this.aiModelForm.get('modelType')?.valueChanges.subscribe(value => {
      const endpointControl = this.aiModelForm.get('endpoint');
      if (value === 'azureopenai' || value === 'custom') {
        endpointControl?.setValidators([
          Validators.required,
          Validators.pattern(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/)
        ]);
      } else {
        endpointControl?.setValidators([
          Validators.pattern(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/)
        ]);
      }
      endpointControl?.updateValueAndValidity();
    });
  }

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
        
        // Populate form with current settings
        if (settings) {
          this.aiModelForm.patchValue({
            modelType: settings.modelType || 'openai',
            endpoint: settings.modelEndpoint || '',
            enableRecommendations: settings.enableRecommendations || true,
            enableAutoUpdate: settings.enableAutoUpdate
            // We don't populate the API key for security reasons
          });
        }
        
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to load AI model settings';
        this.loading = false;
        
        // Create mock data for demo if API fails
        if (!this.settings) {
          this.createMockSettings();
        }
      }
    });
  }

  saveAiModelSettings(): void {
    if (!this.authService.canEditAiModelSettings()) {
      this.error = 'You do not have permission to update AI model settings';
      return;
    }

    if (this.aiModelForm.invalid) {
      // Mark all fields as touched to trigger validation messages
      Object.keys(this.aiModelForm.controls).forEach(key => {
        const control = this.aiModelForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    const formValues = this.aiModelForm.value;
    
    const settings = {
      modelType: formValues.modelType,
      modelEndpoint: formValues.endpoint || null,
      apiKey: formValues.apiKey,
      enableRecommendations: formValues.enableRecommendations,
      enableAutoUpdate: formValues.enableAutoUpdate
    };

    // In a real app, this would be sent to the backend
    // For demo purposes, we'll save to localStorage
    localStorage.setItem('aiModelSettings', JSON.stringify({
      ...settings,
      apiKey: '•••••••••••••' // Don't store the actual API key in localStorage
    }));
    
    // Simulate API call
    setTimeout(() => {
      this.settings = settings as AiModelSettingsDto;
      this.success = 'AI model settings saved successfully';
      this.loading = false;
    }, 800);
  }

  toggleApiKeyVisibility(): void {
    this.showApiKey = !this.showApiKey;
  }

  // Create mock settings for demo purposes
  private createMockSettings(): void {
    this.settings = {
      modelType: 'openai',
      modelEndpoint: '',
      apiKey: '•••••••••••••••••••••••••••••',
      enableRecommendations: true,
      enableAutoUpdate: true
    };
    
    // Populate form with mock data
    this.aiModelForm.patchValue({
      modelType: this.settings?.modelType || 'openai',
      endpoint: this.settings?.modelEndpoint || '',
      enableRecommendations: this.settings?.enableRecommendations || true,
      enableAutoUpdate: this.settings?.enableAutoUpdate || true
      // Don't populate API key for security
    });
  }
} 