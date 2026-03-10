import apiClient from './apiClient';

export interface EndpointItem {
  endpointId: number;
  httpMethod: string;
  endpointPath: string;
}

export interface EndpointsResponse {
  serviceId: number;
  endpoints: EndpointItem[];
}

interface CreateEndpointRequest {
  serviceId: number;
  httpMethod: string;
  endpointPath: string;
}

export async function createEndpoint(data: CreateEndpointRequest): Promise<EndpointsResponse> {
  const response = await apiClient.post<EndpointsResponse>('/api/v1/endpoints', data);
  return response.data;
}
