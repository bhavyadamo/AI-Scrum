import { Router } from 'express';
import { WorkItemController } from '../controllers/workItemController';

const router = Router();
const workItemController = new WorkItemController();

// Get work items by iteration path and date range
router.get('/', (req, res) => workItemController.getWorkItems(req, res));

// Get team members
router.get('/team-members', (req, res) => workItemController.getTeamMembers(req, res));

// Get work item by ID
router.get('/:id', (req, res) => workItemController.getWorkItemById(req, res));

// Assign task to team member
router.post('/assign', (req, res) => workItemController.assignTask(req, res));

// Auto-assign tasks
router.post('/auto-assign', (req, res) => workItemController.autoAssignTasks(req, res));

// Get auto-assign suggestions
router.get('/auto-assign-suggestions', (req, res) => workItemController.getAutoAssignSuggestions(req, res));

export default router; 