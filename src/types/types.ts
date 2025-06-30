export interface WorkflowNode {
  id: string;
  ref: string;
  blockId: number;
  executionId: string | null;
  type: 'trigger' | 'action';
  state: 'inactive' | 'active' | 'failed';
  position: {
    x: number;
    y: number;
  };
  parameters: Record<string, any>;
  handler: string | null;
  handlerKey: string | null;
  dateCreated: string;
  dateModified: string;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  value: string | null;
  label: string | null;
}

export interface WorkflowSettings {
  loopingType: string;
  limit: number;
  period: number;
}

export interface Workflow {
  id: string;
  name: string;
  executionId: string | null;
  agentId: string | null;
  state: 'inactive' | 'active' | 'failed';
  settings: WorkflowSettings;
  dateCreated: string;
  dateModified: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  notes: any[];
}

export interface CreateWorkflowPayload {
  name: string;
  nodes: Omit<WorkflowNode, 'id' | 'executionId' | 'state' | 'dateCreated' | 'dateModified'>[];
  edges: Omit<WorkflowEdge, 'id'>[];
  settings: WorkflowSettings;
}

export interface ExecutionResponse {
  executionId: string;
}

export interface ExecutionNotification {
  id: string;
  isSeen: boolean;
}

export interface ExecutionWorkflow {
  id: string;
  name: string;
  nodes: any[] | null;
  state: string;
}

export interface Execution {
  id: string;
  workflow: ExecutionWorkflow;
  state: string;
  count: number;
  totalUnseen: number;
  notification: ExecutionNotification | null;
  dateCreated: string;
  dateModified: string;
  status: string;
  nodeOutputs: {
    blockId: number;
    output: any;
    param?: any;
  }[];
}

export interface ExecutionsResponse {
  data: Execution[];
}

export interface ExecutionAnalysis {
  recentExecutions: Execution[];
  failedExecutions: Execution[];
  completedExecutions: Execution[];
  runningExecutions: Execution[];
}

export interface WorkflowState {
  id: string | null;
  started: boolean;
  name: string;
  type: string;
  state: 'not_created' | 'inactive' | 'active' | 'failed';
  executionId: string | null;
  lastCheck: string | null;
  lastExecution: string | null;
  isHealthy: boolean;
  createdAt: string | null;
  errorCount: number;
  lastError: string | null;
}

export interface MonitoringResult {
  workflowType: string;
  success: boolean;
  timestamp: string;
  executionId: string | null;
  verificationResult: VerificationResult;
  error: string | null;
  timeElapsed: number;
}

export interface VerificationResult {
  passed: boolean;
  details: string;
  checks: {
    name: string;
    passed: boolean;
    message: string;
  }[];
}

export interface MonitoringReport {
  generatedAt: string;
  totalWorkflows: number;
  healthyWorkflows: number;
  failedWorkflows: number;
  notCreatedWorkflows: number;
  executions: MonitoringResult[];
  summary: {
    overall: 'healthy' | 'degraded' | 'critical';
    issues: string[];
  };
}

export interface VerificationError {
  message: string;
  timestamp: string;
  data: any;
} 