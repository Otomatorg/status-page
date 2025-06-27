#!/usr/bin/env node

import { WorkflowState } from './types/workflow.js';
import { WORKFLOW_TYPES } from './constants/workflowTypes.js';
import { WORKFLOW_TEMPLATES } from './templates/workflowTemplates.js';
import { apiService } from './services/apiService.js';
import { dataService } from './services/dataService.js';
import { verifyWorkflow } from './verifiers/workflowVerifiers.js';

class WorkflowMonitor {
  private async ensureWorkflowExists(workflowType: string, workflowState: WorkflowState): Promise<boolean> {

    // If workflow already exists, verify and update status in one call
    if (workflowState.id && workflowState.createdAt && new Date(workflowState.createdAt).toDateString() === new Date().toDateString()) {
      console.log(`✅ ${workflowType}: Workflow exists (ID: ${workflowState.id})`);

      // Fetch current workflow data to ensure it still exists on server AND update status
      try {
        const getResponse = await apiService.getWorkflow(workflowState.id);
        if (!getResponse.success) {
          console.log(`⚠️ ${workflowType}: Workflow not found on server, will recreate`);
          workflowState.id = null;
        } else {
          // Update workflow state with current data from server
          const workflow = getResponse.data;
          workflowState.state = workflow.state as 'inactive' | 'active' | 'failed';
          workflowState.executionId = workflow.executionId;
          workflowState.lastCheck = new Date().toISOString();
          
          console.log(`✅ ${workflowType}: Workflow verified and status updated - Status: ${workflowState.state}, ExecutionId: ${workflowState.executionId}`);
          return true; // Return true to indicate status was already checked
        }
      } catch (error) {
        console.log(`⚠️ ${workflowType}: Failed to verify workflow on server, will recreate`);
        workflowState.id = null;
      }
    }

    if (workflowState.id && workflowState.createdAt && new Date(workflowState.createdAt).toDateString() !== new Date().toDateString()) {

      console.log(`🛑 ${workflowType}: Stopping workflow...`);
      const stopResponse = await apiService.stopWorkflow(workflowState.id);
      
      if (stopResponse.success) {
        workflowState.started = false;
        workflowState.state = 'inactive';
        console.log(`✅ ${workflowType}: Workflow stopped successfully`);
      } else {
        console.log(`⚠️ ${workflowType}: Failed to stop workflow: ${stopResponse.error}`);
      }

      workflowState.id = null;
    }

    console.log(`🔨 ${workflowType}: Creating workflow...`);
    
    const template = WORKFLOW_TEMPLATES[workflowType];
    if (!template) {
      throw new Error(`No template found for workflow type: ${workflowType}`);
    }

    const createResponse = await apiService.createWorkflow(template);
    
    if (!createResponse.success) {
      throw new Error(`Failed to create workflow: ${createResponse.error}`);
    }

    workflowState.id = createResponse.data.id;
    workflowState.name = createResponse.data.name;
    workflowState.state = createResponse.data.state as 'inactive' | 'active' | 'failed';
    workflowState.createdAt = createResponse.data.dateCreated;
    workflowState.started = false;
    
    console.log(`✅ ${workflowType}: Workflow created successfully (ID: ${workflowState.id})`);
    return false; // Return false to indicate status check is still needed
  }

  private async ensureWorkflowRunning(workflowType: string, workflowState: WorkflowState): Promise<boolean> {
    if (!workflowState.id) {
      throw new Error('Workflow ID is missing');
    }

    // Fetch current workflow status from server
    const getResponse = await apiService.getWorkflow(workflowState.id);
    if (!getResponse.success) {
      throw new Error(`Failed to fetch workflow from server: ${getResponse.error}`);
    }

    // Check if workflow is already started
    if (workflowState.started && workflowState.state === 'active') {
      console.log(`📊 ${workflowType}: Workflow already started`);
      return true;
    } else {
      // Workflow not started yet, start it
      console.log(`🚀 ${workflowType}: Starting workflow execution...`);
      const runResponse = await apiService.runWorkflow(workflowState.id);
      
      if (runResponse.success) {
        workflowState.started = true;
        workflowState.lastExecution = new Date().toISOString();
        console.log(`✅ ${workflowType}: Workflow execution started (ID: ${runResponse.data.executionId})`);
      } else {
        console.log(`⚠️ ${workflowType}: Failed to start workflow: ${runResponse.error}`);
      }
      return false;
    }
  }

  private async fetchWorkflowExecutions(workflowType: string, workflowState: WorkflowState): Promise<any[]> {
    if (!workflowState.id) {
      throw new Error('Workflow ID is missing');
    }

    console.log(`📊 ${workflowType}: Fetching executions...`);
    const executionsResponse = await apiService.getRecentExecutionsByWorkflowId(workflowState.id);
    
    if (!executionsResponse.success) {
      throw new Error(`Failed to fetch executions: ${executionsResponse.error}`);
    }

    const executions = executionsResponse.data.data || [];
    console.log(`📋 ${workflowType}: Found ${executions.length} executions`);

    return executions;
  }

  private async fetchComparisonData(workflowType: string): Promise<any[]> {

    const template = WORKFLOW_TEMPLATES[workflowType];

    const parameters = template.nodes[0].parameters;

    const verificationResult = await verifyWorkflow(workflowType, parameters);

    return verificationResult;
  }

  public async runMonitoring(): Promise<void> {
    console.log('🚀 Starting workflow monitoring...');
    const currentDate = dataService.getCurrentDateString();

    try {
      // Load existing workflow states
      const workflowsState = await dataService.loadWorkflowsState();
      console.log(`📂 Loaded state for ${Object.keys(workflowsState).length} workflows`);

      // Process each workflow type
      for (const workflowType of Object.values(WORKFLOW_TYPES)) {
        console.log(`\n🔍 Processing ${workflowType}...`);
        
        const workflowState = workflowsState[workflowType];

        try {

          // Ensure workflow exists and get status in one call when possible
          // Compare src json vs server data
          // if not exist -> create new wf
          // if exist -> update status from server response
          await this.ensureWorkflowExists(workflowType, workflowState);
          
          await this.ensureWorkflowRunning(workflowType, workflowState);

          // Fetch comparison data
          const [comparisonData, executions] = await Promise.all([
            this.fetchComparisonData(workflowType),
            this.fetchWorkflowExecutions(workflowType, workflowState)
          ]);
          
          await dataService.saveComparisonData(currentDate, workflowType, comparisonData);
          await dataService.saveExecutionResult(currentDate, workflowType, executions);

        } catch (error) {
          console.error(`❌ ${workflowType}: Critical error - ${error}`);
        }
      }

      // Save updated states
      await dataService.saveWorkflowsState(workflowsState);
      console.log('\n💾 Workflow states saved');

    } catch (error) {
      console.error('💥 Monitoring failed:', error);
      process.exit(1);
    }
  }
}

// Run monitor if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const monitor = new WorkflowMonitor();
  monitor.runMonitoring().catch(console.error);
}