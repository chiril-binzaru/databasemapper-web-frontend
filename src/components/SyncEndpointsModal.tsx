import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Checkbox, ConfigProvider } from 'antd';
import { ApiOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import type { EndpointSyncItem } from '../services/endpointsApi';

interface SyncEndpointsModalProps {
  open: boolean;
  serviceName: string;
  endpoints: EndpointSyncItem[];
  loading: boolean;
  onCancel: () => void;
  onConfirm: (selectedEndpoints: EndpointSyncItem[]) => Promise<void> | void;
}

export default function SyncEndpointsModal({
  open,
  serviceName,
  endpoints,
  loading,
  onCancel,
  onConfirm,
}: SyncEndpointsModalProps) {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedKeys(endpoints.map(getEndpointKey));
  }, [open, endpoints]);

  const allKeys = useMemo(() => endpoints.map(getEndpointKey), [endpoints]);
  const allChecked = endpoints.length > 0 && selectedKeys.length === endpoints.length;
  const indeterminate = selectedKeys.length > 0 && selectedKeys.length < endpoints.length;

  const handleToggleAll = (checked: boolean) => {
    setSelectedKeys(checked ? allKeys : []);
  };

  const handleConfirm = () => {
    const selectedEndpoints = endpoints.filter(endpoint => selectedKeys.includes(getEndpointKey(endpoint)));
    void onConfirm(selectedEndpoints);
  };

  return (
    <Modal
      open={open}
      onCancel={loading ? undefined : onCancel}
      title={<span style={styles.modalTitle}>Sync with Swagger</span>}
      width={560}
      centered
      footer={null}
      closable={!loading}
      mask={{ closable: !loading }}
      styles={{
        container: { padding: 0, background: '#2b2b2b', borderRadius: 8 },
        header: { padding: '16px 48px 12px 20px', background: 'transparent', borderBottom: 'none', marginBottom: 0 },
        body: { padding: 0 },
      }}
    >
      <ConfigProvider
        componentSize="large"
        theme={{
          components: {
            Checkbox: {
              colorPrimary: '#1677ff',
              colorPrimaryHover: '#4096ff',
            },
          },
        }}
      >
        <div style={styles.body}>
          <div style={styles.sectionBody}>
            <div style={styles.subtitle}>
              List of endpoints for <strong>{serviceName}</strong> service is empty now. Choose endpoints to be added from Swagger.
            </div>

            <div style={styles.selectAllRow}>
              <Checkbox
                checked={allChecked}
                indeterminate={indeterminate}
                disabled={loading || endpoints.length === 0}
                onChange={e => handleToggleAll(e.target.checked)}
              >
                <span style={styles.selectAllLabel}>Select all endpoints</span>
              </Checkbox>
            </div>

            <div style={styles.list}>
              {endpoints.map(endpoint => {
                const key = getEndpointKey(endpoint);

                return (
                  <label key={key} style={styles.endpointRow}>
                    <Checkbox
                      checked={selectedKeys.includes(key)}
                      disabled={loading}
                      onChange={e => {
                        setSelectedKeys(prev =>
                          e.target.checked ? [...prev, key] : prev.filter(item => item !== key),
                        );
                      }}
                    />
                    <span style={{ ...styles.endpointMethod, color: METHOD_COLORS[endpoint.httpMethod] ?? 'rgba(255,255,255,0.5)' }}>
                      {endpoint.httpMethod}
                    </span>
                    <span style={styles.endpointPath}>{endpoint.path}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div style={styles.footerSeparator} />
          <div style={styles.footer}>
            <Button
              type="primary"
              icon={<ApiOutlined />}
              style={styles.btnPrimary}
              onClick={handleConfirm}
              disabled={selectedKeys.length === 0}
              loading={loading}
            >
              Add endpoints
            </Button>
            <Button
              type="text"
              style={styles.btnCancel}
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </ConfigProvider>
    </Modal>
  );
}

function getEndpointKey(endpoint: EndpointSyncItem) {
  return `${endpoint.httpMethod}:${endpoint.path}`;
}

const METHOD_COLORS: Record<string, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
};

const styles: Record<string, CSSProperties> = {
  modalTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.85)',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
  },
  sectionBody: {
    padding: '0 20px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 1.5,
    color: 'rgba(255,255,255,0.75)',
  },
  selectAllRow: {
    padding: '4px 0 6px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  selectAllLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: 500,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: 320,
    overflowY: 'auto',
  },
  endpointRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    borderRadius: 6,
    background: 'rgba(255,255,255,0.03)',
    cursor: 'pointer',
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
    color: 'rgba(255,255,255,0.65)',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
  },
  footerSeparator: {
    height: 1,
    background: 'rgba(255,255,255,0.06)',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '14px 20px',
  },
  btnPrimary: {
    boxShadow: 'none',
  },
  btnCancel: {
    color: 'rgba(255,255,255,0.45)',
    border: '1px solid rgba(255,255,255,0.45)',
  },
};
