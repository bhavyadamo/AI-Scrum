import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { CommonModule } from '@angular/common';

import { AppComponent } from './app.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { TaskDistributionComponent } from './components/task-distribution/task-distribution.component';
import { RecommendationsComponent } from './features/recommendations/recommendations.component';
import { TaskEstimationComponent } from './components/task-estimation/task-estimation.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { SettingsModule } from './components/settings/settings.module';
import { SettingsComponent } from './components/settings/settings.component';

const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'tasks', component: TaskDistributionComponent },
  { path: 'recommendations', component: RecommendationsComponent },
  { path: 'estimation', component: TaskEstimationComponent },
  { path: 'settings', component: SettingsComponent },
  { path: '**', redirectTo: '/dashboard' }
];

@NgModule({
  declarations: [
    AppComponent,
    DashboardComponent,
    TaskDistributionComponent,
    RecommendationsComponent,
    TaskEstimationComponent,
    NavbarComponent
  ],
  imports: [
    BrowserModule,
    CommonModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    SettingsModule,
    RouterModule.forRoot(routes)
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { } 