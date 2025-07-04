import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { INTERVALS } from './constants/constants.js';
import { VerificationError } from './types/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurable interval in minutes for EVERY_PERIOD
const EVERY_PERIOD_INTERVAL_MIN = 10;
const EVERY_PERIOD_INTERVAL_MS = EVERY_PERIOD_INTERVAL_MIN * 60 * 1000;
const ALLOWED_ERROR_MS = 1 * 60 * 1000; // 1 minute

// Helper to parse ISO date string to ms
function toMs(date: string) {
    return new Date(date).getTime();
}

// Helper to load JSON
function loadJson(filePath: string) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Main
export function runVerifications() {
    const currentDate = new Date().toISOString().split('T')[0];
    const comparisonPath = path.join(__dirname, `../docs/executions/${currentDate}/comparisonData.json`);
    const executionsPath = path.join(__dirname, `../docs/executions/${currentDate}/executions.json`);

    const comparisonData = loadJson(comparisonPath);
    const executionsData = loadJson(executionsPath);

    const errorLogPath = path.join(__dirname, `../docs/executions/${currentDate}/errorLog.json`);
    let errorLog: Record<string, VerificationError[]> = {
        BALANCE: [],
        STAKESTONE: [],
        PRICE: [],
        TRANSFER: [],
        EVERY_PERIOD: []
    };

    // Try to load existing error log
    try {
        errorLog = loadJson(errorLogPath);
    } catch {
        // If file doesn't exist, use default structure
    }

    // 1. EVERY_PERIOD: check interval between executions
    function verifyEveryPeriod() {
        const execs = executionsData.EVERY_PERIOD
            .map((e: any) => ({ id: e.id, dateCreated: toMs(e.dateCreated) }))
            .filter((e: any) => e.dateCreated)
            .sort((a: any, b: any) => a.dateCreated - b.dateCreated);

        if (execs.length < 2) {
            console.log('EVERY_PERIOD: Not enough executions to check interval.');
            return;
        }
        let allOk = true;
        const errors: any[] = [];
        for (let i = 1; i < execs.length; ++i) {
            const diff = execs[i].dateCreated - execs[i - 1].dateCreated;
            console.log(diff);
            if (Math.abs(diff - EVERY_PERIOD_INTERVAL_MS) > ALLOWED_ERROR_MS) {
                const errorMsg = `EVERY_PERIOD: Interval between execution ${execs[i - 1].id} and ${execs[i].id} is ${Math.round(diff / 60000)} min, expected ${EVERY_PERIOD_INTERVAL_MIN} min (+/- 1 min)`;
                console.log(errorMsg);
                errors.push({ 
                    message: errorMsg, 
                    timestamp: new Date().toISOString(),
                    data: {
                        executionIndex: execs[i].id, 
                        actualInterval: diff, 
                        expectedInterval: EVERY_PERIOD_INTERVAL_MS 
                    }
                });
                allOk = false;
            }
        }
        if (allOk) {
            console.log('EVERY_PERIOD: All intervals OK.');
        }
        // Override error log for EVERY_PERIOD
        errorLog.EVERY_PERIOD = errors;
    }

    // 2. For STAKESTONE, PRICE, BALANCE: for each new column in comparisonData, between the time of 2 items, there should be an execution on server
    function verifyColumnBased(type: 'STAKESTONE' | 'PRICE' | 'BALANCE') {
        const compArr = comparisonData[type] || [];
        if (compArr.length < 2) {
            console.log(`${type}: Not enough comparison data to check.`);
            return;
        }
        
        // Get the interval for this workflow type from INTERVALS
        const intervalMs = INTERVALS[type] * 60 * 1000; // Convert minutes to milliseconds

        const now = new Date().getTime();
        const tenMinutesAgo = now - intervalMs

        // Find all executions between tenMinutesAgo and now
        const execsInTimeRange = executionsData[type]?.filter((exec: any) => {
            const execTime = new Date(exec.dateCreated).getTime();
            return execTime >= tenMinutesAgo && execTime <= now;
        }) || [];

        // Find all comparison data entries between tenMinutesAgo and now
        const compInTimeRange = compArr.filter((comp: any) => {
            const compTime = new Date(comp.dateCreated).getTime();
            return compTime >= tenMinutesAgo && compTime <= now;
        });

        // Only add error log entry if execution count and comparison count are different
        if (compInTimeRange.length > 0 && execsInTimeRange.length == 0) {
            const errorEntry = {
                message: `${type}: Found ${execsInTimeRange.length} executions and ${compInTimeRange.length} comparison entries in the last ${INTERVALS[type]} minutes`,
                timestamp: new Date().toISOString(),
                data: {
                    executionsCount: execsInTimeRange.length,
                    comparisonEntriesCount: compInTimeRange.length,
                    timeRange: { from: new Date(tenMinutesAgo).toISOString(), to: new Date(now).toISOString() }
                }
            };
            
            if (!errorLog[type]) {
                errorLog[type] = [];
            }
            errorLog[type].push(errorEntry);
        }
    }

    // 3. TRANSFER: for each comparisonData entry, check if any execution is missing
    function verifyTransfer() {
        const compArr = comparisonData.TRANSFER || [];
        const execs = executionsData.TRANSFER;

        // Build a set of hashes from executions
        const execHashes = new Set<string>();
        for (const e of execs) {
            // Try to get transactionHash from nodeOutputs or output
            let txHash: string | undefined;
            if (Array.isArray(e.nodeOutputs)) {
                for (const n of e.nodeOutputs) {
                    if (n.output && n.output.transactionHash) {
                        txHash = n.output.transactionHash;
                        break;
                    }
                }
            }
            if (!txHash && e.transactionHash) txHash = e.transactionHash;
            if (txHash) execHashes.add(txHash.toLowerCase());
        }

        let allOk = true;
        let missingHashes = new Set<string>();
        for (let i = 0; i < compArr.length; ++i) {
            const txHash = compArr[i].transactionHash;
            if (!txHash) continue;
            if (!execHashes.has(txHash.toLowerCase())) {
                allOk = false;
                missingHashes.add(txHash);
            }
        }
        if (allOk) {
            console.log('TRANSFER: All comparisonData entries have corresponding executions.');
        } else {
            console.log(`TRANSFER: Missing executions for ${missingHashes.size} transaction hashes`);
            // Add new error log entry for TRANSFER
            const errorEntry = {
              message: allOk ? 'TRANSFER: All comparisonData entries have corresponding executions.' : `TRANSFER: Missing executions for ${missingHashes.size} transaction hashes`,
              timestamp: new Date().toISOString(),
              data: {
                  missingHashes: Array.from(missingHashes),
                  totalComparisonEntries: compArr.length,
                  totalExecutions: execs.length
              }
            };

            if (!errorLog.TRANSFER) {
              errorLog.TRANSFER = [];
            }
            errorLog.TRANSFER.push(errorEntry);
        }
    }

    // Run all verifications
    verifyEveryPeriod();
    verifyColumnBased('STAKESTONE');
    verifyColumnBased('PRICE');
    verifyColumnBased('BALANCE');
    verifyTransfer();

    // Save the error log
    fs.writeFileSync(errorLogPath, JSON.stringify(errorLog, null, 2));
}

// runVerifications();

