import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface WorkflowData {
  [key: string]: {
    id: string | null;
    started: boolean;
    name: string;
    type: string;
    state: string;
    executionId: string;
    lastCheck: string;
    lastExecution: string;
    isHealthy: boolean;
    createdAt: string;
    errorCount: number;
    lastError: string | null;
  };
}

interface ErrorLog {
  [workflowType: string]: Array<{
    message: string;
    timestamp: string;
    data?: any;
  }>;
}

interface StatusReport {
  generatedAt: string;
  overall: 'operational' | 'degraded' | 'down';
  summary: {
    totalServices: number;
    operationalServices: number;
    degradedServices: number;
    downServices: number;
  };
  services: Array<{
    name: string;
    status: 'up' | 'degraded' | 'down';
    uptime: number;
    responseTime: number;
    lastCheck: string;
    incidents: Array<{
      timestamp: string;
      status: string;
      responseTime: number;
      statusCode?: number;
      error?: string;
    }>;
  }>;
}

function generateStatusReport(): void {
  try {
    const publicDir = join(__dirname, '..', 'public');
    const dataDir = join(publicDir, 'data');
    
    // Read workflows data
    const workflowsPath = join(dataDir, 'workflows.json');
    let workflows: WorkflowData = {};
    
    if (existsSync(workflowsPath)) {
      const workflowsData = readFileSync(workflowsPath, 'utf-8');
      workflows = JSON.parse(workflowsData);
    }

    // Read today's error log
    const today = new Date().toISOString().split('T')[0];
    const errorLogPath = join(dataDir, 'executions', today, 'errorLog.json');
    let errorLog: ErrorLog = {};
    
    if (existsSync(errorLogPath)) {
      const errorLogData = readFileSync(errorLogPath, 'utf-8');
      errorLog = JSON.parse(errorLogData);
    }

    // Convert workflows to services
    const services = Object.entries(workflows).map(([type, workflow]) => {
      const errors = errorLog[type] || [];
      const recentErrors = errors.slice(0, 5); // Last 5 errors
      
      // Determine status
      let status: 'up' | 'degraded' | 'down' = 'up';
      if (!workflow.started) {
        status = 'down';
      } else if (errors.length > 0) {
        // Check if there are recent errors (within last hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentErrorsCount = errors.filter(error => 
          new Date(error.timestamp) > oneHourAgo
        ).length;
        
        if (recentErrorsCount > 0) {
          status = 'degraded';
        }
      }

      // Calculate uptime (simplified - based on started status and recent errors)
      let uptime = 100;
      if (!workflow.started) {
        uptime = 0;
      } else if (status === 'degraded') {
        uptime = Math.max(85, 100 - (errors.length * 2)); // Reduce uptime based on error count
      }

      // Convert errors to incidents
      const incidents = recentErrors.map(error => ({
        timestamp: error.timestamp,
        status: status === 'down' ? 'down' : 'degraded',
        responseTime: 0, // We don't have response time data
        error: error.message
      }));

      return {
        name: workflow.name,
        status,
        uptime: Math.round(uptime),
        responseTime: 0, // We don't have response time data
        lastCheck: workflow.lastCheck,
        incidents
      };
    });

    // Calculate summary
    const totalServices = services.length;
    const operationalServices = services.filter(s => s.status === 'up').length;
    const degradedServices = services.filter(s => s.status === 'degraded').length;
    const downServices = services.filter(s => s.status === 'down').length;

    // Determine overall status
    let overall: 'operational' | 'degraded' | 'down' = 'operational';
    if (downServices > 0) {
      overall = downServices === totalServices ? 'down' : 'degraded';
    } else if (degradedServices > 0) {
      overall = 'degraded';
    }

    // Create status report
    const statusReport: StatusReport = {
      generatedAt: new Date().toISOString(),
      overall,
      summary: {
        totalServices,
        operationalServices,
        degradedServices,
        downServices
      },
      services
    };

    // Write status report
    const statusReportPath = join(dataDir, 'status-report.json');
    writeFileSync(statusReportPath, JSON.stringify(statusReport, null, 2));
    
    console.log(`✅ Status report generated at ${statusReportPath}`);
    console.log(`📊 Overall status: ${overall}`);
    console.log(`📈 Services: ${operationalServices} up, ${degradedServices} degraded, ${downServices} down`);
    
  } catch (error) {
    console.error('❌ Failed to generate status report:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateStatusReport();
}

export { generateStatusReport }; 