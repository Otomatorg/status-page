import { VerificationResult } from '../types/types.js';
import { WORKFLOW_TYPES } from '../constants/constants.js';
import { ethers } from 'ethers';
import { externalApiService } from '../services/externalApiService.js';
import { CHAINS } from 'otomato-sdk';
// import dotenv from "dotenv";
// dotenv.config();

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

export async function balanceDataFetcher(
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

export async function transferDataFetcher(
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
  const blocksFor5Minutes = blocksPerMinute * 10; // 10 minutes
  const fromBlock = currentBlock - blocksFor5Minutes;

  // Fetch Transfer events from the last 10 minutes
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

export async function priceDataFetcher(
  parameters: any
): Promise<VerificationResult | any> {
  const price = await externalApiService.getTokenPrice(parameters.chainId, parameters.contractAddress);

  return [{
    price: price,
    contractAddress: parameters.contractAddress,
    chainId: parameters.chainId
  }];
}

export async function stakestoneDataFetcher(
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
export async function dataFetcher(
  workflowType: string,
  parameters: any
): Promise<VerificationResult | any> {
  switch (workflowType) {
    case WORKFLOW_TYPES.BALANCE:
      return balanceDataFetcher(parameters);
    
    case WORKFLOW_TYPES.TRANSFER:
      return transferDataFetcher(parameters);
    
    case WORKFLOW_TYPES.PRICE:
      return priceDataFetcher(parameters);
    
    case WORKFLOW_TYPES.STAKESTONE:
    case WORKFLOW_TYPES.STRESS_LOOP:
      return stakestoneDataFetcher(parameters);

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
