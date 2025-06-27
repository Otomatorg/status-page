import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { INTERVALS } from './constants/workflowTypes';

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

// Helper to flatten executions by type
function getExecutionsByType(executions: any[]) {
    const byType: Record<string, any[]> = {
        EVERY_PERIOD: [],
        STAKESTONE: [],
        PRICE: [],
        BALANCE: [],
        TRANSFER: [],
    };

    for (const exec of executions) {
        if (!exec.workflow || !exec.workflow.name) continue;
        const name = exec.workflow.name.toUpperCase();
        if (name.includes('EVERY PERIOD')) byType.EVERY_PERIOD.push(exec);
        else if (name.includes('STAKESTONE')) byType.STAKESTONE.push(exec);
        else if (name.includes('PRICE')) byType.PRICE.push(exec);
        else if (name.includes('BALANCE')) byType.BALANCE.push(exec);
        else if (name.includes('TRANSFER')) byType.TRANSFER.push(exec);
    }
    return byType;
}

// Helper to get all executions as a flat array
function loadAllExecutions(executionsJson: any): any[] {
    // executionsJson is an array or an object with array at root
    if (Array.isArray(executionsJson)) return executionsJson;
    // Try to find array in object
    for (const k in executionsJson) {
        if (Array.isArray(executionsJson[k])) return executionsJson[k];
    }
    return [];
}

// Main
function main() {
    const currentDate = new Date().toISOString().split('T')[0];
    const comparisonPath = path.join(__dirname, `../public/data/executions/${currentDate}/comparisonData.json`);
    const executionsPath = path.join(__dirname, `../public/data/executions/${currentDate}/executions.json`);

    const comparisonData = loadJson(comparisonPath);
    const executionsData = loadJson(executionsPath);

    // Flatten executions
    // let executions: any[] = [];
    // if (Array.isArray(executionsData)) {
    //     executions = executionsData;
    // } else if (executionsData && typeof executionsData === 'object') {
    //     // Try to find array in object
    //     for (const k in executionsData) {
    //         if (Array.isArray(executionsData[k])) {
    //             executions = executionsData[k];
    //             break;
    //         }
    //     }
    // }
    // // If still not found, try to parse as NDJSON
    // if (!executions.length && typeof executionsData === 'string') {
    //     executions = executionsData.split('\n').map((l: string) => l && JSON.parse(l)).filter(Boolean);
    // }

    // const executionsByType = getExecutionsByType(executionsData);

    // console.log(executionsByType);

    // 1. EVERY_PERIOD: check interval between executions
    function verifyEveryPeriod() {
        const execs = executionsData.EVERY_PERIOD
            .map((e: any) => e.dateCreated)
            .filter(Boolean)
            .map(toMs)
            .sort((a: number, b: number) => a - b);

        if (execs.length < 2) {
            console.log('EVERY_PERIOD: Not enough executions to check interval.');
            return;
        }
        let allOk = true;
        for (let i = 1; i < execs.length; ++i) {
            const diff = execs[i] - execs[i - 1];
            if (Math.abs(diff - EVERY_PERIOD_INTERVAL_MS) > ALLOWED_ERROR_MS) {
                console.log(
                    `EVERY_PERIOD: Interval between execution ${i - 1} and ${i} is ${Math.round(diff / 60000)} min, expected ${EVERY_PERIOD_INTERVAL_MIN} min (+/- 1 min)`
                );
                allOk = false;
            }
        }
        if (allOk) {
            console.log('EVERY_PERIOD: All intervals OK.');
        }
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

        console.log(`${type}: Found ${execsInTimeRange.length} executions and ${compInTimeRange.length} comparison entries in the last ${INTERVALS[type]} minutes`);

        // // Check if we have executions for each comparison data entry
        // if (compInTimeRange.length > 0 && execsInTimeRange.length === 0) {
        //     console.log(`${type}: Missing executions - found ${compInTimeRange.length} comparison entries but no executions`);
        // } else if (compInTimeRange.length > 0 && execsInTimeRange.length > 0) {
        //     console.log(`${type}: Found ${execsInTimeRange.length} executions for ${compInTimeRange.length} comparison entries`);
        // }
        
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
                // console.log(`TRANSFER: Missing execution for transactionHash ${txHash} (comparisonData[${i}])`);
                allOk = false;
                missingHashes.add(txHash);
            }
        }
        if (allOk) {
            console.log('TRANSFER: All comparisonData entries have corresponding executions.');
        } else {
            console.log(`TRANSFER: Missing executions for ${missingHashes.size} transaction hashes`);
            console.log(Array.from(missingHashes));
        }
    }

    // Run all verifications
    verifyEveryPeriod();
    verifyColumnBased('STAKESTONE');
    verifyColumnBased('PRICE');
    verifyColumnBased('BALANCE');
    verifyTransfer();
}

main();
