import axios from 'axios';
import apiClient from './apiClient';

export interface DatabaseResponse {
  databaseId: number;
  databaseType: 'POSTGRESQL' | 'MYSQL' | 'ORACLE' | 'SQL_SERVER';
  databaseHost: string;
  databaseName: string;
}

export async function getServiceDatabase(serviceId: number): Promise<DatabaseResponse | null> {
  try {
    const response = await apiClient.get<DatabaseResponse>(`/api/v1/services/${serviceId}/database`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function getDatabaseSchemas(databaseId: number): Promise<string[]> {
  const response = await apiClient.get<string[]>(`/api/v1/databases/${databaseId}/schemas`);
  return response.data ?? [];
}
