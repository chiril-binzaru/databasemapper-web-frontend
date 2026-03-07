import { useState } from 'react';
import { Button, Typography } from 'antd';
import { PlusOutlined, AppstoreOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import NewServiceModal from './NewServiceModal';
import { getServices } from '../services/servicesApi';

export default function ServicesPanel() {
  const [modalOpen, setModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: getServices,
  });

  const handleAfterAdd = () => {
    queryClient.invalidateQueries({ queryKey: ['services'] });
  };

  return (
    <>
      <div style={styles.container}>
        <div style={styles.toolbar}>
          <Button
            type="text"
            icon={<PlusOutlined />}
            size="small"
            style={{ color: 'rgba(255,255,255,0.65)' }}
            onClick={() => setModalOpen(true)}
          >
            Add Service
          </Button>
        </div>

        {services.length === 0 ? (
          <div style={styles.empty}>
            <span style={styles.emptyText}>No services added yet</span>
          </div>
        ) : (
          <div style={styles.list}>
            {services.map(service => (
              <div key={service.serviceId} style={styles.serviceItem}>
                <AppstoreOutlined style={styles.serviceIcon} />
                <div style={styles.serviceInfo}>
                  <Typography.Text style={styles.serviceName}>{service.serviceName}</Typography.Text>
                  <Typography.Text style={styles.serviceDesc}>{service.serviceBaseUrl}</Typography.Text>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <NewServiceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={handleAfterAdd}
      />
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  toolbar: {
    padding: '12px 16px',
    borderBottom: '1px solid #2a2a2a',
    flexShrink: 0,
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
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid #232323',
    transition: 'background 0.15s',
  },
  serviceIcon: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
    flexShrink: 0,
  },
  serviceInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  serviceName: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: 500,
  },
  serviceDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};
