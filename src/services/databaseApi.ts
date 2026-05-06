import axios from 'axios';
import apiClient from './apiClient';

export interface DatabaseResponse {
  databaseId: number;
  databaseType: 'POSTGRESQL' | 'MYSQL' | 'ORACLE' | 'SQL_SERVER';
  databaseHost: string;
  databaseName: string;
}

export interface DbColumnResponse {
  name: string;
  dataType?: string;
  nullable?: boolean;
  ordinalPosition?: number;
  columnDefault?: string;
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

export async function getDatabaseTables(databaseId: number, schemaName: string): Promise<string[]> {
  const response = await apiClient.get<string[]>(
    `/api/v1/databases/${databaseId}/schemas/${encodeURIComponent(schemaName)}/tables`,
  );
  return response.data ?? [];
}

export async function getDatabaseColumns(
  databaseId: number,
  schemaName: string,
  tableName: string,
): Promise<DbColumnResponse[]> {
  const response = await apiClient.get<DbColumnResponse[]>(
    `/api/v1/databases/${databaseId}/schemas/${encodeURIComponent(schemaName)}/tables/${encodeURIComponent(tableName)}/columns`,
  );
  return response.data ?? [];
}
