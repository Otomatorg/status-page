import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { WorkflowState } from '../types/types.js';
import { WORKFLOW_TYPES } from '../constants/constants.js';
import { apiService } from './apiService.js';
import { convertBigIntToString } from '../utils/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DataService {
  private readonly dataDir = path.resolve(__dirname, '../../docs/data');
  private readonly workflowsStateFile = path.join(this.dataDir, 'workflows.json');

  private async ensureDataDirectory(): Promise<void> {
    try {
      await fs.access(this.dataDir);
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true });
    }
  }

  private async ensureExecutionsDirectory(date: string): Promise<void> {
    const executionsDir = path.join(this.dataDir, 'executions', date);
    try {
      await fs.access(executionsDir);
    } catch {
      await fs.mkdir(executionsDir, { recursive: true });
    }
  }

  async loadWorkflowsState(): Promise<Record<string, WorkflowState>> {
    try {
      await this.ensureDataDirectory();
      const data = await fs.readFile(this.workflowsStateFile, 'utf-8');
      const loadedState: Record<string, WorkflowState> = JSON.parse(data);

      // Ensure all workflow types are present (initialize missing ones)
      let updated = false;
      Object.values(WORKFLOW_TYPES).forEach(type => {
        if (!loadedState[type]) {
          loadedState[type] = {
            id: null,
            started: false,
            name: `Workflow - ${type}`,
            type,
            state: 'not_created',
            executionId: null,
            lastCheck: null,
            lastExecution: null,
            isHealthy: false,
            createdAt: null,
            errorCount: 0,
            lastError: null
          };
          updated = true;
        }
      });

      // Optionally persist the update if new workflow types were added
      if (updated) {
        await fs.writeFile(this.workflowsStateFile, JSON.stringify(loadedState, null, 2));
      }

      return loadedState;
    } catch {
      // Initialize with default state for all workflow types
      const defaultState: Record<string, WorkflowState> = {};
      
      Object.values(WORKFLOW_TYPES).forEach(type => {
        defaultState[type] = {
          id: null,
          started: false,
          name: `Workflow - ${type}`,
          type,
          state: 'not_created',
          executionId: null,
          lastCheck: null,
          lastExecution: null,
          isHealthy: false,
          createdAt: null,
          errorCount: 0,
          lastError: null
        };
      });

      return defaultState;
    }
  }

  async saveWorkflowsState(workflowsState: Record<string, WorkflowState>): Promise<void> {
    await this.ensureDataDirectory();
    await fs.writeFile(
      this.workflowsStateFile,
      JSON.stringify(convertBigIntToString(workflowsState), null, 2)
    );
  }

  async updateWorkflowState(workflowType: string, partialState: Partial<WorkflowState>): Promise<void> {
    await this.ensureDataDirectory();
    const workflowsState: Record<string, WorkflowState> = await this.loadWorkflowsState();

    if (!workflowsState[workflowType]) {
      console.log(`[updateWorkflowState] Workflow type "${workflowType}" does not exist. Initializing with defaults.`);
      // If the workflow type doesn't exist, initialize with defaults
      workflowsState[workflowType] = {
        id: null,
        started: false,
        name: `Workflow - ${workflowType}`,
        type: workflowType,
        state: 'not_created',
        executionId: null,
        lastCheck: null,
        lastExecution: null,
        isHealthy: false,
        createdAt: null,
        errorCount: 0,
        lastError: null,
        // outputs is optional, but we initialize it for long-running workflows
        outputs: {
          current: undefined,
          previous: undefined
        }
      };
    } else {
      // If the workflow exists but outputs is missing, add it
      if (!('outputs' in workflowsState[workflowType])) {
        console.log(`[updateWorkflowState] Workflow type "${workflowType}" exists but outputs is missing. Initializing outputs.`);
        workflowsState[workflowType].outputs = {
          current: undefined,
          previous: undefined
        };
      }
    }

    const prevState = { ...workflowsState[workflowType] };
    workflowsState[workflowType] = {
      ...workflowsState[workflowType],
      ...partialState
    };

    // console.log(`[updateWorkflowState] Updating workflow state for "${workflowType}".`);
    // console.log(`[updateWorkflowState] Previous state:`, prevState);
    // console.log(`[updateWorkflowState] New state:`, workflowsState);

    await this.saveWorkflowsState(workflowsState);
    // console.log(`[updateWorkflowState] Workflow state for "${workflowType}" saved to file.`);
  }

  async saveWorkflowOutput(workflowType: string, result: any): Promise<void> {
    // Load current workflow state
    await this.ensureDataDirectory();
    const workflowsState: Record<string, WorkflowState> = await this.loadWorkflowsState();

    const outputs = workflowsState[workflowType].outputs || {};
    const now = new Date().toISOString();

    // If no current output, save to current
    if (outputs.current === undefined) {
      // console.log(`[saveWorkflowOutput] No current output for ${workflowType}. Saving new output as current.`);
      await this.updateWorkflowState(workflowType, {
        outputs: {
          current: { ...result[0], dateCreated: now },
          previous: undefined
        }
      });
      // console.log(`[saveWorkflowOutput] Output saved for ${workflowType}:`, { ...result[0], dateCreated: now });
      return;
    }

    // If result is the same as current, skip
    if (this.getComparisonDataValue(workflowType, outputs.current) == this.getComparisonDataValue(workflowType, result[0])) {
      // console.log(`[saveWorkflowOutput] Output for ${workflowType} is unchanged. Skipping save.`);
      return;
    }

    // If result is different, move current to previous, save new current
    // console.log(`[saveWorkflowOutput] Output for ${workflowType} has changed. Updating outputs.`);
    await this.updateWorkflowState(workflowType, {
      outputs: {
        current: { ...result[0], dateCreated: now },
        previous: outputs.current
      }
    });
    // console.log(`[saveWorkflowOutput] Output updated for ${workflowType}. New current:`, { ...result[0], dateCreated: now }, "Previous:", outputs.current);
  }

  async saveExecutionResult(date: string, workflowType: string, result: any): Promise<void> {
    await this.ensureExecutionsDirectory(date);
    
    const executionsFile = path.join(this.dataDir, 'executions', date, 'executions.json');
    
    let executions: Record<string, any[]> = {};
    
    try {
      const data = await fs.readFile(executionsFile, 'utf-8');
      executions = JSON.parse(data);
    } catch {
      // File doesn't exist, start with empty object
    }

    if (!executions[workflowType]) {
      executions[workflowType] = [];
    }

    // Check for existing execution IDs to avoid duplicates
    const existingExecutionIds = new Set(
      executions[workflowType].map(execution => {
        return execution.id;
      }).filter(Boolean)
    );
    
    // Filter out results that already exist based on executionId
    const newResults = result.filter((execution: any) => 
      !execution.id || !existingExecutionIds.has(execution.id)
    ).map((execution: any) => {
      return {
        ...execution,
        status: 'new'
      }
    });

    executions[workflowType].push(...newResults);

    for (const execution of executions[workflowType]) {
      if (execution.nodeOutputs === undefined || execution.nodeOutputs?.length === 0 || execution.nodeOutputs[0].output === null) {
        // Fetch execution details for each execution
        const executionDetailResponse = await apiService.getExecution(execution.id);
        if (executionDetailResponse.success) {
          const executionDetail = executionDetailResponse.data;
          
          // Extract node outputs from the execution detail
          const nodeOutputs = executionDetail.workflow?.nodes?.map((node: any) => ({
            blockId: node.blockId,
            output: node.output,
            param: node.parameters,
          })) || [];
          
          // Add node outputs to the execution object
          execution.nodeOutputs = nodeOutputs;
          execution.state = executionDetail.state;
        }
      }
    }
    
    await fs.writeFile(executionsFile, JSON.stringify(executions, null, 2));
  } 

  getComparisonDataValue(workflowType: string, result: any): string {
    if (workflowType === 'BALANCE') {
      return `${result.balance}`;
    } else if (workflowType === 'STAKESTONE' || workflowType === 'STRESS_LOOP') {
      return `${result.latestRoundID}`;
    } else if (workflowType === 'PRICE') {
      return `${result.price}`;
    }
    return '';
  }

  async saveComparisonData(date: string, workflowType: string, result: any): Promise<void> {
    // Special case for STRESS_LOOP: use updateWorkflowState to store value directly into workflow state file, not in comparisonData
    if (workflowType === 'STRESS_LOOP') {
      // Use the updateWorkflowState helper to update the output field
      // console.log("workflowType", workflowType);
      // console.log("result", result);
      await this.saveWorkflowOutput(workflowType, result);
      return;
    }

    await this.ensureExecutionsDirectory(date);

    const comparisonDataFile = path.join(this.dataDir, 'executions', date, 'comparisonData.json');

    let comparisonData: Record<string, any[]> = {};

    try {
      const data = await fs.readFile(comparisonDataFile, 'utf-8');
      comparisonData = JSON.parse(data);
    } catch {
      // File doesn't exist, start with empty object
    }

    if (!comparisonData[workflowType]) {
      comparisonData[workflowType] = [];
    }

    let newResults = [];

    // Special case for TRANSFER: deduplicate by txHash in output
    if (workflowType === 'TRANSFER') {
      newResults = result;
    } else if (workflowType !== 'EVERY_PERIOD') {
      const existingSignatures = new Set<string>(
        comparisonData[workflowType].map((item: any) => {
          return this.getComparisonDataValue(workflowType, item);
        })
      );

      newResults = result.filter((item: any) => {
        let signature = '';
        if (workflowType === 'BALANCE') {
          signature = `${item.balance}`;
        } else if (workflowType === 'STAKESTONE') {
          signature = `${item.latestRoundID}`;
        } else if (workflowType === 'PRICE') {
          signature = `${item.price}`;
        }
        return !existingSignatures.has(signature);
      });
    }

    // Add a timestamp to each new result
    newResults = newResults.map((item: any) => ({
      ...item,
      dateCreated: new Date().toISOString()
    }));

    if (workflowType === 'TRANSFER') {
      comparisonData[workflowType] = newResults;
    } else {
      comparisonData[workflowType].push(...newResults);
    }

    await fs.writeFile(comparisonDataFile, JSON.stringify(convertBigIntToString(comparisonData), null, 2));
  }

  async updateComparisonData(date: string, workflowType: string, result: any): Promise<void> {
    await this.ensureExecutionsDirectory(date);

    const comparisonDataFile = path.join(this.dataDir, 'executions', date, 'comparisonData.json');

    let comparisonData: Record<string, any[]> = {};

    try {
      const data = await fs.readFile(comparisonDataFile, 'utf-8');
      comparisonData = JSON.parse(data);
    } catch {
      // File doesn't exist, start with empty object
    }

    if (!comparisonData[workflowType]) {
      comparisonData[workflowType] = [];
    }

    // Update the comparison data for the specified workflow type
    comparisonData[workflowType] = result.map((item: any) => ({
      ...item,
      dateCreated: new Date().toISOString()
    }));

    await fs.writeFile(comparisonDataFile, JSON.stringify(convertBigIntToString(comparisonData), null, 2));
  }

  async saveError(date: string, workflowType: string, error: string, timestamp: string): Promise<void> {
    await this.ensureExecutionsDirectory(date);
    
    const errorsFile = path.join(this.dataDir, 'executions', date, 'errors.json');
    
    let errors: Record<string, Array<{ timestamp: string; error: string; }>> = {};
    
    try {
      const data = await fs.readFile(errorsFile, 'utf-8');
      errors = JSON.parse(data);
    } catch {
      // File doesn't exist, start with empty object
    }

    if (!errors[workflowType]) {
      errors[workflowType] = [];
    }
    
    errors[workflowType].push({ timestamp, error });
    
    await fs.writeFile(errorsFile, JSON.stringify(errors, null, 2));
  }

  getCurrentDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  async loadExecutions(date: string): Promise<Record<string, any[]> | null> {
    try {
      const executionsFile = path.join(this.dataDir, 'executions', date, 'executions.json');
      const data = await fs.readFile(executionsFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async loadErrorLog(date: string): Promise<Record<string, any[]> | null> {
    try {
      const errorLogFile = path.join(this.dataDir, 'executions', date, 'errorLog.json');
      const data = await fs.readFile(errorLogFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async saveErrorLog(date: string, workflowType: string, error: any): Promise<void> {
    await this.ensureDataDirectory();
    await this.ensureExecutionsDirectory(date);

    const errorLogFile = path.join(this.dataDir, 'executions', date, 'errorLog.json');
    
    // Load existing error log or create new one
    let errorLog: Record<string, any[]>;
    try {
      const existingData = await fs.readFile(errorLogFile, 'utf-8');
      errorLog = JSON.parse(existingData);
    } catch {
      errorLog = {
        BALANCE: [],
        STAKESTONE: [],
        PRICE: [],
        TRANSFER: [],
        EVERY_PERIOD: []
      };
    }

    // Add new error to the appropriate workflow type
    if (!errorLog[workflowType]) {
      errorLog[workflowType] = [];
    }
    errorLog[workflowType].push({
      ...error,
      timestamp: new Date().toISOString()
    });

    await fs.writeFile(errorLogFile, JSON.stringify(errorLog, null, 2));
  }

  async overrideErrorLog(date: string, errorLog: Record<string, any[]>): Promise<void> {
    await this.ensureDataDirectory();
    const errorLogFile = path.join(this.dataDir, 'executions', date, 'errorLog.json');
    await fs.writeFile(errorLogFile, JSON.stringify(errorLog, null, 2));
  }
}

export const dataService = new DataService(); 