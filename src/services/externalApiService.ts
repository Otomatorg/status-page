import fetch from 'node-fetch';

interface TokenPriceResponse {
  price?: number;
}

class ExternalApiService {
  private async makeRequest<T>(url: string): Promise<T> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json() as T;
    } catch (error: any) {
      console.error(`External API Error for ${url}:`, error);
      throw error;
    }
  }

  async getTokenPrice(
    chainId: number,
    tokenAddress: string,
  ): Promise<number | undefined> {
    try {
      const url = `https://api.odos.xyz/pricing/token/${chainId}/${tokenAddress}`;
      const tokenPriceJson = await this.makeRequest<TokenPriceResponse>(url);
      return tokenPriceJson?.price;
    } catch (error) {
      console.error('Error fetching token price:', error);
      return undefined;
    }
  }
}

export const externalApiService = new ExternalApiService();
