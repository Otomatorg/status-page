import { config } from 'dotenv';

config();

export const CONFIG = {    
  // File paths
  paths: {
    /**
     * Get the executions file path for a given date.
     * @param date - The date string in 'YYYY-MM-DD' format.
     * @returns The executions file path with the date interpolated.
     */
    getExecutionsFilePath: (date: string): string =>
      `public/data/executions/${date}/executions.json`,

    /**
     * Get the errors file path for a given date.
     * @param date - The date string in 'YYYY-MM-DD' format.
     * @returns The errors file path with the date interpolated.
     */
    getErrorsFilePath: (date: string): string =>
      `public/data/executions/${date}/errors.json`,

    workflowDataPath: `public/data/wf_data.json`
  }
}; 