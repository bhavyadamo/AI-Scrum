import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EstimationService, TaskEstimationRequest, TaskEstimationResponse } from '../../services/estimation.service';
import { TaskService } from '../../services/task.service';
import { WorkItem, WorkItemHistory, TeamMember, WorkItemType, WorkItemDetails, ActivityLog } from '../../models/task.model';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

// Extended WorkItem interface to include fields property
interface ExtendedWorkItem extends WorkItem {
  fields?: {
    'System.AssignedTo'?: string | { displayName: string; [key: string]: any };
    'System.WorkItemType'?: string;
    [key: string]: any;
  };
}

@Component({
  selector: 'app-task-estimation',
  templateUrl: './task-estimation.component.html',
  styleUrls: ['./task-estimation.component.scss']
})
export class TaskEstimationComponent implements OnInit {
  estimationForm: FormGroup;
  teamMembers: string[] = [];
  
  // Include all available work item types from the enum
  taskTypes: string[] = [
    'User Story',
    'Task',
    'Bug',
    'Epic',
    'Feature',
    'Issue',
    'Change Request',
    'Documentation',
    'Test',
    'Research'
  ];
  
  complexityLevels: string[] = [
    'Low',
    'Medium',
    'High'
  ];
  
  loading = false;
  error: string | null = null;
  estimationResult: TaskEstimationResponse | null = null;
  showResult = false;

  // New properties for iteration path functionality
  manualIterationPath: string = ''; // Only use manual iteration path
  workItems: ExtendedWorkItem[] = [];
  loadingIterationItems: boolean = false;
  iterationError: string | null = null;
  selectedWorkItem: ExtendedWorkItem | null = null;
  devTimeEstimate: number = 0;
  testTimeEstimate: number = 0;
  totalEstimate: number = 0;

  // Properties for test cases upload
  testCasesFile: File | null = null;
  testCaseCount: number = 0;
  
  // Properties for user story reference
  userStoryDetails: any = null;
  userStoryError: string | null = null;
  checkingUserStory: boolean = false;

  // Properties for human estimation
  humanDevHours: number = 2;
  humanTestHours: number = 1;
  humanTotalHours: number = 3;

