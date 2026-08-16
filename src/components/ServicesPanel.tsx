import { useRef, useState } from 'react';
import { App, Button, Typography, Dropdown, Tooltip } from 'antd';
import {
  AppstoreOutlined,
  DatabaseOutlined,
  ApiOutlined,
  RightOutlined,
  MoreOutlined,
  StarFilled,
  PlusOutlined,
} from '@ant-design/icons';
import type { CSSProperties, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getServices, deleteService } from '../services/servicesApi';
import type { ServiceResponse } from '../services/servicesApi';
import { getServiceDatabase } from '../services/databaseApi';
import type { DatabaseResponse } from '../services/databaseApi';
import { deleteDatabaseConnection, getDatabaseConnections } from '../services/connectionsApi';
import type { ConnectionItem } from '../services/connectionsApi';
import IconHoverCircle from './IconHoverCircle';
import NewConnectionModal from './NewConnectionModal';
import NewDatabaseModal from './NewDatabaseModal';
import EditDatabaseModal from './EditDatabaseModal';
import NewEndpointModal from './NewEndpointModal';
import EditServiceModal from './EditServiceModal';
import SyncEndpointsModal from './SyncEndpointsModal';
import { getServiceEndpoints, replaceServiceEndpoints, syncServiceEndpoints } from '../services/endpointsApi';
import type { EndpointItem } from '../services/endpointsApi';
import type { EndpointReplaceRequest } from '../services/endpointsApi';
import type { EndpointSyncItem } from '../services/endpointsApi';
import type { EndpointMappingTab } from '../services/endpointsApi';
import { METHOD_COLORS } from '../utils/httpMethodColors';

const SECTION_CACHE_TTL_MS = 5 * 60 * 1000;

function getEndpointKey(endpoint: Pick<EndpointItem, 'httpMethod' | 'path'>) {
  return `${endpoint.httpMethod}:${endpoint.path}`;
}

function toggleId<T>(values: Set<T>, value: T, shouldExpand: boolean): Set<T> {
  const next = new Set(values);

  if (shouldExpand) {
    next.add(value);
  } else {
    next.delete(value);
  }

  return next;
}

// A selected row is tinted with its own method color, so hovering and pressing
// it deepen that tint rather than switching to the neutral greys an unselected
// row uses. Methods with no color fall back to the neutral scale throughout.
function getEndpointRowBackground(
  methodColor: string | undefined,
  isSelected: boolean,
  isHovered: boolean,
  isPressed: boolean,
): string {
  if (isSelected) {
    if (!methodColor) {
      return 'var(--bg-subtle-strong)';
    }
    const alpha = isPressed ? '3d' : isHovered ? '2e' : '1f';
    return `${methodColor}${alpha}`;
  }

  if (isPressed) {
    return 'var(--bg-subtle-strong)';
  }

  return isHovered ? 'var(--bg-subtle)' : 'transparent';
}

interface ServicesPanelProps {
  onOpenMapping: (mapping: EndpointMappingTab) => void;
}

