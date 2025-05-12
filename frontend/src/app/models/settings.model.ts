export enum UserRole {
  Member = 'Member',
  ScrumMaster = 'ScrumMaster',
  Admin = 'Admin'
}

export interface UserRoleDto {
  userId: string;
  userName: string;
  email: string;
  role: UserRole;
}

export interface AzureDevOpsSettingsDto {
  personalAccessToken: string;
  organization: string;
  project: string;
}

export interface AiModelSettingsDto {
  enableAutoUpdate: boolean;
  modelEndpoint: string;
  apiKey: string;
}

export interface SettingsDto {
  userRoles: UserRoleDto[];
  azureDevOpsSettings: AzureDevOpsSettingsDto;
  aiModelSettings: AiModelSettingsDto;
}

export interface UpdateUserRoleRequest {
  userId: string;
  role: UserRole;
}

export interface UpdateAzureDevOpsPATRequest {
  personalAccessToken: string;
}

export interface UpdateAiModelSettingsRequest {
  enableAutoUpdate: boolean;
} 