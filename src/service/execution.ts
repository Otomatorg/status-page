import { api } from './axios.config'

export const getExecution = (executionId: string) => {
  return api.get(`/executions/${executionId}`)
}