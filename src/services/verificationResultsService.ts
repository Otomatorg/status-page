// import fs from 'fs/promises';
// import path from 'path';
// import { fileURLToPath } from 'url';
// import { VerificationRunResult, ComparisonResult } from '../verifiers/verificationRunner.js';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// export class VerificationResultsService {
//   private readonly dataDir = path.resolve(__dirname, '../../public/data');
//   private readonly resultsFile = path.join(this.dataDir, 'verification_results.json');

//   private async ensureDataDirectory(): Promise<void> {
//     try {
//       await fs.access(this.dataDir);
//     } catch {
//       await fs.mkdir(this.dataDir, { recursive: true });
//     }
//   }

//   private serializeBigInt(key: string, value: any): any {
//     return typeof value === 'bigint' ? value.toString() : value;
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

//   async saveResults(results: VerificationRunResult[]): Promise<void> {
//     await this.ensureDataDirectory();
    
//     let existingResults: VerificationRunResult[] = [];
    
//     try {
//       const data = await fs.readFile(this.resultsFile, 'utf-8');
//       existingResults = JSON.parse(data);
//     } catch {
//       // File doesn't exist, start with empty array
//     }

//     // Convert BigInt values to strings before serialization
//     const processedResults = results.map(result => ({
//       ...result,
//       result: this.convertBigIntToString(result.result)
//     }));

//     // Add new results to existing ones
//     const allResults = [...existingResults, ...processedResults];
    
//     // Keep only the last 1000 results to avoid file size issues
//     const recentResults = allResults.slice(-1000);
    
//     await fs.writeFile(this.resultsFile, JSON.stringify(recentResults, null, 2));
//   }

//   async loadResults(limit?: number): Promise<VerificationRunResult[]> {
//     try {
//       const data = await fs.readFile(this.resultsFile, 'utf-8');
//       const results: VerificationRunResult[] = JSON.parse(data);
      
//       if (limit) {
//         return results.slice(-limit);
//       }
      
//       return results;
//     } catch {
//       return [];
//     }
//   }

//   async saveComparisons(comparisons: ComparisonResult[]): Promise<void> {
//     const comparisonsFile = path.join(this.dataDir, 'verification_comparisons.json');
//     await this.ensureDataDirectory();
    
//     let existingComparisons: ComparisonResult[] = [];
    
//     try {
//       const data = await fs.readFile(comparisonsFile, 'utf-8');
//       existingComparisons = JSON.parse(data);
//     } catch {
//       // File doesn't exist, start with empty array
//     }

//     // Convert BigInt values to strings before serialization
//     const processedComparisons = comparisons.map(comparison => ({
//       ...comparison,
//       localResult: {
//         ...comparison.localResult,
//         result: this.convertBigIntToString(comparison.localResult.result)
//       },
//       serverResult: comparison.serverResult ? {
//         ...comparison.serverResult,
//         result: this.convertBigIntToString(comparison.serverResult.result)
//       } : undefined
//     }));

//     // Add new comparisons to existing ones
//     const allComparisons = [...existingComparisons, ...processedComparisons];
    
//     // Keep only the last 500 comparisons
//     const recentComparisons = allComparisons.slice(-500);
    
//     await fs.writeFile(comparisonsFile, JSON.stringify(recentComparisons, null, 2));
//   }

//   async getResultsByWorkflowType(workflowType: string): Promise<VerificationRunResult[]> {
//     const results = await this.loadResults();
//     return results.filter(result => result.workflowType === workflowType);
//   }

//   async getResultsBySource(source: 'local' | 'server'): Promise<VerificationRunResult[]> {
//     const results = await this.loadResults();
//     return results.filter(result => result.source === source);
//   }

//   async clearResults(): Promise<void> {
//     await this.ensureDataDirectory();
//     await fs.writeFile(this.resultsFile, JSON.stringify([], null, 2));
    
//     const comparisonsFile = path.join(this.dataDir, 'verification_comparisons.json');
//     await fs.writeFile(comparisonsFile, JSON.stringify([], null, 2));
//   }

//   async getReport(): Promise<{
//     totalRuns: number;
//     localRuns: number;
//     serverRuns: number;
//     successfulRuns: number;
//     failedRuns: number;
//     byWorkflowType: Record<string, {
//       total: number;
//       successful: number;
//       failed: number;
//       avgDuration: number;
//     }>;
//   }> {
//     const results = await this.loadResults();
    
//     const report = {
//       totalRuns: results.length,
//       localRuns: results.filter(r => r.source === 'local').length,
//       serverRuns: results.filter(r => r.source === 'server').length,  
//       successfulRuns: results.filter(r => !r.error).length,
//       failedRuns: results.filter(r => r.error).length,
//       byWorkflowType: {} as Record<string, {
//         total: number;
//         successful: number;
//         failed: number;
//         avgDuration: number;
//       }>
//     };

//     // Group by workflow type
//     const groupedResults = results.reduce((acc, result) => {
//       if (!acc[result.workflowType]) {
//         acc[result.workflowType] = [];
//       }
//       acc[result.workflowType].push(result);
//       return acc;
//     }, {} as Record<string, VerificationRunResult[]>);

//     // Calculate stats for each workflow type
//     Object.entries(groupedResults).forEach(([workflowType, typeResults]) => {
//       const successful = typeResults.filter(r => !r.error);
//       const failed = typeResults.filter(r => r.error);
//       const avgDuration = typeResults.reduce((sum, r) => sum + r.duration, 0) / typeResults.length;

//       report.byWorkflowType[workflowType] = {
//         total: typeResults.length,
//         successful: successful.length,
//         failed: failed.length,
//         avgDuration: Math.round(avgDuration)
//       };
//     });

//     return report;
//   }
// }

// export const verificationResultsService = new VerificationResultsService(); 