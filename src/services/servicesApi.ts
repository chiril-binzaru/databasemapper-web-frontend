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

interface UpdateServiceRequest {
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

export async function updateService(serviceId: number, data: UpdateServiceRequest): Promise<ServiceResponse> {
  const response = await apiClient.put<ServiceResponse>(`/api/v1/services/${serviceId}`, data);
  return response.data;
}

export async function deleteService(serviceId: number): Promise<void> {
  await apiClient.delete(`/api/v1/services/${serviceId}`);
}
