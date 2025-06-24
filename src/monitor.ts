#!/usr/bin/env node

import { WorkflowState, MonitoringResult } from './types/workflow.js';
import { WORKFLOW_TYPES } from './constants/workflowTypes.js';
import { WORKFLOW_TEMPLATES } from './templates/workflowTemplates.js';
import { apiService } from './services/apiService.js';
import { dataService } from './services/dataService.js';
import { verifyWorkflow } from './verifiers/workflowVerifiers.js';

class WorkflowMonitor {
  private async ensureWorkflowExists(workflowType: string, workflowState: WorkflowState): Promise<void> {
    // If workflow already exists, skip creation
    if (workflowState.id) {
      console.log(`✅ ${workflowType}: Workflow exists (ID: ${workflowState.id})`);
      return;
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
    
    console.log(`✅ ${workflowType}: Workflow created successfully (ID: ${workflowState.id})`);
  }

  private async checkWorkflowStatus(workflowType: string, workflowState: WorkflowState): Promise<void> {
    if (!workflowState.id) {
      throw new Error(`Workflow ${workflowType} has no ID`);
    }

    const getResponse = await apiService.getWorkflow(workflowState.id);
    
    if (!getResponse.success) {
      throw new Error(`Failed to get workflow status: ${getResponse.error}`);
    }

    const workflow = getResponse.data;
    workflowState.state = workflow.state as 'inactive' | 'active' | 'failed';
    workflowState.executionId = workflow.executionId;
    workflowState.lastCheck = new Date().toISOString();

    console.log(`📊 ${workflowType}: Status = ${workflowState.state}, ExecutionId = ${workflowState.executionId}`);
  }

  private async runWorkflowTest(workflowType: string, workflowState: WorkflowState): Promise<MonitoringResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // Skip if workflow is currently running
      if (workflowState.state === 'active') {
        console.log(`⏸️  ${workflowType}: Workflow is running, skipping test`);
        return {
          workflowType,
          success: false,
          timestamp,
          executionId: workflowState.executionId,
          verificationResult: {
            passed: false,
            details: 'Workflow is currently running - skipped test',
            checks: []
          },
          error: 'Workflow is currently running',
          timeElapsed: Date.now() - startTime
        };
      }

      if (!workflowState.id) {
        throw new Error('Workflow ID is missing');
      }

      // Get workflow details for verification
      const workflowResponse = await apiService.getWorkflow(workflowState.id);
      if (!workflowResponse.success) {
        throw new Error(`Failed to get workflow: ${workflowResponse.error}`);
      }

      // Run verification (this is where the empty functions are called)
      const verificationResult = await verifyWorkflow(
        workflowType,
        workflowResponse.data,
        workflowState.executionId
      );

      // Optional: Actually run the workflow for testing (uncomment if needed)
      // const runResponse = await apiService.runWorkflow(workflowState.id);
      // if (runResponse.success) {
      //   workflowState.executionId = runResponse.data.executionId;
      //   workflowState.lastExecution = timestamp;
      // }

      const success = verificationResult.passed;
      workflowState.isHealthy = success;
      
      if (success) {
        workflowState.errorCount = 0;
        workflowState.lastError = null;
        console.log(`✅ ${workflowType}: Verification passed`);
      } else {
        workflowState.errorCount++;
        workflowState.lastError = verificationResult.details;
        console.log(`❌ ${workflowType}: Verification failed - ${verificationResult.details}`);
      }

      return {
        workflowType,
        success,
        timestamp,
        executionId: workflowState.executionId,
        verificationResult,
        error: success ? null : verificationResult.details,
        timeElapsed: Date.now() - startTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      workflowState.errorCount++;
      workflowState.lastError = errorMessage;
      workflowState.isHealthy = false;

      console.error(`❌ ${workflowType}: Test failed - ${errorMessage}`);

      return {
        workflowType,
        success: false,
        timestamp,
        executionId: workflowState.executionId,
        verificationResult: {
          passed: false,
          details: errorMessage,
          checks: []
        },
        error: errorMessage,
        timeElapsed: Date.now() - startTime
      };
    }
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
          // Ensure workflow exists
          await this.ensureWorkflowExists(workflowType, workflowState);
          
          // Check current status
          await this.checkWorkflowStatus(workflowType, workflowState);
          
          // Run verification test
          const result = await this.runWorkflowTest(workflowType, workflowState);
          
          // Save execution result
          await dataService.saveExecutionResult(currentDate, workflowType, result);
          
          if (!result.success) {
            await dataService.saveError(
              currentDate,
              workflowType,
              result.error || 'Unknown error',
              result.timestamp
            );
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ ${workflowType}: Critical error - ${errorMessage}`);
          
          workflowState.errorCount++;
          workflowState.lastError = errorMessage;
          workflowState.isHealthy = false;
          
          await dataService.saveError(currentDate, workflowType, errorMessage, new Date().toISOString());
        }
      }

      // Save updated states
      await dataService.saveWorkflowsState(workflowsState);
      console.log('\n💾 Workflow states saved');

      // Generate monitoring report
      await dataService.generateMonitoringReport(workflowsState);
      console.log('📊 Monitoring report generated');

      console.log('\n✅ Monitoring completed successfully');

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