import apiClient from './apiClient';

export interface EndpointResponse {
  endpointId: number;
  serviceId: number;
  httpMethod: string;
  endpointPath: string;
}

interface CreateEndpointRequest {
  serviceId: number;
  httpMethod: string;
  endpointPath: string;
}

export async function createEndpoint(data: CreateEndpointRequest): Promise<EndpointResponse[]> {
  const response = await apiClient.post<EndpointResponse[]>('/api/v1/endpoints', data);
  return response.data;
}
