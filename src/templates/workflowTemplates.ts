import { WORKFLOW_TYPES } from '../constants/workflowTypes.js';
import { CreateWorkflowPayload } from '../types/workflow.js';

export const WORKFLOW_TEMPLATES: Record<string, CreateWorkflowPayload> = {
  [WORKFLOW_TYPES.BALANCE]: {
    name: `Workflow - ${WORKFLOW_TYPES.BALANCE}`,
    settings: {
      loopingType: 'polling',
      limit: 1000000,
      period: 300000
    },
    nodes: [
      {
        ref: '2',
        blockId: 5,
        type: 'trigger',
        position: { x: 400, y: 120 },
        parameters: {
          abi: {
            parameters: {
              account: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
            }
          },
          chainId: 8453,
          condition: 'neq',
          comparisonValue: '{{history.0.value}}',
          contractAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
        },
        handler: null,
        handlerKey: null
      },
      {
        ref: '3',
        blockId: 100010,
        type: 'action',
        position: { x: 400, y: 240 },
        parameters: {
          time: '1000'
        },
        handler: null,
        handlerKey: null
      }
    ],
    edges: [
      {
        source: '2',
        target: '3',
        value: null,
        label: null
      }
    ]
  },

  [WORKFLOW_TYPES.TRANSFER]: {
    name: `Workflow - ${WORKFLOW_TYPES.TRANSFER}`,
    settings: {
      loopingType: 'polling',
      limit: 1000000,
      period: 300000
    },
    nodes: [
      {
        ref: '2',
        blockId: 6, // Transfer detection block
        type: 'trigger',
        position: { x: 400, y: 120 },
        parameters: {
          // Transfer monitoring parameters
          chainId: 8453,
          contractAddress: '0xa0b86a33e6ba256c6e71c7cd52e3b8c9b5d5c3ba',
          eventName: 'Transfer'
        },
        handler: null,
        handlerKey: null
      },
      {
        ref: '3',
        blockId: 100010,
        type: 'action',
        position: { x: 400, y: 240 },
        parameters: {
          time: '1000'
        },
        handler: null,
        handlerKey: null
      }
    ],
    edges: [
      {
        source: '2',
        target: '3',
        value: null,
        label: null
      }
    ]
  },

  [WORKFLOW_TYPES.PRICE]: {
    name: `Workflow - ${WORKFLOW_TYPES.PRICE}`,
    settings: {
      loopingType: 'polling',
      limit: 1000000,
      period: 300000
    },
    nodes: [
      {
        ref: '2',
        blockId: 10, // Price monitoring block
        type: 'trigger',
        position: { x: 400, y: 120 },
        parameters: {
          // Price monitoring parameters
          priceSource: 'coingecko',
          tokenId: 'ethereum',
          condition: 'gt',
          comparisonValue: '3000'
        },
        handler: null,
        handlerKey: null
      },
      {
        ref: '3',
        blockId: 100010,
        type: 'action',
        position: { x: 400, y: 240 },
        parameters: {
          time: '1000'
        },
        handler: null,
        handlerKey: null
      }
    ],
    edges: [
      {
        source: '2',
        target: '3',
        value: null,
        label: null
      }
    ]
  },

  [WORKFLOW_TYPES.STAKESTONE]: {
    name: `Workflow - ${WORKFLOW_TYPES.STAKESTONE}`,
    settings: {
      loopingType: 'polling',
      limit: 1000000,
      period: 300000
    },
    nodes: [
      {
        ref: '2',
        blockId: 15, // StakeStone monitoring block
        type: 'trigger',
        position: { x: 400, y: 120 },
        parameters: {
          // StakeStone specific parameters
          chainId: 1,
          protocol: 'stakestone',
          metric: 'apy'
        },
        handler: null,
        handlerKey: null
      },
      {
        ref: '3',
        blockId: 100010,
        type: 'action',
        position: { x: 400, y: 240 },
        parameters: {
          time: '1000'
        },
        handler: null,
        handlerKey: null
      }
    ],
    edges: [
      {
        source: '2',
        target: '3',
        value: null,
        label: null
      }
    ]
  },

  [WORKFLOW_TYPES.EVERY_PERIOD]: {
    name: `Workflow - ${WORKFLOW_TYPES.EVERY_PERIOD}`,
    settings: {
      loopingType: 'polling',
      limit: 1000000,
      period: 1800000 // 30 minutes
    },
    nodes: [
      {
        ref: '2',
        blockId: 20, // Periodic trigger block
        type: 'trigger',
        position: { x: 400, y: 120 },
        parameters: {
          // Periodic parameters
          interval: 1800000, // 30 minutes in ms
          executeOnStart: true
        },
        handler: null,
        handlerKey: null
      },
      {
        ref: '3',
        blockId: 100010,
        type: 'action',
        position: { x: 400, y: 240 },
        parameters: {
          time: '1000'
        },
        handler: null,
        handlerKey: null
      }
    ],
    edges: [
      {
        source: '2',
        target: '3',
        value: null,
        label: null
      }
    ]
  }
}; 