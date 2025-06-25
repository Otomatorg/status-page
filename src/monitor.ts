#!/usr/bin/env node

import { WorkflowState, MonitoringResult } from './types/workflow.js';
import { WORKFLOW_TYPES } from './constants/workflowTypes.js';
import { WORKFLOW_TEMPLATES } from './templates/workflowTemplates.js';
import { apiService } from './services/apiService.js';
import { dataService } from './services/dataService.js';
import { verifyWorkflow } from './verifiers/workflowVerifiers.js';

class WorkflowMonitor {
  private async ensureWorkflowExists(workflowType: string, workflowState: WorkflowState): Promise<boolean> {

    // If workflow already exists, verify and update status in one call
    if (workflowState.id) {
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
    return false; // Return false to indicate status check is still needed
  }

  private async checkWorkflowStatus(workflowType: string, workflowState: WorkflowState): Promise<void> {
    if (!workflowState.id) {
      throw new Error(`Workflow ${workflowType} has no ID`);
    }

    const currentDate = new Date().toISOString();
    let getResponse: any;

    try {
      getResponse = await apiService.getWorkflow(workflowState.id);
      if (!getResponse.success) {
        throw new Error(`Failed to get workflow status for ${workflowType}: ${getResponse.error}`);
      }
    } catch (error) {
      console.error(`Failed to get workflow status for ${workflowType}: ${error}`);
      workflowState.state = 'not_created';
      workflowState.lastCheck = currentDate;
      return; // Continue monitoring other workflows instead of throwing
    }

    const workflow = getResponse.data;
    workflowState.state = workflow.state as 'inactive' | 'active' | 'failed';
    workflowState.lastCheck = currentDate;

    console.log(`📊 ${workflowType}: Status = ${workflowState.state}`);
  }

  private async runWorkflowTest(workflowType: string, workflowState: WorkflowState): Promise<any> {
    // const startTime = Date.now();
    // const timestamp = new Date().toISOString();

    if (!workflowState.id) {
      throw new Error('Workflow ID is missing');
    }

    if (workflowState.state !== 'active') {
      console.log(`🚀 ${workflowType}: Starting workflow execution...`);
      const runResponse = await apiService.runWorkflow(workflowState.id);
      
      if (runResponse.success) {
        workflowState.lastExecution = new Date().toISOString();
        console.log(`✅ ${workflowType}: Workflow execution started (ID: ${runResponse.data.executionId})`);
      } else {
        console.log(`⚠️ ${workflowType}: Failed to start workflow: ${runResponse.error}`);
      }
      return [];
    } else {

      console.log(`📊 ${workflowType}: Fetching all executions...`);
      const executionsResponse = await apiService.getRecentExecutionsByWorkflowId(workflowState.id);
      
      if (!executionsResponse.success) {
        throw new Error(`Failed to fetch executions: ${executionsResponse.error}`);
      }

      const executions = executionsResponse.data.data || [];
      console.log(`📋 ${workflowType}: Found ${executions.length} executions`);

      return executions;
    }


    // try {
    //   if (!workflowState.id) {
    //     throw new Error('Workflow ID is missing');
    //   }

    //   // Check if workflow is currently running
    //   if (workflowState.state === 'active') {
    //     console.log(`⏸️  ${workflowType}: Workflow is currently running, will analyze recent executions`);
    //   } else {
    //     // Workflow is not running, trigger a new execution
    //     console.log(`🚀 ${workflowType}: Starting workflow execution...`);
    //     const runResponse = await apiService.runWorkflow(workflowState.id);
        
    //     if (runResponse.success) {
    //       workflowState.executionId = runResponse.data.executionId;
    //       workflowState.lastExecution = timestamp;
    //       console.log(`✅ ${workflowType}: Workflow execution started (ID: ${runResponse.data.executionId})`);
    //     } else {
    //       console.log(`⚠️ ${workflowType}: Failed to start workflow: ${runResponse.error}`);
    //     }
        
    //     // Wait a moment for the execution to potentially start
    //     await new Promise(resolve => setTimeout(resolve, 2000));
    //   }

    //   // Fetch executions from the last 30 minutes
    //   console.log(`📊 ${workflowType}: Fetching executions from last 30 minutes...`);
    //   const executionsResponse = await apiService.getRecentExecutionsByWorkflowId(workflowState.id, 30);
      
    //   if (!executionsResponse.success) {
    //     throw new Error(`Failed to fetch recent executions: ${executionsResponse.error}`);
    //   }

    //   const executions = executionsResponse.data.data || [];
    //   console.log(`📋 ${workflowType}: Found ${executions.length} executions in last 30 minutes`);

    //   // Filter executions from last 30 minutes (client-side filter as backup)
    //   const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    //   const recentExecutions = executions.filter((execution: any) => {
    //     const executionDate = new Date(execution.dateCreated);
    //     return executionDate >= thirtyMinutesAgo;
    //   });

    //   // Analyze executions
    //   const failedExecutions = recentExecutions.filter((exec: any) => exec.state === 'failed');
    //   const completedExecutions = recentExecutions.filter((exec: any) => exec.state === 'completed');
    //   const runningExecutions = recentExecutions.filter((exec: any) => exec.state === 'running');

    //   console.log(`📈 ${workflowType}: Analysis - ${completedExecutions.length} completed, ${failedExecutions.length} failed, ${runningExecutions.length} running`);

    //   // Get workflow details for verification
    //   const workflowResponse = await apiService.getWorkflow(workflowState.id);
    //   if (!workflowResponse.success) {
    //     throw new Error(`Failed to get workflow: ${workflowResponse.error}`);
    //   }

    //   // Run verification with execution data
    //   const verificationResult = await verifyWorkflow(
    //     workflowType,
    //     workflowResponse.data,
    //     workflowState.executionId,
    //     {
    //       recentExecutions,
    //       failedExecutions,
    //       completedExecutions,
    //       runningExecutions
    //     }
    //   );

    //   // Determine overall success based on verifications and execution states
    //   const hasRecentFailures = failedExecutions.length > 0;
    //   const hasRecentSuccesses = completedExecutions.length > 0;
    //   const success = verificationResult.passed && !hasRecentFailures;

    //   workflowState.isHealthy = success;
      
    //   if (success) {
    //     workflowState.errorCount = 0;
    //     workflowState.lastError = null;
    //     console.log(`✅ ${workflowType}: Monitoring passed - ${completedExecutions.length} successful executions, no failures`);
    //   } else {
    //     workflowState.errorCount++;
    //     const errorDetails = hasRecentFailures 
    //       ? `${failedExecutions.length} failed executions in last 30 minutes`
    //       : verificationResult.details;
    //     workflowState.lastError = errorDetails;
    //     console.log(`❌ ${workflowType}: Monitoring failed - ${errorDetails}`);
    //   }

    //   return {
    //     workflowType,
    //     success,
    //     timestamp,
    //     executionId: workflowState.executionId,
    //     verificationResult: {
    //       ...verificationResult,
    //       details: success ? verificationResult.details : (hasRecentFailures 
    //         ? `${failedExecutions.length} failed executions found`
    //         : verificationResult.details)
    //     },
    //     error: success ? null : workflowState.lastError,
    //     timeElapsed: Date.now() - startTime
    //   };

    // } catch (error) {
    //   const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    //   workflowState.errorCount++;
    //   workflowState.lastError = errorMessage;
    //   workflowState.isHealthy = false;

    //   console.error(`❌ ${workflowType}: Test failed - ${errorMessage}`);

    //   return {
    //     workflowType,
    //     success: false,
    //     timestamp,
    //     executionId: workflowState.executionId,
    //     verificationResult: {
    //       passed: false,
    //       details: errorMessage,
    //       checks: []
    //     },
    //     error: errorMessage,
    //     timeElapsed: Date.now() - startTime
    //   };
    // }
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
          const statusAlreadyChecked = await this.ensureWorkflowExists(workflowType, workflowState);

          // Only check status if it wasn't already updated in ensureWorkflowExists
          if (!statusAlreadyChecked) {
            await this.checkWorkflowStatus(workflowType, workflowState);
          }
          
          // Run verification test
          const result = await this.runWorkflowTest(workflowType, workflowState);
          
          // // Save execution result
          await dataService.saveExecutionResult(currentDate, workflowType, result);
          
          // if (!result.success) {
          //   await dataService.saveError(
          //     currentDate,
          //     workflowType,
          //     result.error || 'Unknown error',
          //     result.timestamp
          //   );
          // }

        } catch (error) {
          // const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          // console.error(`❌ ${workflowType}: Critical error - ${errorMessage}`);
          
          // workflowState.errorCount++;
          // workflowState.lastError = errorMessage;
          // workflowState.isHealthy = false;
          
          // await dataService.saveError(currentDate, workflowType, errorMessage, new Date().toISOString());
        }
      }

      // // Save updated states
      await dataService.saveWorkflowsState(workflowsState);
      console.log('\n💾 Workflow states saved');

      // // Generate monitoring report
      // await dataService.generateMonitoringReport(workflowsState);
      // console.log('📊 Monitoring report generated');

      // console.log('\n✅ Monitoring completed successfully');

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