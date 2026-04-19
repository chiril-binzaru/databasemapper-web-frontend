import { useState } from 'react';
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
import type { CSSProperties } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getServices, deleteService } from '../services/servicesApi';
import type { ServiceResponse } from '../services/servicesApi';
import { getServiceDatabase } from '../services/databaseApi';
import type { DatabaseResponse } from '../services/databaseApi';
import { deleteDatabaseConnection, getDatabaseConnections } from '../services/connectionsApi';
import type { ConnectionItem } from '../services/connectionsApi';
import NewConnectionModal from './NewConnectionModal';
import NewEndpointModal from './NewEndpointModal';
import SyncEndpointsModal from './SyncEndpointsModal';
import { getServiceEndpoints, replaceServiceEndpoints, syncServiceEndpoints } from '../services/endpointsApi';
import type { EndpointItem } from '../services/endpointsApi';
import type { EndpointSyncItem } from '../services/endpointsApi';
import type { EndpointMappingTab } from '../services/endpointsApi';

const METHOD_COLORS: Record<string, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
};

const SECTION_CACHE_TTL_MS = 5 * 60 * 1000;

interface ServicesPanelProps {
  onOpenMapping: (mapping: EndpointMappingTab) => void;
}

export default function ServicesPanel({ onOpenMapping }: ServicesPanelProps) {
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  const [dbExpanded, setDbExpanded] = useState(false);
  const [connectionsExpanded, setConnectionsExpanded] = useState(false);
  const [endpointsExpanded, setEndpointsExpanded] = useState(false);
  const [selectedEndpointId, setSelectedEndpointId] = useState<number | null>(null);
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());
  const [endpointModalServiceId, setEndpointModalServiceId] = useState<number | null>(null);
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
    syncStatus: 'TO_ADD_ALL' | 'CONFLICT';
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

  const handleServiceClick = (serviceId: string) => {
    if (expandedServiceId === serviceId) {
      setExpandedServiceId(null);
    } else {
      setExpandedServiceId(serviceId);
      setDbExpanded(false);
      setConnectionsExpanded(false);
      setEndpointsExpanded(false);
    }
  };

  const handleEndpointsClick = async (serviceId: number) => {
    const willExpand = !endpointsExpanded;
    setEndpointsExpanded(willExpand);

    if (!willExpand || endpointsByService[serviceId] !== undefined || endpointsLoadingByService[serviceId]) {
      return;
    }

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
    }
  };

  const handleDatabaseClick = async (serviceId: number) => {
    const willExpand = !dbExpanded;
    setDbExpanded(willExpand);
    if (!willExpand) {
      setConnectionsExpanded(false);
    }

    const databaseFetchedAt = databaseFetchedAtByService[serviceId];
    const hasFreshDatabase =
      databaseByService[serviceId] !== undefined &&
      databaseFetchedAt !== undefined &&
      Date.now() - databaseFetchedAt < SECTION_CACHE_TTL_MS;

    if (!willExpand || hasFreshDatabase || databaseLoadingByService[serviceId]) {
      return;
    }

    setDatabaseLoadingByService(prev => ({ ...prev, [serviceId]: true }));
    setDatabaseErrorByService(prev => ({ ...prev, [serviceId]: null }));

    try {
      const response = await getServiceDatabase(serviceId);
      setDatabaseByService(prev => ({ ...prev, [serviceId]: response }));
      setDatabaseFetchedAtByService(prev => ({ ...prev, [serviceId]: Date.now() }));
    } catch {
      setDatabaseErrorByService(prev => ({
        ...prev,
        [serviceId]: 'Failed to load database details. Check that the server is running.',
      }));
    } finally {
      setDatabaseLoadingByService(prev => ({ ...prev, [serviceId]: false }));
    }
  };

  const handleConnectionsClick = async (databaseId: number) => {
    const willExpand = !connectionsExpanded;
    setConnectionsExpanded(willExpand);

    const connectionsFetchedAt = connectionsFetchedAtByDatabase[databaseId];
    const hasFreshConnections =
      connectionsByDatabase[databaseId] !== undefined &&
      connectionsFetchedAt !== undefined &&
      Date.now() - connectionsFetchedAt < SECTION_CACHE_TTL_MS;

    if (!willExpand || hasFreshConnections || connectionsLoadingByDatabase[databaseId]) {
      return;
    }

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
    }
  };

  const handleSyncWithSwagger = async (service: ServiceResponse) => {
    if (syncLoadingByService[service.serviceId]) {
      return;
    }

    setSyncLoadingByService(prev => ({ ...prev, [service.serviceId]: true }));

    try {
      const response = await syncServiceEndpoints(service.serviceId);
      const syncStatus = response.syncStatus ?? response.status;

      if (syncStatus === 'UNCHANGED') {
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
      }
      if (syncStatus === 'TO_ADD_ALL' || syncStatus === 'CONFLICT') {
        setSyncModalState({
          serviceId: service.serviceId,
          serviceName: service.serviceName,
          syncStatus,
          endpoints: response.endpoints ?? [],
        });
      }
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
      const selectedKeys = new Set(selectedEndpoints.map(endpoint => `${endpoint.httpMethod}:${endpoint.path}`));
      const replacementEndpoints = syncModalState.endpoints
        .filter(endpoint => {
          const key = `${endpoint.httpMethod}:${endpoint.path}`;

          if (endpoint.status === 'UNCHANGED') {
            return true;
          }

          if (endpoint.status === 'TO_ADD') {
            return selectedKeys.has(key);
          }

          if (endpoint.status === 'TO_REMOVE') {
            return !selectedKeys.has(key);
          }

          return false;
        })
        .map(endpoint => ({
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
      setEndpointsExpanded(true);
      setExpandedServiceId(String(syncModalState.serviceId));
      setSyncModalState(null);
    } finally {
      setSyncCommitLoading(false);
    }
  };

  const getEndpointsMenuItems = () => [
    { key: 'sync-swagger', label: 'Sync with Swagger' },
  ];

  const getConnectionMenuItems = () => [
    { key: 'delete', label: <span style={{ color: '#ff4d4f' }}>Delete</span> },
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
    { key: 'delete', label: <span style={{ color: '#ff4d4f' }}>Delete</span> },
  ];

  const handleMenuClick = (key: string, service: ServiceResponse) => {
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
            color: 'rgba(255,255,255,0.45)',
            border: '1px solid rgba(255,255,255,0.45)',
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
          color: 'rgba(255,255,255,0.45)',
          border: '1px solid rgba(255,255,255,0.45)',
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
    const isExpanded = expandedServiceId === id;
    const isFavourite = favouriteIds.has(id);
    const database = databaseByService[service.serviceId];

    return (
      <div key={id}>
        <div
          style={{
            ...styles.serviceItem,
            background: isExpanded ? 'rgba(255,255,255,0.05)' : undefined,
          }}
          onClick={() => handleServiceClick(id)}
        >
          <RightOutlined
            style={{
              ...styles.chevron,
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          />
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
                <RightOutlined
                  style={{
                    ...styles.subChevron,
                    transform: dbExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}
                />
                <DatabaseOutlined style={styles.subSectionIcon} />
                <span style={styles.subSectionTitle}>Database</span>
              </div>
              {dbExpanded && (
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
                          <RightOutlined
                            style={{
                              ...styles.nestedChevron,
                              transform: connectionsExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                            }}
                          />
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
                        {connectionsExpanded && (
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
                <RightOutlined
                  style={{
                    ...styles.subChevron,
                    transform: endpointsExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}
                />
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
              {endpointsExpanded && (
                <div style={styles.subSectionContent}>
                  {endpointsLoadingByService[service.serviceId] ? (
                    <span style={styles.emptyHint}>Loading endpoints...</span>
                  ) : endpointsErrorByService[service.serviceId] ? (
                    <span style={styles.errorHint}>{endpointsErrorByService[service.serviceId]}</span>
                  ) : (endpointsByService[service.serviceId] ?? []).length === 0 ? (
                    <span style={styles.emptyHint}>No endpoint was added for this service</span>
                  ) : (
                    (endpointsByService[service.serviceId] ?? []).map(ep => (
                      <button
                        key={ep.endpointId}
                        type="button"
                        style={{
                          ...styles.endpointItem,
                          ...(selectedEndpointId === ep.endpointId ? styles.endpointItemSelected : null),
                        }}
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
                            endpointPath: ep.endpointPath,
                          });
                        }}
                      >
                        <span style={{ ...styles.endpointMethod, color: METHOD_COLORS[ep.httpMethod] ?? 'rgba(255,255,255,0.5)' }}>{ep.httpMethod}</span>
                        <span style={styles.endpointPath}>{ep.endpointPath}</span>
                      </button>
                    ))
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
            setConnectionsExpanded(true);
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
    fontSize: 12,
    color: 'rgba(255,255,255,0.2)',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 0',
    overflowY: 'auto',
  },
  serviceItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px 10px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid #232323',
    transition: 'background 0.15s',
  },
  chevron: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.25)',
    flexShrink: 0,
    transition: 'transform 0.2s',
  },
  serviceIcon: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.35)',
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
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: 500,
  },
  starIcon: {
    fontSize: 10,
    color: 'rgba(250,200,50,0.7)',
  },
  serviceDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  dotsBtn: {
    color: 'rgba(255,255,255,0.25)',
    flexShrink: 0,
  },
  subSections: {
    borderBottom: '1px solid #232323',
    background: 'rgba(0,0,0,0.15)',
  },
  subSectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px 8px 24px',
    cursor: 'pointer',
    borderTop: '1px solid #1e1e1e',
    transition: 'background 0.15s',
  },
  subChevron: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.2)',
    flexShrink: 0,
    transition: 'transform 0.2s',
  },
  subSectionIcon: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    flexShrink: 0,
  },
  subSectionTitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    flex: 1,
    fontWeight: 500,
  },
  subSectionContent: {
    padding: '10px 16px 10px 48px',
    borderTop: '1px solid #1e1e1e',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  subSectionAddBtn: {
    color: 'rgba(255,255,255,0.25)',
    flexShrink: 0,
  },
  subSectionMenuBtn: {
    color: 'rgba(255,255,255,0.25)',
    flexShrink: 0,
  },
  emptyHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
    fontStyle: 'italic',
  },
  errorHint: {
    fontSize: 11,
    color: '#ff7875',
    fontStyle: 'italic',
  },
  databaseCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
  },
  databaseTypeBadge: {
    alignSelf: 'flex-start',
    padding: '3px 8px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: 700,
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
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  databaseValue: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
    fontFamily: 'monospace',
    textAlign: 'right',
  },
  nestedSection: {
    borderTop: '1px solid rgba(255,255,255,0.08)',
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
    color: 'rgba(255,255,255,0.2)',
    flexShrink: 0,
    transition: 'transform 0.2s',
  },
  nestedSectionIcon: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.28)',
    flexShrink: 0,
  },
  nestedSectionTitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.56)',
    fontWeight: 500,
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
    borderRadius: 8,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
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
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.64)',
    fontSize: 10,
    fontWeight: 600,
  },
  connectionActiveBadge: {
    padding: '2px 7px',
    borderRadius: 999,
    background: 'rgba(73,204,144,0.14)',
    color: '#73d13d',
    fontSize: 10,
    fontWeight: 700,
  },
  connectionMenuBtn: {
    color: 'rgba(255,255,255,0.35)',
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
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  connectionValue: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
    fontFamily: 'monospace',
    textAlign: 'right',
  },
  connectionStringValue: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.62)',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
  },
  endpointItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 8px',
    width: '100%',
    border: 'none',
    background: 'transparent',
    textAlign: 'left',
    borderRadius: 6,
  },
  endpointItemSelected: {
    background: 'rgba(64,150,255,0.14)',
  },
  endpointMethod: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.04em',
    flexShrink: 0,
    width: 42,
  },
  endpointPath: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'monospace',
  },
};
