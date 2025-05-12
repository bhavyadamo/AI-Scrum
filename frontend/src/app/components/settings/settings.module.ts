import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { SettingsComponent } from './settings.component';
import { UserRolesComponent } from './user-roles/user-roles.component';
import { AzureDevOpsSettingsComponent } from './azure-devops-settings/azure-devops-settings.component';
import { AiModelSettingsComponent } from './ai-model-settings/ai-model-settings.component';

@NgModule({
  declarations: [
    SettingsComponent,
    UserRolesComponent,
    AzureDevOpsSettingsComponent,
    AiModelSettingsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ],
  exports: [
    SettingsComponent
  ]
})
export class SettingsModule { } 