import apiClient from './apiClient';

export interface ServiceResponse {
  serviceId: number;
  databaseId: number | null;
  serviceName: string;
  serviceBaseUrl: string;
  swaggerEndpoint: string | null;
}

interface CreateServiceRequest {
  serviceName: string;
  serviceBaseUrl: string;
  databaseId?: number;
  swaggerEndpoint?: string;
}

export async function getServices(): Promise<ServiceResponse[]> {
  const response = await apiClient.get<ServiceResponse[]>('/api/v1/services');
  return response.data;
}

export async function createService(data: CreateServiceRequest): Promise<ServiceResponse[]> {
  const response = await apiClient.post<ServiceResponse[]>('/api/v1/services', data);
  return response.data;
}
