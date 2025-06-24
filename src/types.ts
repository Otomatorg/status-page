export interface ServiceEndpoint {
  name: string;
  url: string;
  expectedStatus: number;
  timeout: number;
}

export interface StatusCheck {
  timestamp: string;
  service: string;
  url: string;
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  statusCode?: number;
  error?: string;
}

export interface ServiceStatus {
  name: string;
  status: 'up' | 'down' | 'degraded';
  lastCheck: string;
  uptime: number;
  responseTime: number;
  incidents: StatusCheck[];
}

export interface StatusReport {
  generatedAt: string;
  overall: 'operational' | 'degraded' | 'down';
  services: ServiceStatus[];
  summary: {
    totalServices: number;
    operationalServices: number;
    degradedServices: number;
    downServices: number;
  };
} 

interface WorkflowNode {
  id: number | null
  ref: string
  blockId: number
  type: 'trigger' | 'action'
  state: 'inactive' | 'active'
  parameters: Record<string, any>
  frontendHelpers: Record<string, any>
  position: {
    x: number
    y: number
  }
}

export interface WorkflowEdge {
  id: number | null
  source: string
  target: string
}

interface WorkflowSettings {
  loopingType: 'polling'
  limit: number
  period: number
}

export interface CreateWorkflowPayload {
  id: number | null
  name: string
  state: 'inactive' | 'active'
  dateCreated: string | null
  dateModified: string | null
  executionId: string | null
  agentId: string | null
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  notes: any[]
  settings: WorkflowSettings
}