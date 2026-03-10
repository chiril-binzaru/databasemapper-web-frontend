import { useState } from 'react';
import { Button, Typography, Dropdown } from 'antd';
import {
  AppstoreOutlined,
  DatabaseOutlined,
  ApiOutlined,
  RightOutlined,
  MoreOutlined,
  StarFilled,
} from '@ant-design/icons';
import type { CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getServices } from '../services/servicesApi';
import type { ServiceResponse } from '../services/servicesApi';

export default function ServicesPanel() {
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  const [dbExpanded, setDbExpanded] = useState(false);
  const [endpointsExpanded, setEndpointsExpanded] = useState(false);
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: getServices,
  });

  const handleServiceClick = (serviceId: string) => {
    if (expandedServiceId === serviceId) {
      setExpandedServiceId(null);
    } else {
      setExpandedServiceId(serviceId);
      setDbExpanded(false);
      setEndpointsExpanded(false);
    }
  };

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
  };

  const renderServiceItem = (service: ServiceResponse) => {
    const id = String(service.serviceId);
    const isExpanded = expandedServiceId === id;
    const isFavourite = favouriteIds.has(id);

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
                onClick={() => setDbExpanded(v => !v)}
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
                  <span style={styles.emptyHint}>No database source specified for this service</span>
                </div>
              )}
            </div>

            {/* Endpoints section */}
            <div>
              <div
                style={styles.subSectionHeader}
                onClick={() => setEndpointsExpanded(v => !v)}
              >
                <RightOutlined
                  style={{
                    ...styles.subChevron,
                    transform: endpointsExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}
                />
                <ApiOutlined style={styles.subSectionIcon} />
                <span style={styles.subSectionTitle}>Endpoints</span>
              </div>
              {endpointsExpanded && (
                <div style={styles.subSectionContent}>
                  <span style={styles.emptyHint}>No endpoint was added for this service</span>
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
  },
  emptyHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
    fontStyle: 'italic',
  },
};
