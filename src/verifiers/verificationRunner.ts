// import { VerificationResult, Execution } from '../types/workflow.js';
// import { WORKFLOW_TYPES } from '../constants/workflowTypes.js';
// import { 
//   verifyBalanceWorkflow, 
//   verifyTransferWorkflow, 
//   verifyPriceWorkflow, 
//   verifyStakeStoneWorkflow, 
//   verifyEveryPeriodWorkflow 
// } from './workflowVerifiers.js';

// export interface VerificationRunResult {
//   workflowType: string;
//   executionId: string;
//   timestamp: string;
//   result: VerificationResult | any;
//   duration: number;
//   error?: string;
//   source: 'local' | 'server';
// }

// export interface ComparisonResult {
//   workflowType: string;
//   executionId: string;
//   localResult: VerificationRunResult;
//   serverResult?: VerificationRunResult;
//   match: boolean;
//   differences?: string[];
// }

// export class VerificationRunner {
//   private results: Map<string, VerificationRunResult[]> = new Map();

//   async runVerification(
//     workflowType: string, 
//     execution: Execution, 
//     source: 'local' | 'server' = 'local'
//   ): Promise<VerificationRunResult> {
//     const startTime = Date.now();
//     const timestamp = new Date().toISOString();
    
//     try {
//       let result: VerificationResult | any;
      
//       switch (workflowType) {
//         case WORKFLOW_TYPES.BALANCE:
//           result = await verifyBalanceWorkflow(execution);
//           break;
//         case WORKFLOW_TYPES.TRANSFER:
//           result = await verifyTransferWorkflow(execution);
//           break;
//         case WORKFLOW_TYPES.PRICE:
//           result = await verifyPriceWorkflow(execution);
//           break;
//         case WORKFLOW_TYPES.STAKESTONE:
//           result = await verifyStakeStoneWorkflow(execution);
//           break;
//         case WORKFLOW_TYPES.EVERY_PERIOD:
//           result = await verifyEveryPeriodWorkflow(execution);
//           break;
//         default:
//           throw new Error(`Unknown workflow type: ${workflowType}`);
//       }

//       const runResult: VerificationRunResult = {
//         workflowType,
//         executionId: execution.id,
//         timestamp,
//         result,
//         duration: Date.now() - startTime,
//         source
//       };

//       this.storeResult(runResult);
//       return runResult;

//     } catch (error) {
//       const runResult: VerificationRunResult = {
//         workflowType,
//         executionId: execution.id,
//         timestamp,
//         result: null,
//         duration: Date.now() - startTime,
//         error: error instanceof Error ? error.message : String(error),
//         source
//       };

//       this.storeResult(runResult);
//       return runResult;
//     }
//   }

//   async runAllVerifications(executions: any, source: 'local' | 'server' = 'local'): Promise<VerificationRunResult[]> {
//     const results: VerificationRunResult[] = [];
    
//     for (const [workflowType, executionList] of Object.entries(executions)) {
//       if (Array.isArray(executionList) && executionList.length > 0) {
//         const latestExecution = executionList[executionList.length - 1];
//         const result = await this.runVerification(workflowType, latestExecution, source);
//         results.push(result);
//       }
//     }
    
//     return results;
//   }

//   private storeResult(result: VerificationRunResult): void {
//     const key = `${result.workflowType}_${result.executionId}`;
//     if (!this.results.has(key)) {
//       this.results.set(key, []);
//     }
//     this.results.get(key)!.push(result);
//   }

//   getResults(workflowType?: string): VerificationRunResult[] {
//     if (workflowType) {
//       return Array.from(this.results.entries())
//         .filter(([key]) => key.startsWith(workflowType))
//         .flatMap(([, results]) => results);
//     }
//     return Array.from(this.results.values()).flat();
//   }

//   compareResults(workflowType: string, executionId: string): ComparisonResult | null {
//     const key = `${workflowType}_${executionId}`;
//     const results = this.results.get(key) || [];
    
//     const localResult = results.find(r => r.source === 'local');
//     const serverResult = results.find(r => r.source === 'server');
    
//     if (!localResult) return null;

//     const comparison: ComparisonResult = {
//       workflowType,
//       executionId,
//       localResult,
//       serverResult,
//       match: false,
//       differences: []
//     };

//     if (serverResult) {
//       comparison.match = this.deepEqual(localResult.result, serverResult.result);
//       if (!comparison.match) {
//         comparison.differences = this.findDifferences(localResult.result, serverResult.result);
//       }
//     }

//     return comparison;
//   }

//   private convertBigIntToString(obj: any): any {
//     if (obj === null || obj === undefined) return obj;
    
//     if (typeof obj === 'bigint') {
//       return obj.toString();
//     }
    
//     if (Array.isArray(obj)) {
//       return obj.map(item => this.convertBigIntToString(item));
//     }
    
//     if (typeof obj === 'object') {
//       const converted: any = {};
//       for (const [key, value] of Object.entries(obj)) {
//         converted[key] = this.convertBigIntToString(value);
//       }
//       return converted;
//     }
    
//     return obj;
//   }

//   private deepEqual(obj1: any, obj2: any): boolean {
//     const converted1 = this.convertBigIntToString(obj1);
//     const converted2 = this.convertBigIntToString(obj2);
//     return JSON.stringify(converted1) === JSON.stringify(converted2);
//   }

//   private findDifferences(obj1: any, obj2: any): string[] {
//     const differences: string[] = [];
    
//     // Convert BigInt values before comparison
//     const converted1 = this.convertBigIntToString(obj1);
//     const converted2 = this.convertBigIntToString(obj2);
    
//     if (typeof converted1 !== typeof converted2) {
//       differences.push(`Type mismatch: ${typeof converted1} vs ${typeof converted2}`);
//       return differences;
//     }
    
//     if (converted1 === null || converted2 === null) {
//       if (converted1 !== converted2) {
//         differences.push(`Null value mismatch: ${converted1} vs ${converted2}`);
//       }
//       return differences;
//     }
    
//     if (typeof converted1 === 'object') {
//       const keys1 = Object.keys(converted1);
//       const keys2 = Object.keys(converted2);
      
//       const allKeys = new Set([...keys1, ...keys2]);
      
//       for (const key of allKeys) {
//         if (!(key in converted1)) {
//           differences.push(`Missing key in local result: ${key}`);
//         } else if (!(key in converted2)) {
//           differences.push(`Missing key in server result: ${key}`);
//         } else if (!this.deepEqual(converted1[key], converted2[key])) {
//           differences.push(`Value difference at ${key}: ${JSON.stringify(converted1[key])} vs ${JSON.stringify(converted2[key])}`);
//         }
//       }
//     } else if (converted1 !== converted2) {
//       differences.push(`Value mismatch: ${converted1} vs ${converted2}`);
//     }
    
//     return differences;
//   }

//   exportResults(): any {
//     const exported: any = {};
    
//     for (const [key, results] of this.results.entries()) {
//       exported[key] = results;
//     }
    
//     return exported;
//   }

//   clearResults(): void {
//     this.results.clear();
//   }
// }

// export const verificationRunner = new VerificationRunner(); 