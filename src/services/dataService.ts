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
  private readonly dataDir = path.resolve(__dirname, '../../docs');
  private readonly workflowsStateFile = path.join(this.dataDir, 'workflows.json');
  private readonly reportFile = path.join(this.dataDir, 'monitoring-report.json');  

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
      return JSON.parse(data);
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
      JSON.stringify(workflowsState, null, 2)
    );
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

  async saveComparisonData(date: string, workflowType: string, result: any): Promise<void> {
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
          if (workflowType === 'BALANCE') {
            return `${item.balance}`;
          } else if (workflowType === 'STAKESTONE') {
            return `${item.latestRoundID}`;
          } else if (workflowType === 'PRICE') {
            return `${item.price}`;
          }
          return '';
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