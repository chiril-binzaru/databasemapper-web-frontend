import apiClient from './apiClient';

export interface ConnectionItem {
  connectionId: number;
  databaseId: number;
  port: number | null;
  username: string | null;
  connectionString: string | null;
  connectionMode: 'PARAMETERS' | 'CONNECTION_STRING';
  active: boolean;
}

export async function getDatabaseConnections(databaseId: number): Promise<ConnectionItem[]> {
  const response = await apiClient.get<ConnectionItem[]>(`/api/v1/databases/${databaseId}/connections`);
  return response.data;
}
