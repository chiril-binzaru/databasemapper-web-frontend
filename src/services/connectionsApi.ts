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

export interface CreateConnectionRequest {
  connectionMode: 'PARAMETERS' | 'CONNECTION_STRING';
  port?: number;
  username?: string;
  password?: string;
  connectionString?: string;
}

export async function getDatabaseConnections(databaseId: number): Promise<ConnectionItem[]> {
  const response = await apiClient.get<ConnectionItem[]>(`/api/v1/databases/${databaseId}/connections`);
  return response.data;
}

export async function createDatabaseConnection(
  databaseId: number,
  data: CreateConnectionRequest,
): Promise<ConnectionItem> {
  const response = await apiClient.post<ConnectionItem>(`/api/v1/databases/${databaseId}/connections`, data);
  return response.data;
}

export async function testDatabaseConnection(
  databaseId: number,
  data: CreateConnectionRequest,
): Promise<void> {
  await apiClient.post(`/api/v1/databases/${databaseId}/connections/test`, data);
}

export async function deleteDatabaseConnection(databaseId: number, connectionId: number): Promise<void> {
  await apiClient.delete(`/api/v1/databases/${databaseId}/connections/${connectionId}`);
}
