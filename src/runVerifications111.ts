// import { verificationRunner } from './verifiers/verificationRunner.js';
// import { dataService } from './services/dataService.js';
// import { verificationResultsService } from './services/verificationResultsService.js';

// async function main() {
//   try {
//     console.log('🚀 Starting verification runs...\n');

//     // Load execution data
//     const executions = await dataService.loadExecutions('2025-06-26');
    
//     if (!executions) {
//       console.error('❌ No execution data found');
//       return;
//     }

//     console.log('📊 Running local verifications...');
//     const localResults = await verificationRunner.runAllVerifications(executions, 'local');
    
//     console.log('\n✅ Local verification results:');
//     localResults.forEach(result => {
//       console.log(`  ${result.workflowType}: ${result.error ? '❌ Error' : '✅ Success'} (${result.duration}ms)`);
//       if (result.error) {
//         console.log(`    Error: ${result.error}`);
//       }
//     });

//     // Save local results to persistent storage
//     await verificationResultsService.saveResults(localResults);

//     // Simulate server results (you would get these from your actual server)
//     console.log('\n📡 Simulating server verifications...');
//     const serverResults = await verificationRunner.runAllVerifications(executions, 'server');
    
//     // Save server results to persistent storage
//     await verificationResultsService.saveResults(serverResults);

//     console.log('\n🔍 Comparison Results:');
//     const comparisons = [];
//     for (const localResult of localResults) {
//       const comparison = verificationRunner.compareResults(
//         localResult.workflowType, 
//         localResult.executionId
//       );
      
//       if (comparison) {
//         comparisons.push(comparison);
//         console.log(`\n  ${comparison.workflowType}:`);
//         console.log(`    Match: ${comparison.match ? '✅' : '❌'}`);
//         if (!comparison.match && comparison.differences) {
//           console.log(`    Differences:`);
//           comparison.differences.forEach(diff => {
//             console.log(`      - ${diff}`);
//           });
//         }
//       }
//     }

//     // Save comparison results
//     await verificationResultsService.saveComparisons(comparisons);

//     // Generate and display report
//     const report = await verificationResultsService.getReport();
//     console.log('\n📈 Verification Report:');
//     console.log(`  Total runs: ${report.totalRuns}`);
//     console.log(`  Local runs: ${report.localRuns}`);
//     console.log(`  Server runs: ${report.serverRuns}`);
//     console.log(`  Successful: ${report.successfulRuns}`);
//     console.log(`  Failed: ${report.failedRuns}`);
    
//     console.log('\n📊 By Workflow Type:');
//     Object.entries(report.byWorkflowType).forEach(([type, stats]) => {
//       console.log(`  ${type}:`);
//       console.log(`    Total: ${stats.total}, Success: ${stats.successful}, Failed: ${stats.failed}`);
//       console.log(`    Avg Duration: ${stats.avgDuration}ms`);
//     });

//     console.log('\n✅ Verification completed successfully!');

//   } catch (error) {
//     console.error('❌ Error running verifications:', error);
//   }
// }

// // Run only if this file is executed directly
// if (import.meta.url === `file://${process.argv[1]}`) {
//   main();
// } 