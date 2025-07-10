import { WORKFLOW_TYPES } from '../constants/constants.js';

// Direct JSON imports
import wfBalance from './static/wf_balance.json' with { type: 'json' };
import wfTransfer from './static/wf_transfer.json' with { type: 'json' };
import wfPrice from './static/wf_price.json' with { type: 'json' };
import wfStakestone from './static/wf_stakestone.json' with { type: 'json' };
import wfEveryPeriod from './static/wf_every_period.json' with { type: 'json' };
import wfStressLoop from './static/wf_stress_loop.json' with { type: 'json' };

/**
 * Workflow templates loaded from JSON files
 * Using any type to accommodate the full JSON structure
 */
export const WORKFLOW_TEMPLATES: Record<string, any> = {
  [WORKFLOW_TYPES.BALANCE]: wfBalance,
  [WORKFLOW_TYPES.TRANSFER]: wfTransfer,
  [WORKFLOW_TYPES.PRICE]: wfPrice,
  [WORKFLOW_TYPES.STAKESTONE]: wfStakestone,
  [WORKFLOW_TYPES.EVERY_PERIOD]: wfEveryPeriod,
  [WORKFLOW_TYPES.STRESS_LOOP]: wfStressLoop
}; 