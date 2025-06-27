import { VerificationResult, Workflow, ExecutionAnalysis, Execution } from '../types/workflow.js';
import { CHAINS, WORKFLOW_TYPES } from '../constants/workflowTypes.js';

import { ethers } from 'ethers';
import dotenv from "dotenv";
import { externalApiService } from '../services/externalApiService.js';
import { WORKFLOW_TEMPLATES } from '../templates/workflowTemplates.js';
dotenv.config();


function getProvider(chainId: number) {
  const chainName = chainId === 1 ? 'INFURA' : Object.keys(CHAINS).find(key => CHAINS[key as keyof typeof CHAINS] === chainId);
  if (!chainName) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const providerUrl = process.env[`${chainName}_HTTPS_PROVIDER`];

  if (!providerUrl) throw new Error("No provider url found")

  const provider = new ethers.JsonRpcProvider(providerUrl);

  return provider;
}

export async function verifyBalanceWorkflow(
  parameters: any
): Promise<VerificationResult| any> {

  const provider = getProvider(parameters.chainId);

  const contractAddress = parameters.contractAddress;

  const ABI = ["function balanceOf(address account) view returns ((uint256 balance))"];

  const data = new ethers.Contract(contractAddress, ABI, provider);

  const balance = await data.balanceOf(parameters.abi.parameters.account);

  return [{
    balance: balance[0],
    account: parameters.abi.parameters.account,
    contractAddress: contractAddress,
    chainId: parameters.chainId
  }];
}

export async function verifyTransferWorkflow(
  parameters: any
): Promise<VerificationResult | any> {
  
  const provider = getProvider(parameters.chainId);

  const contractAddress = parameters.contractAddress;

  const ABI = ["event Transfer(address indexed from, address indexed to, uint256 value)"];

  const data = new ethers.Contract(contractAddress, ABI, provider);

  // Get current block number
  const currentBlock = await provider.getBlockNumber();
  
  // Calculate blocks for 10 minutes (2 seconds per block = 30 blocks per minute)
  const blocksPerMinute = 30;
  const blocksFor5Minutes = blocksPerMinute * 10;
  const fromBlock = currentBlock - blocksFor5Minutes;

  // Fetch Transfer events from the last 5 minutes
  const transferEvents = await data.queryFilter(
    data.filters.Transfer(),
    fromBlock,
    currentBlock
  );

  console.log(`Found ${transferEvents.length} Transfer events in the last 10 minutes`);
  
  const events = [];
  // Process each event
  for (const event of transferEvents) {
    if ('args' in event) {
      const eventData = {
        from: event.args?.from,
        to: event.args?.to,
        value: event.args?.value?.toString(),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash
      };
      events.push(eventData);
    }
  }

  return events;
}

export async function verifyPriceWorkflow(
  parameters: any
): Promise<VerificationResult | any> {
  const price = await externalApiService.getTokenPrice(parameters.chainId, parameters.contractAddress);

  return [{
    price: price,
    contractAddress: parameters.contractAddress,
    chainId: parameters.chainId
  }];
}

export async function verifyStakeStoneWorkflow(
  parameters: any
): Promise<VerificationResult | any> {
  const provider = getProvider(parameters.chainId);

  const contractAddress = parameters.contractAddress;

  const ABI = ["function latestRoundID() view returns (uint256 roundID)"];

  const data = new ethers.Contract(contractAddress, ABI, provider);

  const latestRoundID = await data.latestRoundID();

  return [{
    latestRoundID: latestRoundID,
    contractAddress: contractAddress,
    chainId: parameters.chainId
  }];
}

export async function verifyEveryPeriodWorkflow(
  parameters: any
): Promise<VerificationResult | any> {
  return [{
    timestamp: new Date().toISOString(),
    period: parameters.period,
    limit: parameters.limit
  }];
}

/**
 * Main verification dispatcher
 * Routes to the appropriate verification function based on workflow type
 */
export async function verifyWorkflow(
  workflowType: string,
  parameters: any
): Promise<VerificationResult | any> {
  switch (workflowType) {
    case WORKFLOW_TYPES.BALANCE:
      return verifyBalanceWorkflow(parameters);
    
    case WORKFLOW_TYPES.TRANSFER:
      return verifyTransferWorkflow(parameters);
    
    case WORKFLOW_TYPES.PRICE:
      return verifyPriceWorkflow(parameters);
    
    case WORKFLOW_TYPES.STAKESTONE:
      return verifyStakeStoneWorkflow(parameters);
    
    // case WORKFLOW_TYPES.EVERY_PERIOD:
    //   return verifyEveryPeriodWorkflow(execution);
    
    default:
      return {
        passed: false,
        details: `Unknown workflow type: ${workflowType}`,
        checks: [
          {
            name: 'Workflow Type Recognition',
            passed: false,
            message: `Unknown workflow type: ${workflowType}`
          }
        ]
      };
  }
} 

// const templateBalance = WORKFLOW_TEMPLATES[WORKFLOW_TYPES.BALANCE];
// const parametersBalance = templateBalance.nodes[0].parameters;
// verifyWorkflow(WORKFLOW_TYPES.BALANCE, parametersBalance);

// const templatePrice = WORKFLOW_TEMPLATES[WORKFLOW_TYPES.PRICE];
// const parametersPrice = templatePrice.nodes[0].parameters;
// verifyWorkflow(WORKFLOW_TYPES.PRICE, parametersPrice);

// const templateStakeStone = WORKFLOW_TEMPLATES[WORKFLOW_TYPES.STAKESTONE];
// const parametersStakeStone = templateStakeStone.nodes[0].parameters;
// verifyWorkflow(WORKFLOW_TYPES.STAKESTONE, parametersStakeStone);

// const templateTransfer = WORKFLOW_TEMPLATES[WORKFLOW_TYPES.TRANSFER];
// const parametersTransfer = templateTransfer.nodes[0].parameters;
// verifyWorkflow(WORKFLOW_TYPES.TRANSFER, parametersTransfer);
