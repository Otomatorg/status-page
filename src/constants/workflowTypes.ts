export const WORKFLOW_TYPES = {
  BALANCE: 'BALANCE',
  TRANSFER: 'TRANSFER',
  PRICE: 'PRICE',
  STAKESTONE: 'STAKESTONE',
  EVERY_PERIOD: 'EVERY_PERIOD'
} as const;

export type WorkflowType = typeof WORKFLOW_TYPES[keyof typeof WORKFLOW_TYPES]; 