export default function ServicesPanel({ onOpenMapping }: ServicesPanelProps) {
  const endpointsPrefetchRef = useRef<Record<number, Promise<void> | undefined>>({});
  const databasePrefetchRef = useRef<Record<number, Promise<DatabaseResponse | null | undefined> | undefined>>({});
  const connectionsPrefetchRef = useRef<Record<number, Promise<void> | undefined>>({});
  // Several services can be expanded at once, so each section's expansion is
  // tracked per owning entity rather than as a single flag: Database and
  // Endpoints by service, Connections by the database they belong to.
  const [expandedServiceIds, setExpandedServiceIds] = useState<Set<string>>(new Set());
  const [dbExpandedServiceIds, setDbExpandedServiceIds] = useState<Set<number>>(new Set());
  const [connectionsExpandedDatabaseIds, setConnectionsExpandedDatabaseIds] = useState<Set<number>>(new Set());
  const [endpointsExpandedServiceIds, setEndpointsExpandedServiceIds] = useState<Set<number>>(new Set());
  const [selectedEndpointId, setSelectedEndpointId] = useState<number | null>(null);
  const [hoveredEndpointId, setHoveredEndpointId] = useState<number | null>(null);
  const [pressedEndpointId, setPressedEndpointId] = useState<number | null>(null);
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());
  const [endpointModalServiceId, setEndpointModalServiceId] = useState<number | null>(null);
  const [databaseModalServiceId, setDatabaseModalServiceId] = useState<number | null>(null);
  const [databaseEditTarget, setDatabaseEditTarget] = useState<{
    serviceId: number;
    database: DatabaseResponse;
  } | null>(null);
  const [editingService, setEditingService] = useState<ServiceResponse | null>(null);
  const [connectionModalDatabase, setConnectionModalDatabase] = useState<DatabaseResponse | null>(null);
  const [databaseByService, setDatabaseByService] = useState<Record<number, DatabaseResponse | null | undefined>>({});
  const [databaseFetchedAtByService, setDatabaseFetchedAtByService] = useState<Record<number, number>>({});
  const [databaseLoadingByService, setDatabaseLoadingByService] = useState<Record<number, boolean>>({});
  const [databaseErrorByService, setDatabaseErrorByService] = useState<Record<number, string | null>>({});
  const [connectionsByDatabase, setConnectionsByDatabase] = useState<Record<number, ConnectionItem[]>>({});
  const [connectionsFetchedAtByDatabase, setConnectionsFetchedAtByDatabase] = useState<Record<number, number>>({});
  const [connectionsLoadingByDatabase, setConnectionsLoadingByDatabase] = useState<Record<number, boolean>>({});
  const [connectionsErrorByDatabase, setConnectionsErrorByDatabase] = useState<Record<number, string | null>>({});
  const [endpointsByService, setEndpointsByService] = useState<Record<number, EndpointItem[]>>({});
  const [endpointsLoadingByService, setEndpointsLoadingByService] = useState<Record<number, boolean>>({});
  const [endpointsErrorByService, setEndpointsErrorByService] = useState<Record<number, string | null>>({});
  const [syncLoadingByService, setSyncLoadingByService] = useState<Record<number, boolean>>({});
  const [syncModalState, setSyncModalState] = useState<{
    serviceId: number;
    serviceName: string;
    syncStatus: 'A' | 'AU' | 'AUR' | 'UR' | 'R';
    endpoints: EndpointSyncItem[];
  } | null>(null);
  const [syncCommitLoading, setSyncCommitLoading] = useState(false);

  const { modal } = App.useApp();
  const queryClient = useQueryClient();

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: getServices,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  const deleteConnectionMutation = useMutation({
    mutationFn: ({ databaseId, connectionId }: { databaseId: number; connectionId: number }) =>
      deleteDatabaseConnection(databaseId, connectionId),
  });

  const prefetchEndpoints = async (serviceId: number) => {
    const inFlightRequest = endpointsPrefetchRef.current[serviceId];
    if (inFlightRequest) {
      return inFlightRequest;
    }

    if (endpointsByService[serviceId] !== undefined || endpointsLoadingByService[serviceId]) {
      return;
    }

    const request = (async () => {
      setEndpointsLoadingByService(prev => ({ ...prev, [serviceId]: true }));
      setEndpointsErrorByService(prev => ({ ...prev, [serviceId]: null }));

      try {
        const response = await getServiceEndpoints(serviceId);
        setEndpointsByService(prev => ({ ...prev, [serviceId]: response.endpoints }));
      } catch {
        setEndpointsErrorByService(prev => ({
          ...prev,
          [serviceId]: 'Failed to load endpoints. Check that the server is running.',
        }));
      } finally {
        setEndpointsLoadingByService(prev => ({ ...prev, [serviceId]: false }));
        delete endpointsPrefetchRef.current[serviceId];
      }
    })();

    endpointsPrefetchRef.current[serviceId] = request;
    return request;
  };

  const prefetchDatabase = async (serviceId: number): Promise<DatabaseResponse | null | undefined> => {
    const inFlightRequest = databasePrefetchRef.current[serviceId];
    if (inFlightRequest) {
      return inFlightRequest;
    }

    const databaseFetchedAt = databaseFetchedAtByService[serviceId];
    const hasFreshDatabase =
      databaseByService[serviceId] !== undefined &&
      databaseFetchedAt !== undefined &&
      Date.now() - databaseFetchedAt < SECTION_CACHE_TTL_MS;

    if (hasFreshDatabase || databaseLoadingByService[serviceId]) {
      return databaseByService[serviceId];
    }

    const request = (async () => {
      setDatabaseLoadingByService(prev => ({ ...prev, [serviceId]: true }));
      setDatabaseErrorByService(prev => ({ ...prev, [serviceId]: null }));

      try {
        const response = await getServiceDatabase(serviceId);
        setDatabaseByService(prev => ({ ...prev, [serviceId]: response }));
        setDatabaseFetchedAtByService(prev => ({ ...prev, [serviceId]: Date.now() }));
        return response;
      } catch {
        setDatabaseErrorByService(prev => ({
          ...prev,
          [serviceId]: 'Failed to load database details. Check that the server is running.',
        }));
        return null;
      } finally {
        setDatabaseLoadingByService(prev => ({ ...prev, [serviceId]: false }));
        delete databasePrefetchRef.current[serviceId];
      }
    })();

    databasePrefetchRef.current[serviceId] = request;
    return request;
  };

  const prefetchConnections = async (databaseId: number) => {
    const inFlightRequest = connectionsPrefetchRef.current[databaseId];
    if (inFlightRequest) {
      return inFlightRequest;
    }

    const connectionsFetchedAt = connectionsFetchedAtByDatabase[databaseId];
    const hasFreshConnections =
      connectionsByDatabase[databaseId] !== undefined &&
      connectionsFetchedAt !== undefined &&
      Date.now() - connectionsFetchedAt < SECTION_CACHE_TTL_MS;

    if (hasFreshConnections || connectionsLoadingByDatabase[databaseId]) {
      return;
    }

    const request = (async () => {
      setConnectionsLoadingByDatabase(prev => ({ ...prev, [databaseId]: true }));
      setConnectionsErrorByDatabase(prev => ({ ...prev, [databaseId]: null }));

      try {
        const response = await getDatabaseConnections(databaseId);
        setConnectionsByDatabase(prev => ({ ...prev, [databaseId]: response }));
        setConnectionsFetchedAtByDatabase(prev => ({ ...prev, [databaseId]: Date.now() }));
      } catch {
        setConnectionsErrorByDatabase(prev => ({
          ...prev,
          [databaseId]: 'Failed to load connections. Check that the server is running.',
        }));
      } finally {
        setConnectionsLoadingByDatabase(prev => ({ ...prev, [databaseId]: false }));
        delete connectionsPrefetchRef.current[databaseId];
      }
    })();

    connectionsPrefetchRef.current[databaseId] = request;
    return request;
  };

  const handleServiceClick = (serviceId: string) => {
    const willExpand = !expandedServiceIds.has(serviceId);
    // Collapsing a service leaves its sections as they were, so reopening it
    // returns to the same place rather than starting from scratch.
    setExpandedServiceIds(prev => toggleId(prev, serviceId, willExpand));

    if (!willExpand) {
      return;
    }

    const numericServiceId = Number(serviceId);
    void (async () => {
      await prefetchEndpoints(numericServiceId);
      const database = await prefetchDatabase(numericServiceId);
      if (database?.databaseId) {
        await prefetchConnections(database.databaseId);
      }
    })();
  };

  const handleEndpointsClick = async (serviceId: number) => {
    const willExpand = !endpointsExpandedServiceIds.has(serviceId);
    setEndpointsExpandedServiceIds(prev => toggleId(prev, serviceId, willExpand));

    if (!willExpand) {
      return;
    }

    await prefetchEndpoints(serviceId);
  };

  const handleDatabaseClick = async (serviceId: number) => {
    const willExpand = !dbExpandedServiceIds.has(serviceId);
    setDbExpandedServiceIds(prev => toggleId(prev, serviceId, willExpand));

    if (!willExpand) {
      const collapsedDatabaseId = databaseByService[serviceId]?.databaseId;
      if (collapsedDatabaseId !== undefined) {
        setConnectionsExpandedDatabaseIds(prev => toggleId(prev, collapsedDatabaseId, false));
      }
      return;
    }

    const database = await prefetchDatabase(serviceId);
    if (database?.databaseId) {
      void prefetchConnections(database.databaseId);
    }
  };

  const handleConnectionsClick = async (databaseId: number) => {
    const willExpand = !connectionsExpandedDatabaseIds.has(databaseId);
    setConnectionsExpandedDatabaseIds(prev => toggleId(prev, databaseId, willExpand));

    if (!willExpand) {
      return;
    }

    await prefetchConnections(databaseId);
  };

  const showSyncError = (title: string, content: ReactNode) => {
    modal.error({
      title,
      content,
      centered: true,
      okText: 'Ok',
      okButtonProps: {
        type: 'primary',
        size: 'small',
        style: {
          boxShadow: 'none',
        },
      },
    });
  };

  const handleSyncWithSwagger = async (service: ServiceResponse) => {
    if (syncLoadingByService[service.serviceId]) {
      return;
    }

    // The endpoint answers 500 for a service with no Swagger endpoint
    // configured, which is indistinguishable from a real failure. We know the
    // service here, so say what is actually wrong instead of asking.
    if (!service.swaggerEndpoint) {
      showSyncError(
        'Sync with Swagger',
        <span>
          No Swagger endpoint is configured for service <strong>{service.serviceName}</strong>.
          Set one through Edit before syncing.
        </span>,
      );
      return;
    }

    setSyncLoadingByService(prev => ({ ...prev, [service.serviceId]: true }));

    try {
      const response = await syncServiceEndpoints(service.serviceId);
      const syncStatus = response.syncStatus ?? response.status;

      if (syncStatus === 'U') {
        modal.info({
          title: 'Sync with Swagger',
          content: (
            <span>
              Endpoints list has not changed for service <strong>{service.serviceName}</strong>
            </span>
          ),
          centered: true,
          okText: 'Ok',
          okButtonProps: {
            type: 'primary',
            size: 'small',
            style: {
              boxShadow: 'none',
            },
          },
        });
        return;
      }

      if (!syncStatus) {
        return;
      }

      if (syncStatus !== 'A' && endpointsByService[service.serviceId] === undefined) {
        const endpointsResponse = await getServiceEndpoints(service.serviceId);
        setEndpointsByService(prev => ({ ...prev, [service.serviceId]: endpointsResponse.endpoints }));
        setEndpointsErrorByService(prev => ({ ...prev, [service.serviceId]: null }));
      }

      setSyncModalState({
        serviceId: service.serviceId,
        serviceName: service.serviceName,
        syncStatus,
        endpoints: response.endpoints ?? [],
      });
    } catch {
      showSyncError(
        'Sync with Swagger',
        <span>
          Failed to sync endpoints for service <strong>{service.serviceName}</strong>.
          Check that the server is running and that the Swagger endpoint is reachable.
        </span>,
      );
    } finally {
      setSyncLoadingByService(prev => ({ ...prev, [service.serviceId]: false }));
    }
  };

  const handleCommitSyncedEndpoints = async (selectedEndpoints: EndpointSyncItem[]) => {
    if (!syncModalState || selectedEndpoints.length === 0) {
      return;
    }

    setSyncCommitLoading(true);

    try {
      const existingEndpointsByKey = new Map(
        (endpointsByService[syncModalState.serviceId] ?? []).map(endpoint => [getEndpointKey(endpoint), endpoint]),
      );

      const selectedKeys = new Set(selectedEndpoints.map(endpoint => `${endpoint.httpMethod}:${endpoint.path}`));
      const replacementEndpoints: EndpointReplaceRequest[] = syncModalState.endpoints
        .filter(endpoint => {
          const key = getEndpointKey(endpoint);

          if (endpoint.status === 'U') {
            return true;
          }

          if (endpoint.status === 'A') {
            return selectedKeys.has(key);
          }

          if (endpoint.status === 'R') {
            return !selectedKeys.has(key);
          }

          return false;
        })
        .map(endpoint => ({
          endpointId: existingEndpointsByKey.get(getEndpointKey(endpoint))?.endpointId,
          httpMethod: endpoint.httpMethod,
          path: endpoint.path,
        }));

      const response = await replaceServiceEndpoints(
        syncModalState.serviceId,
        replacementEndpoints,
      );

      setEndpointsByService(prev => ({
        ...prev,
        [syncModalState.serviceId]: response.endpoints,
      }));
      setEndpointsErrorByService(prev => ({
        ...prev,
        [syncModalState.serviceId]: null,
      }));
      setEndpointsExpandedServiceIds(prev => toggleId(prev, syncModalState.serviceId, true));
      setExpandedServiceIds(prev => toggleId(prev, String(syncModalState.serviceId), true));
      setSyncModalState(null);
    } finally {
      setSyncCommitLoading(false);
    }
  };

  const getEndpointsMenuItems = () => [
    { key: 'sync-swagger', label: 'Sync with Swagger' },
  ];

  // No Delete: the API exposes only GET/POST/PUT for a service's database.
  const getDatabaseMenuItems = () => [
    { key: 'edit', label: 'Edit' },
  ];

  const getConnectionMenuItems = () => [
    { key: 'delete', label: <span style={{ color: 'var(--status-critical)' }}>Delete</span> },
  ];

  const toggleFavourite = (serviceId: string) => {
    setFavouriteIds(prev => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
  };

  const getMenuItems = (service: ServiceResponse) => [
    { key: 'edit', label: 'Edit' },
    {
      key: 'favourite',
      label: favouriteIds.has(String(service.serviceId))
        ? 'Remove from Favourites'
        : 'Add to Favourites',
    },
    { type: 'divider' as const },
    { key: 'delete', label: <span style={{ color: 'var(--status-critical)' }}>Delete</span> },
  ];

  const handleMenuClick = (key: string, service: ServiceResponse) => {
    if (key === 'edit') setEditingService(service);
    if (key === 'favourite') toggleFavourite(String(service.serviceId));
    if (key === 'delete') {
      modal.confirm({
        title: 'Delete Service',
        content: `Are you sure you want to delete "${service.serviceName}" service? This action cannot be undone.`,
        okText: 'Delete',
        cancelText: 'Cancel',
        centered: true,
        okButtonProps: {
          className: 'confirm-delete-btn',
          style: { boxShadow: 'none' },
        },
        cancelButtonProps: {
          type: 'text',
          style: {
            color: 'var(--text-tertiary)',
            border: '1px solid var(--border-strong)',
            boxShadow: 'none',
          },
        },
        onOk: () => deleteMutation.mutate(service.serviceId),
      });
    }
  };

  const handleDeleteConnection = (connection: ConnectionItem) => {
    modal.confirm({
      title: 'Delete Connection',
      content: 'Are you sure you want to delete this connection? This action cannot be undone.',
      okText: 'Delete',
      cancelText: 'Cancel',
      centered: true,
      okButtonProps: {
        className: 'confirm-delete-btn',
        style: { boxShadow: 'none' },
      },
      cancelButtonProps: {
        type: 'text',
        style: {
          color: 'var(--text-tertiary)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'none',
        },
      },
      onOk: async () => {
        await deleteConnectionMutation.mutateAsync({
          databaseId: connection.databaseId,
          connectionId: connection.connectionId,
        });

        setConnectionsByDatabase(prev => ({
          ...prev,
          [connection.databaseId]: (prev[connection.databaseId] ?? []).filter(
            item => item.connectionId !== connection.connectionId,
          ),
        }));
        setConnectionsErrorByDatabase(prev => ({
          ...prev,
          [connection.databaseId]: null,
        }));
      },
    });
  };

  const renderServiceItem = (service: ServiceResponse) => {
    const id = String(service.serviceId);
    const isExpanded = expandedServiceIds.has(id);
    const isDbExpanded = dbExpandedServiceIds.has(service.serviceId);
    const isEndpointsExpanded = endpointsExpandedServiceIds.has(service.serviceId);
    const isFavourite = favouriteIds.has(id);
    const database = databaseByService[service.serviceId];

    return (
      <div key={id}>
        <div
          style={{
            ...styles.serviceItem,
            background: isExpanded ? 'var(--bg-subtle)' : undefined,
          }}
          onClick={() => handleServiceClick(id)}
        >
          <IconHoverCircle circleSize={21} circleColor="var(--bg-subtle-strong)">
            <RightOutlined
              style={{
                ...styles.chevron,
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
            />
          </IconHoverCircle>
          <AppstoreOutlined style={styles.serviceIcon} />
          <div style={styles.serviceInfo}>
            <div style={styles.serviceNameRow}>
              <Typography.Text style={styles.serviceName}>{service.serviceName}</Typography.Text>
              {isFavourite && <StarFilled style={styles.starIcon} />}
            </div>
            <Typography.Text style={styles.serviceDesc}>{service.serviceBaseUrl}</Typography.Text>
          </div>
          <Dropdown
            menu={{
              items: getMenuItems(service),
              onClick: ({ key, domEvent }) => {
                domEvent.stopPropagation();
                handleMenuClick(key, service);
              },
            }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              style={styles.dotsBtn}
              onClick={e => e.stopPropagation()}
            />
          </Dropdown>
        </div>

        {isExpanded && (
          <div style={styles.subSections}>
            {/* Database section */}
            <div>
              <div
                style={styles.subSectionHeader}
                onClick={() => void handleDatabaseClick(service.serviceId)}
              >
                <IconHoverCircle circleSize={20} circleColor="var(--bg-subtle-strong)">
                  <RightOutlined
                    style={{
                      ...styles.subChevron,
                      transform: isDbExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    }}
                  />
                </IconHoverCircle>
                <DatabaseOutlined style={styles.subSectionIcon} />
                <span style={styles.subSectionTitle}>Database</span>
                {database && (
                  <Dropdown
                    menu={{
                      items: getDatabaseMenuItems(),
                      onClick: ({ key, domEvent }) => {
                        domEvent.stopPropagation();

                        if (key === 'edit') {
                          setDatabaseEditTarget({ serviceId: service.serviceId, database });
                        }
                      },
                    }}
                    trigger={['click']}
                    placement="bottomRight"
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<MoreOutlined />}
                      style={styles.subSectionMenuBtn}
                      onClick={e => e.stopPropagation()}
                    />
                  </Dropdown>
                )}
                {/* A service holds at most one database, so the button only
                    appears once the fetch has confirmed there is none. */}
                {database === null && (
                  <Tooltip title="Add Database" placement="bottom">
                    <Button
                      type="text"
                      size="small"
                      icon={<PlusOutlined />}
                      style={styles.subSectionAddBtn}
                      onClick={e => {
                        e.stopPropagation();
                        setDatabaseModalServiceId(service.serviceId);
                      }}
                    />
                  </Tooltip>
                )}
              </div>
              {isDbExpanded && (
                <div style={styles.subSectionContent}>
                  {databaseLoadingByService[service.serviceId] ? (
                    <span style={styles.emptyHint}>Loading database details...</span>
                  ) : databaseErrorByService[service.serviceId] ? (
                    <span style={styles.errorHint}>{databaseErrorByService[service.serviceId]}</span>
                  ) : !database ? (
                    <span style={styles.emptyHint}>No database source specified for this service</span>
                  ) : (
                    <div style={styles.databaseCard}>
                      <div style={styles.databaseTypeBadge}>
                        {database.databaseType.replace('_', ' ')}
                      </div>
                      <div style={styles.databaseDetails}>
                        <div style={styles.databaseRow}>
                          <span style={styles.databaseLabel}>Name</span>
                          <span style={styles.databaseValue}>{database.databaseName}</span>
                        </div>
                        <div style={styles.databaseRow}>
                          <span style={styles.databaseLabel}>Host</span>
                          <span style={styles.databaseValue}>{database.databaseHost}</span>
                        </div>
                      </div>
                      <div style={styles.nestedSection}>
                        <div
                          style={styles.nestedSectionHeader}
                          onClick={() => void handleConnectionsClick(database.databaseId)}
                        >
                          <IconHoverCircle circleSize={20} circleColor="var(--bg-subtle-strong)">
                            <RightOutlined
                              style={{
                                ...styles.nestedChevron,
                                transform: connectionsExpandedDatabaseIds.has(database.databaseId) ? 'rotate(90deg)' : 'rotate(0deg)',
                              }}
                            />
                          </IconHoverCircle>
                          <ApiOutlined style={styles.nestedSectionIcon} />
                          <span style={styles.nestedSectionTitle}>Connections</span>
                          <Tooltip title="Add Connection" placement="bottom">
                            <Button
                              type="text"
                              size="small"
                              icon={<PlusOutlined />}
                              style={styles.subSectionAddBtn}
                              onClick={e => {
                                e.stopPropagation();
                                setConnectionModalDatabase(database);
                              }}
                            />
                          </Tooltip>
                        </div>
                        {connectionsExpandedDatabaseIds.has(database.databaseId) && (
                          <div style={styles.nestedSectionContent}>
                            {connectionsLoadingByDatabase[database.databaseId] ? (
                              <span style={styles.emptyHint}>Loading connections...</span>
                            ) : connectionsErrorByDatabase[database.databaseId] ? (
                              <span style={styles.errorHint}>{connectionsErrorByDatabase[database.databaseId]}</span>
                            ) : (connectionsByDatabase[database.databaseId] ?? []).length === 0 ? (
                              <span style={styles.emptyHint}>No database connections configured</span>
                            ) : (
                              (connectionsByDatabase[database.databaseId] ?? []).map(connection => (
                                <div key={connection.connectionId} style={styles.connectionItem}>
                                  <div style={styles.connectionMainRow}>
                                    <div style={styles.connectionBadges}>
                                      <span style={styles.connectionModeBadge}>
                                        {connection.connectionMode === 'CONNECTION_STRING' ? 'Connection String' : 'Parameters'}
                                      </span>
                                      {connection.active && <span style={styles.connectionActiveBadge}>Active</span>}
                                    </div>
                                    <Dropdown
                                      menu={{
                                        items: getConnectionMenuItems(),
                                        onClick: ({ key, domEvent }) => {
                                          domEvent.stopPropagation();

                                          if (key === 'delete') {
                                            handleDeleteConnection(connection);
                                          }
                                        },
                                      }}
                                      trigger={['click']}
                                      placement="bottomRight"
                                    >
                                      <Button
                                        type="text"
                                        size="small"
                                        icon={<MoreOutlined />}
                                        style={styles.connectionMenuBtn}
                                        onClick={e => e.stopPropagation()}
                                      />
                                    </Dropdown>
                                  </div>
                                  {connection.username ? (
                                    <div style={styles.connectionRow}>
                                      <span style={styles.connectionLabel}>User</span>
                                      <span style={styles.connectionValue}>{connection.username}</span>
                                    </div>
                                  ) : null}
                                  {connection.port !== null && connection.port !== undefined ? (
                                    <div style={styles.connectionRow}>
                                      <span style={styles.connectionLabel}>Port</span>
                                      <span style={styles.connectionValue}>{connection.port}</span>
                                    </div>
                                  ) : null}
                                  {connection.connectionString ? (
                                    <div style={styles.connectionColumn}>
                                      <span style={styles.connectionLabel}>Connection String</span>
                                      <span style={styles.connectionStringValue}>{connection.connectionString}</span>
                                    </div>
                                  ) : null}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Endpoints section */}
            <div>
              <div
                style={styles.subSectionHeader}
                onClick={() => void handleEndpointsClick(service.serviceId)}
              >
                <IconHoverCircle circleSize={20} circleColor="var(--bg-subtle-strong)">
                  <RightOutlined
                    style={{
                      ...styles.subChevron,
                      transform: isEndpointsExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    }}
                  />
                </IconHoverCircle>
                <ApiOutlined style={styles.subSectionIcon} />
                <span style={styles.subSectionTitle}>Endpoints</span>
                <Dropdown
                  menu={{
                    items: getEndpointsMenuItems(),
                    onClick: ({ key, domEvent }) => {
                      domEvent.stopPropagation();

                      if (key === 'sync-swagger') {
                        void handleSyncWithSwagger(service);
                      }
                    },
                  }}
                  trigger={['click']}
                  placement="bottomRight"
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<MoreOutlined />}
                    loading={syncLoadingByService[service.serviceId]}
                    style={styles.subSectionMenuBtn}
                    onClick={e => e.stopPropagation()}
                  />
                </Dropdown>
                <Tooltip title="Add Endpoint" placement="bottom">
                  <Button
                    type="text"
                    size="small"
                    icon={<PlusOutlined />}
                    style={styles.subSectionAddBtn}
                    onClick={e => {
                      e.stopPropagation();
                      setEndpointModalServiceId(service.serviceId);
                    }}
                  />
                </Tooltip>
              </div>
              {isEndpointsExpanded && (
                <div style={styles.subSectionContent}>
                  {endpointsLoadingByService[service.serviceId] ? (
                    <span style={styles.emptyHint}>Loading endpoints...</span>
                  ) : endpointsErrorByService[service.serviceId] ? (
                    <span style={styles.errorHint}>{endpointsErrorByService[service.serviceId]}</span>
                  ) : (endpointsByService[service.serviceId] ?? []).length === 0 ? (
                    <span style={styles.emptyHint}>No endpoint was added for this service</span>
                  ) : (
                    (endpointsByService[service.serviceId] ?? []).map(ep => {
                      const methodColor = METHOD_COLORS[ep.httpMethod];
                      const accentColor = methodColor ?? 'var(--text-tertiary)';
                      const isSelected = selectedEndpointId === ep.endpointId;

                      return (
                        <button
                          key={ep.endpointId}
                          type="button"
                          style={{
                            ...styles.endpointItem,
                            // Both derive from the method color, so neither can
                            // live in the static style map.
                            background: getEndpointRowBackground(
                              methodColor,
                              isSelected,
                              hoveredEndpointId === ep.endpointId,
                              pressedEndpointId === ep.endpointId,
                            ),
                            ...(isSelected ? { borderColor: accentColor } : null),
                          }}
                          onMouseEnter={() => setHoveredEndpointId(ep.endpointId)}
                          onMouseLeave={() => {
                            setHoveredEndpointId(current => (current === ep.endpointId ? null : current));
                            setPressedEndpointId(current => (current === ep.endpointId ? null : current));
                          }}
                          onMouseDown={() => setPressedEndpointId(ep.endpointId)}
                          onMouseUp={() => setPressedEndpointId(current => (current === ep.endpointId ? null : current))}
                          onClick={() => {
                            setSelectedEndpointId(ep.endpointId);
                          }}
                          onDoubleClick={event => {
                            event.stopPropagation();
                            setSelectedEndpointId(ep.endpointId);
                            onOpenMapping({
                              endpointId: ep.endpointId,
                              serviceId: service.serviceId,
                              serviceName: service.serviceName,
                              httpMethod: ep.httpMethod,
                              endpointPath: ep.path,
                            });
                          }}
                        >
                          <span style={{ ...styles.endpointMethod, color: accentColor }}>{ep.httpMethod}</span>
                          <span style={styles.endpointPath}>{ep.path}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const sortedServices = [
    ...services.filter(s => favouriteIds.has(String(s.serviceId))),
    ...services.filter(s => !favouriteIds.has(String(s.serviceId))),
  ];

  return (
    <>
      <div style={styles.container}>
        {services.length === 0 ? (
          <div style={styles.empty}>
            <span style={styles.emptyText}>No services added yet</span>
          </div>
        ) : (
          <div style={styles.list}>
            {sortedServices.map(renderServiceItem)}
          </div>
        )}
      </div>

      {endpointModalServiceId !== null && (
        <NewEndpointModal
          open
          serviceId={endpointModalServiceId}
          onClose={() => setEndpointModalServiceId(null)}
          onAdd={endpoints => {
            setEndpointsByService(prev => ({ ...prev, [endpointModalServiceId]: endpoints }));
            setEndpointModalServiceId(null);
          }}
        />
      )}

      {databaseModalServiceId !== null && (
        <NewDatabaseModal
          open
          serviceId={databaseModalServiceId}
          onClose={() => setDatabaseModalServiceId(null)}
          onAdd={database => {
            setDatabaseByService(prev => ({ ...prev, [databaseModalServiceId]: database }));
            setDatabaseFetchedAtByService(prev => ({ ...prev, [databaseModalServiceId]: Date.now() }));
            setDatabaseErrorByService(prev => ({ ...prev, [databaseModalServiceId]: null }));
            setDbExpandedServiceIds(prev => toggleId(prev, databaseModalServiceId, true));
            setDatabaseModalServiceId(null);
          }}
        />
      )}

      {databaseEditTarget !== null && (
        <EditDatabaseModal
          open
          serviceId={databaseEditTarget.serviceId}
          database={databaseEditTarget.database}
          onClose={() => setDatabaseEditTarget(null)}
          onSave={database => {
            setDatabaseByService(prev => ({ ...prev, [databaseEditTarget.serviceId]: database }));
            setDatabaseFetchedAtByService(prev => ({ ...prev, [databaseEditTarget.serviceId]: Date.now() }));
            setDatabaseErrorByService(prev => ({ ...prev, [databaseEditTarget.serviceId]: null }));
            setDatabaseEditTarget(null);
          }}
        />
      )}

      {editingService !== null && (
        <EditServiceModal
          open
          service={editingService}
          onClose={() => setEditingService(null)}
          onSave={updatedService => {
            queryClient.setQueryData<ServiceResponse[]>(['services'], prev =>
              (prev ?? []).map(item =>
                item.serviceId === updatedService.serviceId ? updatedService : item,
              ),
            );
            setEditingService(null);
          }}
        />
      )}

      {connectionModalDatabase !== null && (
        <NewConnectionModal
          open
          database={connectionModalDatabase}
          onClose={() => setConnectionModalDatabase(null)}
          onAdd={connection => {
            setConnectionsByDatabase(prev => {
              const existingConnections = prev[connection.databaseId] ?? [];
              const normalizedConnections = connection.active
                ? existingConnections.map(item => ({ ...item, active: false }))
                : existingConnections;
              const withoutReplaced = normalizedConnections.filter(item => item.connectionId !== connection.connectionId);

              return {
                ...prev,
                [connection.databaseId]: [...withoutReplaced, connection],
              };
            });
            setConnectionsErrorByDatabase(prev => ({
              ...prev,
              [connection.databaseId]: null,
            }));
            setConnectionsExpandedDatabaseIds(prev => toggleId(prev, connection.databaseId, true));
            setConnectionModalDatabase(null);
          }}
        />
      )}

      {syncModalState !== null && (
        <SyncEndpointsModal
          open
          serviceName={syncModalState.serviceName}
          syncStatus={syncModalState.syncStatus}
          endpoints={syncModalState.endpoints}
          loading={syncCommitLoading}
          onCancel={() => setSyncModalState(null)}
          onConfirm={handleCommitSyncedEndpoints}
        />
      )}
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    font: 'var(--text-sm)',
    color: 'var(--text-disabled)',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    padding: 'var(--sp-2) 0',
    overflowY: 'auto',
  },
  serviceItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px 10px var(--sp-4)',
    cursor: 'pointer',
    borderBottom: '1px solid var(--border-subtle)',
    transition: 'background 0.15s',
  },
  chevron: {
    fontSize: 10,
    color: 'var(--text-tertiary)',
    flexShrink: 0,
    transition: 'transform 0.2s',
  },
  serviceIcon: {
    fontSize: 15,
    color: 'var(--text-secondary)',
    flexShrink: 0,
  },
  serviceInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
    flex: 1,
  },
  serviceNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  serviceName: {
    font: 'var(--text-base-md)',
    color: 'var(--text-primary)',
  },
  starIcon: {
    fontSize: 10,
    color: 'var(--status-warning)',
  },
  serviceDesc: {
    font: 'var(--text-sm)',
    color: 'var(--text-tertiary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  dotsBtn: {
    color: 'var(--text-tertiary)',
    flexShrink: 0,
  },
  subSections: {
    borderBottom: '1px solid var(--border-subtle)',
    background: 'var(--bg-canvas)',
  },
  subSectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px var(--sp-4) 8px 24px',
    cursor: 'pointer',
    borderTop: '1px solid var(--border-subtle)',
    transition: 'background 0.15s',
  },
  subChevron: {
    fontSize: 9,
    color: 'var(--text-disabled)',
    flexShrink: 0,
    transition: 'transform 0.2s',
  },
  subSectionIcon: {
    fontSize: 13,
    color: 'var(--text-tertiary)',
    flexShrink: 0,
  },
  subSectionTitle: {
    font: 'var(--text-base-md)',
    color: 'var(--text-secondary)',
    flex: 1,
  },
  subSectionContent: {
    padding: '10px var(--sp-4) 10px 48px',
    borderTop: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  subSectionAddBtn: {
    color: 'var(--text-tertiary)',
    flexShrink: 0,
  },
  subSectionMenuBtn: {
    color: 'var(--text-tertiary)',
    flexShrink: 0,
  },
  emptyHint: {
    font: 'var(--text-sm)',
    color: 'var(--text-disabled)',
    fontStyle: 'italic',
  },
  errorHint: {
    font: 'var(--text-sm)',
    color: 'var(--status-critical)',
    fontStyle: 'italic',
  },
  databaseCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 'var(--sp-3)',
    borderRadius: 'var(--r-lg)',
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-subtle)',
  },
  databaseTypeBadge: {
    alignSelf: 'flex-start',
    padding: '3px 8px',
    borderRadius: 'var(--r-full)',
    background: 'var(--bg-subtle-strong)',
    color: 'var(--text-secondary)',
    font: 'var(--text-micro)',
    letterSpacing: '0.06em',
  },
  databaseDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  databaseRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  databaseLabel: {
    font: 'var(--text-sm)',
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  databaseValue: {
    font: 'var(--text-mono)',
    color: 'var(--text-secondary)',
    textAlign: 'right',
  },
  nestedSection: {
    borderTop: '1px solid var(--border-subtle)',
    paddingTop: 10,
  },
  nestedSectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
  },
  nestedChevron: {
    fontSize: 9,
    color: 'var(--text-disabled)',
    flexShrink: 0,
    transition: 'transform 0.2s',
  },
  nestedSectionIcon: {
    fontSize: 12,
    color: 'var(--text-tertiary)',
    flexShrink: 0,
  },
  nestedSectionTitle: {
    font: 'var(--text-base-md)',
    color: 'var(--text-secondary)',
  },
  nestedSectionContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingTop: 10,
  },
  connectionItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '9px 10px',
    borderRadius: 'var(--r-md)',
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-subtle)',
  },
  connectionMainRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  connectionBadges: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  connectionModeBadge: {
    padding: '2px 7px',
    borderRadius: 'var(--r-full)',
    background: 'var(--bg-subtle-strong)',
    color: 'var(--text-secondary)',
    fontSize: 10,
    fontWeight: 600,
  },
  connectionActiveBadge: {
    padding: '2px 7px',
    borderRadius: 'var(--r-full)',
    background: 'var(--status-good-subtle)',
    color: 'var(--status-good)',
    fontSize: 10,
    fontWeight: 700,
  },
  connectionMenuBtn: {
    color: 'var(--text-secondary)',
    flexShrink: 0,
  },
  connectionRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  connectionColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  connectionLabel: {
    font: 'var(--text-sm)',
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  connectionValue: {
    font: 'var(--text-mono)',
    color: 'var(--text-secondary)',
    textAlign: 'right',
  },
  connectionStringValue: {
    font: 'var(--text-mono)',
    color: 'var(--text-secondary)',
    wordBreak: 'break-all',
  },
  endpointItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    // Padding absorbs the always-present 1px border so selecting a row
    // doesn't nudge the list by 2px.
    padding: '4px 7px',
    width: '100%',
    // Longhands, not the `border` shorthand: the selected state overrides
    // borderColor alone, and clearing a longhand that the base only sets via
    // a shorthand falls back to currentColor (a black ring on deselect).
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    background: 'transparent',
    textAlign: 'left',
    borderRadius: 'var(--r-sm)',
    cursor: 'pointer',
    transition: 'background 0.15s ease, border-color 0.15s ease',
  },
  endpointMethod: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.04em',
    flexShrink: 0,
    width: 42,
  },
  endpointPath: {
    font: 'var(--text-mono)',
    color: 'var(--text-secondary)',
  },
};
