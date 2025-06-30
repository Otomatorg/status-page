import { WORKFLOW_TYPES } from './constants/constants.js';
import { apiService } from './services/apiService.js';
import { dataService } from './services/dataService.js';

async function stopAllWorkflows(): Promise<void> {
  console.log('🛑 Stopping all workflows...');
  
  try {
    // Load existing workflow states
    const workflowsState = await dataService.loadWorkflowsState();
    console.log(`📂 Loaded state for ${Object.keys(workflowsState).length} workflows`);

    // Process each workflow type
    for (const workflowType of Object.values(WORKFLOW_TYPES)) {
      console.log(`\n🔍 Processing ${workflowType}...`);
      
      const workflowState = workflowsState[workflowType];

      if (workflowState.id) {
        console.log(`🛑 ${workflowType}: Stopping workflow (ID: ${workflowState.id})...`);
        
        const stopResponse = await apiService.stopWorkflow(workflowState.id);
        
        if (stopResponse.success) {
          workflowState.started = false;
          workflowState.state = 'inactive';
          console.log(`✅ ${workflowType}: Workflow stopped successfully`);
        } else {
          console.log(`⚠️ ${workflowType}: Failed to stop workflow: ${stopResponse.error}`);
        }
      } else {
        console.log(`ℹ️ ${workflowType}: No workflow ID found, skipping`);
      }
    }

    // Save updated states
    await dataService.saveWorkflowsState(workflowsState);
    console.log('\n💾 Workflow states saved');

    console.log('✅ All workflows processed');

  } catch (error) {
    console.error('💥 Failed to stop workflows:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  stopAllWorkflows().catch(console.error);
}

export { stopAllWorkflows };
