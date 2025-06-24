import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { WorkflowState, MonitoringResult, MonitoringReport } from '../types/workflow.js';
import { WORKFLOW_TYPES } from '../constants/workflowTypes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DataService {
  private readonly dataDir = path.resolve(__dirname, '../../public/data');
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

  async saveExecutionResult(date: string, workflowType: string, result: MonitoringResult): Promise<void> {
    await this.ensureExecutionsDirectory(date);
    
    const executionsFile = path.join(this.dataDir, 'executions', date, 'executions.json');
    
    let executions: Record<string, MonitoringResult[]> = {};
    
    try {
      const data = await fs.readFile(executionsFile, 'utf-8');
      executions = JSON.parse(data);
    } catch {
      // File doesn't exist, start with empty object
    }

    if (!executions[workflowType]) {
      executions[workflowType] = [];
    }
    
    executions[workflowType].push(result);
    
    await fs.writeFile(executionsFile, JSON.stringify(executions, null, 2));
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

  async generateMonitoringReport(workflowsState: Record<string, WorkflowState>): Promise<void> {
    const totalWorkflows = Object.keys(workflowsState).length;
    const healthyWorkflows = Object.values(workflowsState).filter(w => w.isHealthy).length;
    const failedWorkflows = Object.values(workflowsState).filter(w => w.state === 'failed').length;
    const notCreatedWorkflows = Object.values(workflowsState).filter(w => w.state === 'not_created').length;

    const issues: string[] = [];
    
    Object.entries(workflowsState).forEach(([type, state]) => {
      if (state.state === 'failed') {
        issues.push(`${type}: Workflow failed - ${state.lastError}`);
      }
      if (state.state === 'not_created') {
        issues.push(`${type}: Workflow not created yet`);
      }
      if (state.errorCount > 5) {
        issues.push(`${type}: High error count (${state.errorCount})`);
      }
    });

    let overall: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (failedWorkflows > 0 || notCreatedWorkflows > totalWorkflows / 2) {
      overall = 'critical';
    } else if (healthyWorkflows < totalWorkflows * 0.8) {
      overall = 'degraded';
    }

    const report: MonitoringReport = {
      generatedAt: new Date().toISOString(),
      totalWorkflows,
      healthyWorkflows,
      failedWorkflows,
      notCreatedWorkflows,
      executions: [], // This would be populated from recent execution results
      summary: {
        overall,
        issues
      }
    };

    await this.ensureDataDirectory();
    await fs.writeFile(this.reportFile, JSON.stringify(report, null, 2));
  }

  getCurrentDateString(): string {
    return new Date().toISOString().split('T')[0];
  }
}

export const dataService = new DataService(); 