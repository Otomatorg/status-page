# Workflow Monitoring System

This system monitors workflow health and creates workflows automatically if they don't exist.

## Features

- 🔄 **Auto-Creation**: Creates workflows if they don't exist using predefined templates
- 📊 **Health Monitoring**: Tracks workflow states, execution status, and error counts
- 💾 **Data Persistence**: Stores workflow states between runs in JSON files
- 🔍 **Verification**: Pluggable verification system for each workflow type
- 📈 **Reporting**: Generates monitoring reports and execution history
- ⚡ **GitHub Actions**: Automated monitoring every 30 minutes

## Project Structure

```
src/
├── constants/
│   └── workflowTypes.ts          # Workflow type definitions
├── services/
│   ├── apiService.ts             # API communication layer
│   └── dataService.ts            # Data persistence layer
├── templates/
│   └── workflowTemplates.ts      # Workflow creation templates
├── types/
│   └── workflow.ts               # TypeScript interfaces
├── verifiers/
│   └── workflowVerifiers.ts      # Verification functions (to be implemented)
└── monitor.ts                    # Main monitoring script

public/data/
├── workflows.json                # Persistent workflow states
├── monitoring-report.json        # Latest monitoring report
└── executions/
    └── [date]/
        ├── executions.json       # Daily execution results
        └── errors.json           # Daily error logs
```

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env` file or set environment variables:
   ```env
   API_BASE_URL=http://your-api-url/api
   API_TOKEN=your-api-token
   ```

3. **Build Project**
   ```bash
   npm run build
   ```

## Usage

### Manual Monitoring
```bash
npm run monitor
```

### Development Mode
```bash
npm run dev
```

### GitHub Actions
The system automatically runs every 30 minutes via GitHub Actions. Set these secrets:
- `API_BASE_URL`: Your API endpoint
- `API_TOKEN`: Authentication token

## Workflow Types

Currently monitored workflow types:
- **BALANCE**: Token balance monitoring
- **TRANSFER**: Transfer event detection
- **PRICE**: Price change monitoring
- **STAKESTONE**: StakeStone protocol monitoring
- **EVERY_PERIOD**: Periodic execution monitoring

## How It Works

### 1. Workflow Creation
```typescript
// If workflow doesn't exist, creates it using template
const template = WORKFLOW_TEMPLATES[workflowType];
const response = await apiService.createWorkflow(template);
```

### 2. Status Checking
```typescript
// Checks current workflow status
const workflow = await apiService.getWorkflow(workflowId);
workflowState.state = workflow.state;
```

### 3. Verification (To Be Implemented)
```typescript
// Each workflow type has its own verification function
const result = await verifyWorkflow(workflowType, workflow, executionId);
```

### 4. Data Persistence
```typescript
// Saves workflow states and execution results
await dataService.saveWorkflowsState(workflowsState);
await dataService.saveExecutionResult(date, workflowType, result);
```

## Implementing Verification Functions

Edit `src/verifiers/workflowVerifiers.ts` to implement specific verification logic:

```typescript
export async function verifyBalanceWorkflow(
  workflow: Workflow,
  executionId: string | null
): Promise<VerificationResult> {
  // TODO: Add your verification logic here
  // Example:
  // - Check if balance was read correctly
  // - Verify trigger conditions
  // - Validate historical data
  
  return {
    passed: true, // Change based on actual verification
    details: 'Balance verification details',
    checks: [
      {
        name: 'Balance Reading',
        passed: true,
        message: 'Balance read successfully'
      }
    ]
  };
}
```

## API Endpoints Used

- `POST /workflows` - Create workflow
- `GET /workflows/{id}` - Get workflow status
- `POST /workflows/{id}/run` - Run workflow (optional)
- `POST /workflows/{id}/stop` - Stop workflow (optional)
- `GET /executions/{id}` - Get execution details (optional)

## Data Files

### `workflows.json`
Persistent workflow states:
```json
{
  "BALANCE": {
    "id": "workflow-id",
    "name": "Workflow - BALANCE",
    "type": "BALANCE",
    "state": "inactive",
    "executionId": null,
    "lastCheck": "2025-01-24T10:30:00.000Z",
    "isHealthy": true,
    "errorCount": 0
  }
}
```

### `executions/[date]/executions.json`
Daily execution results:
```json
{
  "BALANCE": [
    {
      "workflowType": "BALANCE",
      "success": true,
      "timestamp": "2025-01-24T10:30:00.000Z",
      "verificationResult": {
        "passed": true,
        "details": "All checks passed"
      }
    }
  ]
}
```

## Monitoring Output

The monitoring script provides detailed console output:
```
🚀 Starting workflow monitoring...
📂 Loaded state for 5 workflows

🔍 Processing BALANCE...
✅ BALANCE: Workflow exists (ID: abc-123)
📊 BALANCE: Status = inactive, ExecutionId = null
✅ BALANCE: Verification passed

💾 Workflow states saved
📊 Monitoring report generated
✅ Monitoring completed successfully
```

## Contributing

1. Add new workflow types to `src/constants/workflowTypes.ts`
2. Create templates in `src/templates/workflowTemplates.ts`
3. Implement verification functions in `src/verifiers/workflowVerifiers.ts`
4. Test with `npm run dev`

## License

MIT