import { CreateWorkflowPayload } from '../types'
import { api } from './axios.config'

export const createWorkflow = (payload: CreateWorkflowPayload) => {
  return api.post('/workflows', payload)
}

export const getWorkflow = (workflowId: string) => {
  return api.get(`/workflows/${workflowId}`)
}

export const runWorkflow = (workflowId: string) => {
  return api.post(`/workflows/${workflowId}/run`)
}

export const stopWorkflow = (workflowId: string) => {
  return api.post(`/workflows/${workflowId}/stop`)
}
