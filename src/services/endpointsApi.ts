import apiClient from './apiClient';

export interface EndpointItem {
  endpointId: number;
  httpMethod: string;
  endpointPath: string;
}

export interface EndpointMappingTab {
  endpointId: number;
  serviceId: number;
  serviceName: string;
  httpMethod: string;
  endpointPath: string;
}

export interface EndpointsResponse {
  serviceId: number;
  endpoints: EndpointItem[];
}

export interface EndpointSyncItem {
  httpMethod: string;
  path: string;
  status?: 'TO_ADD' | 'TO_REMOVE' | 'UNCHANGED';
}

export interface EndpointReplaceRequest {
  httpMethod: string;
  path: string;
}

export interface SyncEndpointsResponse {
  status?: 'UNCHANGED' | 'TO_ADD_ALL' | 'CONFLICT';
  syncStatus?: 'UNCHANGED' | 'TO_ADD_ALL' | 'CONFLICT';
  endpoints?: EndpointSyncItem[] | null;
}

interface CreateEndpointRequest {
  httpMethod: string;
  endpointPath: string;
}

export async function createEndpoint(serviceId: number, data: CreateEndpointRequest): Promise<EndpointsResponse> {
  const response = await apiClient.post<EndpointsResponse>(`/api/v1/services/${serviceId}/endpoints`, data);
  return response.data;
}

export async function getServiceEndpoints(serviceId: number): Promise<EndpointsResponse> {
  const response = await apiClient.get<EndpointsResponse>(`/api/v1/services/${serviceId}/endpoints`);
  return response.data;
}

export async function replaceServiceEndpoints(
  serviceId: number,
  data: EndpointReplaceRequest[],
): Promise<EndpointsResponse> {
  const response = await apiClient.put<EndpointsResponse>(`/api/v1/services/${serviceId}/endpoints`, data);
  return response.data;
}

export async function syncServiceEndpoints(serviceId: number): Promise<SyncEndpointsResponse> {
  const response = await apiClient.post<SyncEndpointsResponse>(`/api/v1/services/${serviceId}/endpoints/sync`);
  return response.data;
}

export async function getEndpointMapping(endpointId: number): Promise<unknown | null> {
  const response = await apiClient.get<unknown | null>(`/api/v1/endpoints/${endpointId}/mapping`);
  return response.data ?? null;
}

export async function getEndpointResponseModel(endpointId: number): Promise<unknown | null> {
  const response = await apiClient.get<unknown | null>(`/api/v1/endpoints/${endpointId}/responseModel`);
  return response.data ?? null;
}
