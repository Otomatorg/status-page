import fetch, { RequestInit } from 'node-fetch';
import { CreateWorkflowPayload, Workflow, ExecutionResponse } from '../types/workflow.js';

import dotenv from 'dotenv';
dotenv.config();

// Configuration
const API_ENDPOINT = process.env.API_ENDPOINT || 'http://localhost:3000/api';
const API_TOKEN = process.env.API_TOKEN || '';

interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

class ApiService {
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${API_ENDPOINT}${endpoint}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `${API_TOKEN}`,
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as T;
      return { data, success: true };
    } catch (error: any) {
      // console.error(`API Error for ${endpoint}:`, error);
      return {
        data: {} as T,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async createWorkflow(payload: CreateWorkflowPayload): Promise<ApiResponse<Workflow>> {
    return this.makeRequest<Workflow>('/workflows', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getWorkflow(workflowId: string): Promise<ApiResponse<Workflow>> {
    return this.makeRequest<Workflow>(`/workflows/${workflowId}`);
  }

  async runWorkflow(workflowId: string): Promise<ApiResponse<ExecutionResponse>> {
    return this.makeRequest<ExecutionResponse>(`/workflows/${workflowId}/run`, {
      method: 'POST',
    });
  }

  async stopWorkflow(workflowId: string): Promise<ApiResponse<{ message: string }>> {
    return this.makeRequest<{ message: string }>(`/workflows/${workflowId}/stop`, {
      method: 'POST',
    });
  }

  async getExecution(executionId: string): Promise<ApiResponse<any>> {
    return this.makeRequest<any>(`/executions/${executionId}`);
  }

  async getExecutionsByWorkflowId(workflowId: string, limit: number = 1000): Promise<ApiResponse<any>> {
    return this.makeRequest<any>(`/executions?workflowId=${workflowId}&offset=0&limit=${limit}`);
  }

  async getRecentExecutionsByWorkflowId(workflowId: string): Promise<ApiResponse<any>> {
    // For now, fetch all executions and filter client-side
    // You can update this if your API supports date filtering with specific parameters
    return this.makeRequest<any>(`/executions?workflowId=${workflowId}&offset=0&limit=1000`);
  }
}

export const apiService = new ApiService(); 