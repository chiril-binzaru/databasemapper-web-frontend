import { useState } from 'react';
import { Modal, Input, Button, ConfigProvider, Dropdown } from 'antd';
import { AppstoreAddOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import { createService } from '../services/servicesApi';
import type { ServiceResponse } from '../services/servicesApi';

function deriveServiceName(baseUrl: string): string {
  try {
    const { hostname } = new URL(baseUrl);
    const parts = hostname.split('.');
    const first = parts[0] === 'www' ? parts[1] : parts[0];
    return first ?? '';
  } catch {
    return '';
  }
}

const SWAGGER_ENDPOINTS = [
  '/v3/api-docs',
  '/v2/api-docs',
  '/swagger.json',
  '/swagger.yaml',
  '/openapi.json',
  '/openapi.yaml',
];

interface NewServiceModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (services: ServiceResponse[]) => void;
}

export default function NewServiceModal({ open, onClose, onAdd }: NewServiceModalProps) {
  const [baseUrl, setBaseUrl] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [serviceNameEdited, setServiceNameEdited] = useState(false);
  const [swaggerEndpoint, setSwaggerEndpoint] = useState('');
  const [swaggerDropdownOpen, setSwaggerDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBaseUrlChange = (val: string) => {
    setBaseUrl(val);
    if (!serviceNameEdited) {
      setServiceName(deriveServiceName(val));
    }
  };

  const handleServiceNameChange = (val: string) => {
    setServiceName(val);
    setServiceNameEdited(true);
  };

  const reset = () => {
    setBaseUrl('');
    setServiceName('');
    setServiceNameEdited(false);
    setSwaggerEndpoint('');
    setSwaggerDropdownOpen(false);
    setError(null);
  };

  const handleAdd = async () => {
    if (!baseUrl.trim() || !serviceName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const services = await createService({
        serviceName: serviceName.trim(),
        serviceBaseUrl: baseUrl.trim(),
        swaggerEndpoint: swaggerEndpoint.trim() || undefined,
      });
      onAdd(services);
      reset();
      onClose();
    } catch {
      setError('Failed to create service. Check that the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    reset();
    onClose();
  };

  const baseUrlTrimmed = baseUrl.trim();
  const baseUrlInvalid = !!baseUrlTrimmed && !/^https?:\/\//.test(baseUrlTrimmed);
  const canAdd = !!baseUrlTrimmed && !baseUrlInvalid && !!serviceName.trim() && !loading;

  const filteredEndpoints = SWAGGER_ENDPOINTS.filter(ep =>
    !swaggerEndpoint || ep.toLowerCase().includes(swaggerEndpoint.toLowerCase())
  );

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      title={<span style={styles.modalTitle}>Add Service</span>}
      width={520}
      centered
      footer={null}
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
            Input: { hoverBorderColor: '#424242', activeShadow: 'none' },
          },
        }}
      >
        <div style={styles.body}>
          <div style={styles.sectionBody}>

            <div style={styles.field}>
              <label style={styles.label}>Base URL</label>
              <Input
                value={baseUrl}
                onChange={e => handleBaseUrlChange(e.target.value)}
                status={baseUrlInvalid ? 'error' : undefined}
                autoFocus
              />
              {baseUrlInvalid && (
                <span style={styles.errorText}>Must start with http:// or https://</span>
              )}
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Service Name</label>
              <Input
                value={serviceName}
                onChange={e => handleServiceNameChange(e.target.value)}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                Swagger Endpoint
                <span style={styles.optional}> — optional</span>
              </label>
              <Dropdown
                open={swaggerDropdownOpen && filteredEndpoints.length > 0}
                menu={{
                  items: filteredEndpoints.map(ep => ({ key: ep, label: ep })),
                  onClick: ({ key }) => {
                    setSwaggerEndpoint(key);
                    setSwaggerDropdownOpen(false);
                  },
                }}
                trigger={[]}
              >
                <Input
                  value={swaggerEndpoint}
                  onChange={e => {
                    setSwaggerEndpoint(e.target.value);
                    setSwaggerDropdownOpen(true);
                  }}
                  onFocus={() => setSwaggerDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setSwaggerDropdownOpen(false), 150)}
                  onPressEnter={handleAdd}
                />
              </Dropdown>
            </div>

            {error && <span style={styles.errorText}>{error}</span>}

          </div>

          <div style={styles.footerSeparator} />
          <div style={styles.footer}>
            <Button
              type="primary"
              icon={<AppstoreAddOutlined />}
              style={styles.btnPrimary}
              onClick={handleAdd}
              disabled={!canAdd}
              loading={loading}
            >
              Add Service
            </Button>
            <Button
              type="text"
              style={styles.btnCancel}
              onClick={handleCancel}
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
    gap: 10,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    userSelect: 'none',
  },
  errorText: {
    fontSize: 11,
    color: '#ff4d4f',
  },
  optional: {
    textTransform: 'none',
    letterSpacing: 0,
    color: 'rgba(255,255,255,0.2)',
    fontWeight: 400,
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