  constructor(
    private fb: FormBuilder,
    private estimationService: EstimationService,
    private taskService: TaskService
  ) {
    this.estimationForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(5)]],
      type: ['Feature', Validators.required],
      assignee: [''],
      complexity: ['Medium', Validators.required],
      userStoryId: [''], // Add field for user story ID
      manualDevHours: [2, [Validators.required, Validators.min(0.5)]], // Manual development hours
      manualTestHours: [1, [Validators.required, Validators.min(0.5)]] // Manual testing hours
    });
    
    // Listen for changes to the manual hour fields
    this.estimationForm.get('manualDevHours')?.valueChanges.subscribe(value => {
      this.updateHumanEstimation();
    });
    this.estimationForm.get('manualTestHours')?.valueChanges.subscribe(value => {
      this.updateHumanEstimation();
    });
    
    // Initialize human estimation values
    this.updateHumanEstimation();
  }

  ngOnInit(): void {
    // Load team members
    this.loadTeamMembers();

    // Listen for title changes to auto-fill fields
    this.estimationForm.get('title')?.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(title => {
        if (title && title.length > 5) {
          this.autoPopulateFormFields(title);
        }
      });
  }

  // Load team members with better error handling
  loadTeamMembers(): void {
    this.taskService.getTeamMembers().subscribe({
      next: (response) => {
        console.log('Team members API response:', response);
        
        if (Array.isArray(response)) {
          if (response.length === 0) {
            console.warn('No team members returned from API');
            return;
          }
          
          if (typeof response[0] === 'string') {
            // It's an array of strings
            this.teamMembers = response as string[];
          } else {
            // It's an array of TeamMember objects
            this.teamMembers = (response as TeamMember[])
              .filter(m => m && m.displayName) // Filter out invalid entries
              .map(m => m.displayName);
          }
          
          // Add some failsafe common users based on the work items we've seen
          const commonUsers = ['Bhavya Damodharan', 'Suresh GM', 'Ranjith Kumar S', 'Vignesh Ram Suresh kumar', 'Dinesh Kumar K'];
          
          // Add any common users not already in the list
          commonUsers.forEach(user => {
            if (!this.teamMembers.includes(user)) {
              this.teamMembers.push(user);
            }
          });
          
          console.log(`Loaded ${this.teamMembers.length} team members:`, this.teamMembers);
        }
      },
      error: (err) => {
        console.error('Error loading team members:', err);
        this.error = 'Failed to load team members';
        
        // Fallback to a default list of common users
        this.teamMembers = ['Bhavya Damodharan', 'Suresh GM', 'Ranjith Kumar S', 'Vignesh Ram Suresh kumar', 'Dinesh Kumar K'];
        console.log('Using fallback team members list:', this.teamMembers);
      }
    });
  }

  // Auto-populate form fields based on entered title
  autoPopulateFormFields(title: string): void {
    if (!this.workItems || this.workItems.length === 0) {
      return; // No items to search through
    }

    // Find matching work item by title (full or partial match)
    const matchingItem = this.workItems.find(item => 
      item.title.toLowerCase().includes(title.toLowerCase()) || 
      title.toLowerCase().includes(item.title.toLowerCase())
    );

    if (matchingItem) {
      this.selectedWorkItem = matchingItem;
      this.populateFormWithWorkItem(matchingItem);
    }
  }

  // Load work items for the selected iteration path
  loadWorkItemsByIteration(): void {
    if (!this.manualIterationPath || this.manualIterationPath.trim() === '') {
      this.iterationError = 'Please enter an iteration path';
      return;
    }

    this.loadingIterationItems = true;
    this.workItems = [];
    this.selectedWorkItem = null;
    this.iterationError = null;

    this.taskService.getTasks(this.manualIterationPath.trim()).subscribe({
      next: (items) => {
        // Process items to clean up state information
        this.workItems = items.map(item => {
          // Process each item to ensure it has proper state
          const processedItem = { ...item } as ExtendedWorkItem;
          
          // Make sure the fields object exists
          if (!processedItem.fields) {
            processedItem.fields = {};
          }
          
          // Fix state display - remove "Unknown" prefix if present
          if (processedItem.state && processedItem.state.toLowerCase().includes('unknown')) {
            processedItem.state = processedItem.state.replace(/unknown/i, '').trim();
          }
          
          // Also check for state in fields
          if (processedItem.fields && processedItem.fields['System.State']) {
            let state = processedItem.fields['System.State'];
            if (typeof state === 'string' && state.toLowerCase().includes('unknown')) {
              state = state.replace(/unknown/i, '').trim();
              processedItem.fields['System.State'] = state;
            }
            // If item has no state but has System.State, use it
            if (!processedItem.state) {
              processedItem.state = state;
            }
          }
          
          // Capture status field if present in the payload and map it to fields
          if ((item as any).status) {
            processedItem.fields['status'] = (item as any).status;
          }
          
          return processedItem;
        });
        
        this.loadingIterationItems = false;
        console.log(`Loaded ${this.workItems.length} work items for iteration ${this.manualIterationPath}`);
      },
      error: (err) => {
        console.error('Error loading work items:', err);
        this.iterationError = 'Failed to load work items for the specified iteration path';
        this.loadingIterationItems = false;
      }
    });
  }

  // Helper method to find the best matching team member for an assignee
  findMatchingTeamMember(assigneeName: string): string {
    if (!assigneeName || !this.teamMembers || this.teamMembers.length === 0) {
      return '';
    }
    
    console.log('Finding match for assignee:', assigneeName);
    
    // First try exact match
    const exactMatch = this.teamMembers.find(member => member === assigneeName);
    if (exactMatch) {
      console.log('Found exact match:', exactMatch);
      return exactMatch;
    }
    
    // Then try case-insensitive exact match
    const caseInsensitiveMatch = this.teamMembers.find(
      member => member.toLowerCase() === assigneeName.toLowerCase()
    );
    if (caseInsensitiveMatch) {
      console.log('Found case-insensitive match:', caseInsensitiveMatch);
      return caseInsensitiveMatch;
    }
    
    // Then try contains matches (member contains assignee or assignee contains member)
    const containsMatch = this.teamMembers.find(
      member => member.toLowerCase().includes(assigneeName.toLowerCase()) ||
               assigneeName.toLowerCase().includes(member.toLowerCase())
    );
    if (containsMatch) {
      console.log('Found contains match:', containsMatch);
      return containsMatch;
    }
    
    // Split full names and try to match individual parts
    // This helps with formats like "First Last" vs "Last, First"
    const nameParts = assigneeName.toLowerCase().split(/[\s,]+/).filter(part => part.length > 1);
    if (nameParts.length > 1) {
      console.log('Trying to match name parts:', nameParts);
      
      // Try to find a member that contains all name parts
      const allPartsMatch = this.teamMembers.find(member => {
        const memberLower = member.toLowerCase();
        return nameParts.every(part => memberLower.includes(part));
      });
      
      if (allPartsMatch) {
        console.log('Found match containing all name parts:', allPartsMatch);
        return allPartsMatch;
      }
      
      // Try to find a member that contains any significant name part
      for (const part of nameParts) {
        if (part.length < 3) continue; // Skip short parts like initials
        
        const partialMatch = this.teamMembers.find(
          member => member.toLowerCase().includes(part)
        );
        if (partialMatch) {
          console.log('Found match with name part:', part, '->', partialMatch);
          return partialMatch;
        }
      }
    }
    
    // If we have a name that appears to be "Firstname Lastname"
    // Try a more aggressive match against first letters + full last name
    if (nameParts.length >= 2) {
      const firstInitial = nameParts[0].charAt(0);
      const lastName = nameParts[nameParts.length - 1];
      
      const initialsMatch = this.teamMembers.find(member => {
        const memberParts = member.toLowerCase().split(/[\s,]+/);
        if (memberParts.length >= 2) {
          const memberFirstInitial = memberParts[0].charAt(0);
          const memberLastName = memberParts[memberParts.length - 1];
          return memberFirstInitial === firstInitial && memberLastName.includes(lastName);
        }
        return false;
      });
      
      if (initialsMatch) {
        console.log('Found match with first initial + last name:', initialsMatch);
        return initialsMatch;
      }
    }
    
    // Last resort: try to match any word of length 4+ as a potential name fragment
    const significantWords = assigneeName.toLowerCase().match(/\b\w{4,}\b/g);
    if (significantWords && significantWords.length > 0) {
      for (const word of significantWords) {
        const wordMatch = this.teamMembers.find(
          member => member.toLowerCase().includes(word)
        );
        if (wordMatch) {
          console.log('Found match with significant word:', word, '->', wordMatch);
          return wordMatch;
        }
      }
    }
    
    // If no match found after all attempts, return the original name
    console.log('No match found, using original name:', assigneeName);
    return assigneeName;
  }

  // Select a work item for estimation
  selectWorkItem(item: ExtendedWorkItem): void {
    this.selectedWorkItem = item;
    this.populateFormWithWorkItem(item);
  }

  // Populate the form with selected work item details
  populateFormWithWorkItem(item: ExtendedWorkItem): void {
    const complexity = this.determineComplexity(item);
    
    // Extract assignee name, trying 'System.AssignedTo' first
    let assignee = '';
    let originalAssignee = '';
    
    // Debug log the item details
    console.log('Selected work item:', item);
    
    // Check for fields property which might contain System.AssignedTo
    if (item.fields && item.fields['System.AssignedTo']) {
      const assignedTo = item.fields['System.AssignedTo'];
      if (typeof assignedTo === 'string') {
        originalAssignee = assignedTo;
        assignee = assignedTo;
      } else if (typeof assignedTo === 'object' && assignedTo !== null) {
        // Try to get displayName property
        if (assignedTo.displayName) {
          originalAssignee = assignedTo.displayName;
          assignee = assignedTo.displayName;
        }
      }
    }
    // Check for direct assignee property which is most common in Azure DevOps API
    else if ((item as any).assignedTo) {
      originalAssignee = typeof (item as any).assignedTo === 'string' 
        ? (item as any).assignedTo 
        : ((item as any).assignedTo.displayName || '');
      assignee = originalAssignee;
    }
    
    console.log('Original assignee from work item:', originalAssignee);
    console.log('Available team members:', this.teamMembers);
    
    // If we have an assignee name, find the matching team member
    if (assignee) {
      const previousAssignee = assignee;
      assignee = this.findMatchingTeamMember(assignee);
      console.log(`Matching team member: '${previousAssignee}' -> '${assignee}'`);
    }
    
    // Get type, trying both System.WorkItemType and type property
    let itemType = '';
    
    // First try to get from Azure DevOps fields
    if (item.fields) {
      if (item.fields['System.WorkItemType']) {
        itemType = item.fields['System.WorkItemType'];
      }
    }
    
    // If not found, fallback to type property
    if (!itemType && item.type) {
      itemType = item.type;
    }
    
    // If still not found, try to determine from title
    if (!itemType) {
      const title = item.title.toLowerCase();
      if (title.includes('bug') || title.includes('fix') || title.includes('issue')) {
        itemType = 'Bug';
      } else if (title.includes('feature') || title.includes('implement') || title.includes('add new')) {
        itemType = 'Feature';
      } else if (title.includes('change') || title.includes('modify') || title.includes('update')) {
        itemType = 'Change Request';
      } else if (title.includes('requirement') || title.includes('must have')) {
        itemType = 'Requirement';
      } else {
        // Default to Feature
        itemType = 'Feature';
      }
    }
    
    // Ensure the type is available in our task types list
    if (itemType && !this.taskTypes.includes(itemType)) {
      // Add to taskTypes if not already there
      this.taskTypes.push(itemType);
    }
    
    // Update form with extracted values
    this.estimationForm.patchValue({
      title: item.title,
      type: itemType,
      assignee: assignee,
      complexity: complexity
    });

    console.log(`Populated form with: Type=${itemType}, Assignee=${assignee}, Complexity=${complexity}`);

    // Pre-calculate estimates based on historical data if we have this information
    if (this.estimationResult) {
      this.calculateTimeEstimates(this.estimationResult.estimatedHours);
    }
  }

  // Determine complexity based on work item properties with enhanced logic
  determineComplexity(item: ExtendedWorkItem): string {
    // Initialize with default complexity
    let complexity = 'Medium';
    
    // Try to determine from title keywords
    const title = item.title.toLowerCase();
    if (title.includes('critical') || title.includes('urgent') || title.includes('major') || 
        title.includes('performance issue') || title.includes('security')) {
      return 'High';
    }
    
    if (title.includes('minor') || title.includes('small') || title.includes('trivial') || 
        title.includes('documentation') || title.includes('typo')) {
      return 'Low';
    }
    
    // Determine from type
    const itemType = this.getWorkItemType(item);
    if (itemType === 'Bug' || itemType === 'Change Request' || itemType === 'Feature') {
      // Bugs and change requests tend to be more complex
      complexity = 'Medium';
      
      // For bugs, increase complexity
      if (itemType === 'Bug') {
        complexity = 'High';
      }
    }
    
    // Determine from priority if available
    if (item.priority !== undefined) {
      if (item.priority <= 1) {
        complexity = 'High';
      } else if (item.priority === 2) {
        complexity = 'Medium';
      } else {
        complexity = 'Low';
      }
    }
    
    // Check for complexity field if available in Azure DevOps fields
    if (item.fields) {
      // Different systems use different field names for complexity/effort
      const complexityFields = [
        'Microsoft.VSTS.Common.Complexity',
        'Microsoft.VSTS.Scheduling.Effort',
        'Custom.Complexity',
        'System.Complexity'
      ];
      
      for (const field of complexityFields) {
        if (item.fields[field]) {
          const fieldValue = item.fields[field];
          if (typeof fieldValue === 'string') {
            if (fieldValue.includes('High') || fieldValue.includes('1')) {
              return 'High';
            } else if (fieldValue.includes('Low') || fieldValue.includes('3')) {
              return 'Low';
            }
          } else if (typeof fieldValue === 'number') {
            if (fieldValue <= 1) {
              return 'High';
            } else if (fieldValue >= 3) {
              return 'Low';
            }
          }
        }
      }
    }
    
    return complexity;
  }

  // Helper method to get work item type consistently
  getWorkItemType(item: ExtendedWorkItem): string {
    // Try to get from System.WorkItemType first
    if (item.fields && item.fields['System.WorkItemType']) {
      return item.fields['System.WorkItemType'];
    }
    
    // Fallback to type property
    return item.type || 'Feature';
  }

  resetForm(): void {
    this.estimationForm.reset({
      title: '',
      type: 'Feature',
      assignee: '',
      complexity: 'Medium',
      userStoryId: '',
      manualDevHours: 2,
      manualTestHours: 1
    });
    this.selectedWorkItem = null;
    this.error = null;
    this.showResult = false;
    this.estimationResult = null;
    this.testCasesFile = null;
    this.testCaseCount = 0;
    this.userStoryDetails = null;
    this.userStoryError = null;
  }

  // Handle test case file uploads
  onTestCasesUpload(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.testCasesFile = file;
      // Simulate analyzing the file to count test cases
      this.analyzeTestCases(file);
    }
  }

  // Clear uploaded test cases
  clearTestCases(): void {
    this.testCasesFile = null;
    this.testCaseCount = 0;
  }

  // Analyze test cases file to count the number of tests
  private analyzeTestCases(file: File): void {
    // In a real application, you would parse the file content
    // Here we'll simulate by estimating based on file size
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        // Simple estimation - assume one test case per 5 lines
        const lines = content.split('\n').length;
        this.testCaseCount = Math.max(1, Math.floor(lines / 5));
        console.log(`Estimated ${this.testCaseCount} test cases from file with ${lines} lines`);
      } else {
        this.testCaseCount = Math.max(1, Math.floor(file.size / 1024)); // Estimate 1 test case per KB
      }
    };
    reader.readAsText(file);
  }

  // Check user story from ID
  checkUserStory(): void {
    const userStoryId = this.estimationForm.get('userStoryId')?.value;
    if (!userStoryId) {
      this.userStoryError = 'Please enter a user story ID';
      return;
    }

    this.checkingUserStory = true;
    this.userStoryError = null;
    this.userStoryDetails = null;

    // In a real application, you would call your API service
    // This is a simulation for demonstration
    setTimeout(() => {
      if (userStoryId && !isNaN(parseInt(userStoryId))) {
        // Simulate successful user story lookup
        this.userStoryDetails = {
          id: userStoryId,
          title: `User story for ${this.estimationForm.get('title')?.value || 'task'}`,
          points: Math.floor(Math.random() * 8) + 1, // Random story points between 1-8
          description: 'This is a sample user story description.'
        };
      } else {
        this.userStoryError = 'Invalid user story ID or user story not found';
      }
      this.checkingUserStory = false;
    }, 800);
  }

  // Modified estimation method to include both human and AI estimations
  estimateTaskTime(): void {
    if (this.estimationForm.invalid) {
      this.markFormGroupTouched(this.estimationForm);
      return;
    }

    this.loading = true;
    this.error = null;
    this.showResult = false;

    // Update human estimation values
    this.updateHumanEstimation();

    // Continue with AI-based estimation
    const formType = this.estimationForm.get('type')?.value;
    
    const request: TaskEstimationRequest = {
      title: this.estimationForm.get('title')?.value,
      type: formType, // Keep the original 'type' property
      taskType: formType, // Also set the alternative 'taskType' property
      assignee: this.estimationForm.get('assignee')?.value,
      complexity: this.estimationForm.get('complexity')?.value,
      // Include test cases count if available
      testCasesCount: this.testCaseCount > 0 ? this.testCaseCount : undefined,
      // Include user story info if available
      userStoryId: this.userStoryDetails ? parseInt(this.userStoryDetails.id) : undefined,
      userStoryPoints: this.userStoryDetails ? this.userStoryDetails.points : undefined
    };

    console.log('Estimation request:', request);

    // Use the selected work item if available
    if (this.selectedWorkItem) {
      if (this.manualIterationPath) {
        // If we have both a selected work item and an iteration path, use the history-based approach
        this.estimateFromIterationHistory(request);
      } else {
        // Otherwise use the standard approach
        this.performStandardEstimation(request);
      }
    } else {
      // If no work item is selected, use the standard approach
      this.performStandardEstimation(request);
    }
  }

  // Helper to mark all form controls as touched to show validation errors
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  /**
   * Estimate task time using the iteration history approach (our previous implementation)
   */
  private estimateFromIterationHistory(request: TaskEstimationRequest): void {
    // Use iteration path for historical data analysis if available
    const iterationPath = (this.selectedWorkItem && this.selectedWorkItem.iterationPath) || this.manualIterationPath;
    
    if (iterationPath) {
      request.includeHistory = true; // Signal to include work history analysis
      
      console.log('Estimating using work items from iteration: ' + iterationPath);
      
      // Get work items from this iteration for analysis
      this.taskService.getTaskHistory(iterationPath).subscribe({
        next: (historyItems: WorkItem[]) => {
          console.log(`Retrieved ${historyItems.length} work items from iteration ${iterationPath}`);
          
          if (historyItems.length === 0) {
            // If no historical items found, fall back to standard estimation
            console.log('No historical items found, using standard estimation');
            this.performStandardEstimation(request);
            return;
          }
          
          // Since we might not have actual timing data from the API,
          // we'll analyze the items we have and infer timing data
          const estimatedHistoricalItems = this.inferTimingData(historyItems, request.type, request.complexity);
          
          // Set historical data in the request
          request.historicalItems = estimatedHistoricalItems;
          
          // Check if we have enough data to make a history-based estimate
          if (estimatedHistoricalItems.length > 0) {
            console.log('Using inferred historical data for estimation');
            
            // Calculate time estimates based on the historical data
            const similarItems = this.findSimilarItems(estimatedHistoricalItems, request);
            
            if (similarItems.length > 0) {
              // Calculate average times from similar items
              const avgTotal = similarItems.reduce((sum: number, item: WorkItem) => sum + (item.actualHours || 0), 0) / similarItems.length;
              const avgDev = similarItems.reduce((sum: number, item: WorkItem) => sum + (item.developmentHours || 0), 0) / similarItems.length;
              const avgTest = similarItems.reduce((sum: number, item: WorkItem) => sum + (item.testingHours || 0), 0) / similarItems.length;
              
              // Create a result based on historical averages
              this.estimationResult = {
                estimatedHours: Number(avgTotal.toFixed(1)),
                devTimeHours: Number(avgDev.toFixed(1)),
                testTimeHours: Number(avgTest.toFixed(1)),
                confidenceScore: this.calculateConfidenceScore(similarItems.length, historyItems.length),
                factors: [
                  `Task type: ${request.type}`,
                  `${request.complexity} complexity`,
                  `Based on ${similarItems.length} similar completed items`,
                  `Assignee ${request.assignee || 'unassigned'}`
                ]
              };
              
              this.showResult = true;
              this.loading = false;
              this.devTimeEstimate = this.estimationResult.devTimeHours || 0;
              this.testTimeEstimate = this.estimationResult.testTimeHours || 0;
              this.totalEstimate = this.estimationResult.estimatedHours;
            } else {
              // No similar items found, use standard estimation
              this.performStandardEstimation(request);
            }
          } else {
            // Not enough historical data, fall back to standard estimation
            this.performStandardEstimation(request);
          }
        },
        error: (err: any) => {
          console.error('Error loading work item history:', err);
          console.log('Falling back to standard estimation');
          this.performStandardEstimation(request);
        }
      });
    } else {
      // Fallback to standard estimation without work history
      this.performStandardEstimation(request);
    }
  }

  /**
   * Perform standard estimation without using historical data
   */
  private performStandardEstimation(request: TaskEstimationRequest): void {
    this.estimationService.estimateTaskTime(request).subscribe({
      next: (result) => {
        this.estimationResult = result;
        this.showResult = true;
        this.calculateTimeEstimates(result.estimatedHours);
        this.loading = false;
      },
      error: (err) => {
        console.error('Error estimating task time:', err);
        this.error = 'Failed to estimate task time. Please try again.';
        this.loading = false;
      }
    });
  }

  /**
   * Infer timing data for historical work items
   * This adds estimated development and testing hours to work items
   */
  private inferTimingData(items: WorkItem[], taskType: string, complexity: string): WorkItem[] {
    return items.map(item => {
      // Clone the item to avoid modifying the original
      const processedItem: WorkItem = { ...item };
      
      // If the item already has timing data, use it
      if (item.actualHours && item.developmentHours && item.testingHours) {
        return processedItem;
      }
      
      // Calculate base hours based on type and complexity
      const baseHours = this.getBaseHoursByType(item.type || taskType);
      const multiplier = this.getComplexityMultiplier(complexity);
      
      // Estimate total hours
      const estimatedTotal = baseHours * multiplier;
      
      // Estimate dev/test split
      const devRatio = complexity === 'High' ? 0.7 : (complexity === 'Low' ? 0.6 : 0.65);
      const devHours = estimatedTotal * devRatio;
      const testHours = estimatedTotal - devHours;
      
      // Add the estimated hours to the item
      processedItem.actualHours = Number(estimatedTotal.toFixed(1));
      processedItem.developmentHours = Number(devHours.toFixed(1));
      processedItem.testingHours = Number(testHours.toFixed(1));
      
      return processedItem;
    });
  }

  /**
   * Find similar work items based on type and complexity
   */
  private findSimilarItems(items: WorkItem[], request: TaskEstimationRequest): WorkItem[] {
    // Filter items by type and complexity
    return items.filter(item => {
      // Match by type
      const typeMatch = item.type?.toLowerCase() === request.type.toLowerCase();
      
      // Match by complexity (if available)
      const itemComplexity = this.determineComplexity(item as ExtendedWorkItem);
      const complexityMatch = itemComplexity.toLowerCase() === request.complexity.toLowerCase();
      
      // We need both to match for a "similar" item
      return typeMatch && complexityMatch;
    });
  }

  /**
   * Calculate confidence score based on sample size
   */
  private calculateConfidenceScore(similarCount: number, totalCount: number): number {
    // Base confidence on the number of similar items vs total items
    if (similarCount === 0) return 0.5;
    
    // More similar items = higher confidence
    const baseConfidence = Math.min(0.75, 0.5 + (similarCount / 20));
    
    // Add a bonus if we have a good percentage of the total
    const percentageBonus = similarCount / totalCount > 0.3 ? 0.1 : 0;
    
    // Cap at 0.95 for historical data
    return Math.min(0.95, baseConfidence + percentageBonus);
  }

  // Calculate development and testing time estimates
  calculateTimeEstimates(totalHours: number): void {
    // Typical distribution: dev 60-70%, testing 30-40%
    const complexity = this.estimationForm.value.complexity;
    let devRatio = 0.65; // Default dev ratio
    
    // Adjust ratio based on complexity
    if (complexity === 'High') {
      devRatio = 0.7; // Higher complexity = more dev time
    } else if (complexity === 'Low') {
      devRatio = 0.6; // Lower complexity = less dev time
    }
    
    this.devTimeEstimate = Math.round(totalHours * devRatio * 10) / 10;
    this.testTimeEstimate = Math.round((totalHours - this.devTimeEstimate) * 10) / 10;
    this.totalEstimate = totalHours;
  }

  // Format confidence score as percentage
  formatConfidence(score: number): string {
    return `${Math.round(score * 100)}%`;
  }

  // Get appropriate class for confidence level
  getConfidenceClass(score: number): string {
    if (score >= 0.8) {
      return 'bg-success';
    } else if (score >= 0.6) {
      return 'bg-primary';
    } else if (score >= 0.4) {
      return 'bg-warning';
    } else {
    return 'bg-danger';
    }
  }

  // Get assignee name for display
  getAssigneeName(item: ExtendedWorkItem): string {
    let displayName = '';
    
    // Try to get from System.AssignedTo first
    if (item.fields && item.fields['System.AssignedTo']) {
      const assignedTo = item.fields['System.AssignedTo'];
      if (typeof assignedTo === 'string') {
        displayName = assignedTo;
      } else if (typeof assignedTo === 'object' && assignedTo !== null) {
        if (assignedTo.displayName) {
          displayName = assignedTo.displayName;
        }
      }
    }
    
    // Fallback to assignedTo property
    if (!displayName && item.assignedTo) {
      if (typeof item.assignedTo === 'string') {
        displayName = item.assignedTo;
      } else if (typeof item.assignedTo === 'object' && item.assignedTo !== null) {
        const assigneeObj = item.assignedTo as any;
        displayName = assigneeObj.displayName || assigneeObj.name || '';
      }
    }
    
    // Find matching team member for consistent display
    if (displayName) {
      return this.findMatchingTeamMember(displayName);
    }
    
    return '';
  }

  // Get the clean state display for a work item
  getStateDisplay(item: ExtendedWorkItem): string {
    // First check fields for System.State
    if (item.fields && item.fields['System.State']) {
      const state = item.fields['System.State'];
      if (typeof state === 'string') {
        // Remove "Unknown" prefix if present
        return state.replace(/unknown/i, '').trim();
      }
    }
    
    // Check for status field in the item or fields
    if ((item as any).status) {
      return typeof (item as any).status === 'string' ? (item as any).status : '';
    }
    
    if (item.fields && item.fields['status']) {
      return typeof item.fields['status'] === 'string' ? item.fields['status'] : '';
    }
    
    // Fallback to item.state if available
    if (item.state) {
      return item.state.replace(/unknown/i, '').trim();
    }
    
    return 'N/A'; // Default if no state available
  }

  /**
   * Get base hours for estimation by work item type
   */
  private getBaseHoursByType(type: string | undefined): number {
    const baseHoursByType: {[key: string]: number} = {
      'Bug': 4,
      'Task': 3,
      'Feature': 8,
      'User Story': 5,
      'Change Request': 4,
      'Requirement': 6,
      'Documentation': 2,
      'Epic': 20
    };
    
    return type ? (baseHoursByType[type] || 4) : 4; // Default if type not found
  }
  
  /**
   * Get multiplier based on complexity
   */
  private getComplexityMultiplier(complexity: string): number {
    const multipliers: {[key: string]: number} = {
      'Low': 0.6,
      'Medium': 1.0,
      'High': 1.5
    };
    
    return multipliers[complexity] || 1.0;
  }

  /**
   * Calculate time estimates based on the work item's actual state transition history
   * This analyzes the time spent in each state to estimate development and testing times
   */
  private calculateEstimatesFromHistory(workItem: WorkItemDetails): { total: number, development: number, testing: number } {
    console.log('Calculating estimates from work item history');
    
    // Default result
    const result = { 
      total: 0, 
      development: 0, 
      testing: 0 
    };
    
    // Step 1: Extract state transitions from activity history
    const stateTransitions = workItem.activity?.filter((a: ActivityLog) => a.field === 'State' || a.field === 'System.State') || [];
    console.log(`Found ${stateTransitions.length} state transitions`);
    
    if (stateTransitions.length === 0) {
      // No state transitions found, estimate based on work item type and complexity
      const complexity = this.determineComplexity(workItem as ExtendedWorkItem);
      const baseHours = this.getBaseHoursByType(this.getWorkItemType(workItem as ExtendedWorkItem));
      const multiplier = this.getComplexityMultiplier(complexity);
      
      result.total = Number((baseHours * multiplier).toFixed(1));
      result.development = Number((result.total * 0.65).toFixed(1));
      result.testing = Number((result.total * 0.35).toFixed(1));
      
      return result;
    }
    
    // Sort transitions by date
    stateTransitions.sort((a: ActivityLog, b: ActivityLog) => {
      const dateA = new Date(a.changedDate).getTime();
      const dateB = new Date(b.changedDate).getTime();
      return dateA - dateB;
    });
    
    // Step 2: Create a timeline of state changes with durations
    const timeline: { state: string, startDate: Date, endDate?: Date, durationHours?: number }[] = [];
    
    // Add each transition
    stateTransitions.forEach((transition: ActivityLog, index: number) => {
      const currentState = transition.newValue || '';
      const startDate = new Date(transition.changedDate);
      
      // Add to timeline
      timeline.push({
        state: currentState,
        startDate: startDate
      });
      
      // Set end date for previous state
      if (index > 0) {
        timeline[index - 1].endDate = startDate;
        
        // Calculate duration in hours for previous state
        const prevStartDate = timeline[index - 1].startDate;
        const durationMs = startDate.getTime() - prevStartDate.getTime();
        const durationHours = durationMs / (1000 * 60 * 60);
        
        // Account for work hours (8 hours per day, 5 days per week)
        // This is a simplification - in reality, you'd want to account for weekends and working hours
        let adjustedHours = durationHours;
        
        // If duration is more than 16 hours, assume some of it is non-working time
        if (durationHours > 16) {
          // Roughly estimate working hours
          const days = Math.floor(durationHours / 24);
          const workDays = Math.max(Math.ceil(days * 5/7), 1); // Estimate work days (5/7 of total days)
          adjustedHours = workDays * 8 + (durationHours % 24); // 8 hours per work day + remainder
          
          // Cap at a reasonable value to prevent outliers
          adjustedHours = Math.min(adjustedHours, durationHours * 0.6);
        }
        
        timeline[index - 1].durationHours = Number(adjustedHours.toFixed(1));
      }
    });

    // Add current state if item is not completed
    if (workItem.state !== 'Closed' && workItem.state !== 'Done' && workItem.state !== 'Completed') {
      // Calculate duration to now for the last state
      const lastIndex = timeline.length - 1;
      if (lastIndex >= 0) {
        const now = new Date();
        timeline[lastIndex].endDate = now;
        
        const durationMs = now.getTime() - timeline[lastIndex].startDate.getTime();
        const durationHours = durationMs / (1000 * 60 * 60);
        
        // Apply same adjustment for work hours
        let adjustedHours = durationHours;
        if (durationHours > 16) {
          const days = Math.floor(durationHours / 24);
          const workDays = Math.max(Math.ceil(days * 5/7), 1);
          adjustedHours = workDays * 8 + (durationHours % 24);
          adjustedHours = Math.min(adjustedHours, durationHours * 0.6);
        }
        
        timeline[lastIndex].durationHours = Number(adjustedHours.toFixed(1));
      }
    }
    
    // Step 3: Categorize times as development or testing
    timeline.forEach(entry => {
      if (!entry.durationHours) return;
      
      const state = entry.state.toLowerCase();
      
      // Categorize states
      if (state.includes('new') || state.includes('proposed') || state.includes('backlog')) {
        // Planning time - not counted in the estimate
      } else if (state.includes('active') || state.includes('progress') || state.includes('development')) {
        // Development time
        result.development += entry.durationHours;
      } else if (state.includes('review') || state.includes('test') || state.includes('qa')) {
        // Testing/Review time
        result.testing += entry.durationHours;
      } else if (state.includes('resolved') || state.includes('done') || state.includes('closed')) {
        // Completion time - typically minimal, add to testing
        result.testing += entry.durationHours * 0.5;
      } else {
        // Unknown state, distribute proportionally
        result.development += entry.durationHours * 0.6;
        result.testing += entry.durationHours * 0.4;
      }
    });
    
    // Step 4: Calculate total time
    result.total = Number((result.development + result.testing).toFixed(1));
    
    // Ensure we have a minimum reasonable value
    if (result.total < 0.5) {
      // If calculated time is too small, use type/complexity approach as fallback
      const complexity = this.determineComplexity(workItem as ExtendedWorkItem);
      const baseHours = this.getBaseHoursByType(this.getWorkItemType(workItem as ExtendedWorkItem));
      const multiplier = this.getComplexityMultiplier(complexity);
      
      result.total = Number((baseHours * multiplier).toFixed(1));
      result.development = Number((result.total * 0.65).toFixed(1));
      result.testing = Number((result.total * 0.35).toFixed(1));
    }
    
    // Round to 1 decimal place
    result.development = Number(result.development.toFixed(1));
    result.testing = Number(result.testing.toFixed(1));
    
    console.log(`Estimated from history: Total=${result.total}, Dev=${result.development}, Test=${result.testing}`);
    return result;
  }

  // Update human estimation values
  updateHumanEstimation(): void {
    const devHours = parseFloat(this.estimationForm.get('manualDevHours')?.value || '2');
    const testHours = parseFloat(this.estimationForm.get('manualTestHours')?.value || '1');
    
    this.humanDevHours = isNaN(devHours) ? 2 : devHours;
    this.humanTestHours = isNaN(testHours) ? 1 : testHours;
    this.humanTotalHours = this.humanDevHours + this.humanTestHours;
  }
} 