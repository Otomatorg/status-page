export const WORKFLOW_TYPES = {
  BALANCE: 'BALANCE',
  TRANSFER: 'TRANSFER',
  PRICE: 'PRICE',
  STAKESTONE: 'STAKESTONE',
  EVERY_PERIOD: 'EVERY_PERIOD'
} as const;

export type WorkflowType = typeof WORKFLOW_TYPES[keyof typeof WORKFLOW_TYPES]; 

export const CHECK_TYPE = {
  RIGHT_AWAY: 'right_away',
  LATER: 'later',
} as const;

export type CheckType = typeof CHECK_TYPE[keyof typeof CHECK_TYPE];

export const CHAINS = {
  ALL: 0,
  ETHEREUM: 1,
  MODE: 34443,
  BASE: 8453,
  ABSTRACT: 2741,
  ARBITRUM: 42161,
  OASIS: 23294,
  AVALANCHE: 43114,
  SONIC: 146,
  OPTIMISM: 10,
  POLYGON: 137,
  BINANCE: 56,
  SOMNIA: 50312,
  HYPER_EVM: 999,
};