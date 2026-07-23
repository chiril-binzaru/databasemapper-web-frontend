import { useState } from 'react';
import { Modal, Input, Button, ConfigProvider, Dropdown } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import { updateService } from '../services/servicesApi';
import type { ServiceResponse } from '../services/servicesApi';

const SWAGGER_ENDPOINTS = [
  '/v3/api-docs',
  '/v2/api-docs',
  '/swagger.json',
  '/swagger.yaml',
  '/openapi.json',
  '/openapi.yaml',
];

interface EditServiceModalProps {
  open: boolean;
  service: ServiceResponse;
  onClose: () => void;
  onSave: (service: ServiceResponse) => void;
}

export default function EditServiceModal({ open, service, onClose, onSave }: EditServiceModalProps) {
  const [baseUrl, setBaseUrl] = useState(service.serviceBaseUrl);
  const [serviceName, setServiceName] = useState(service.serviceName);
  const [swaggerEndpoint, setSwaggerEndpoint] = useState(service.swaggerEndpoint ?? '');
  const [swaggerDropdownOpen, setSwaggerDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!baseUrl.trim() || !serviceName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const trimmedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
      const trimmedEndpoint = swaggerEndpoint.trim();
      const normalizedEndpoint = trimmedEndpoint
        ? trimmedEndpoint.startsWith('/')
          ? trimmedEndpoint
          : `/${trimmedEndpoint}`
        : undefined;
      const updated = await updateService(service.serviceId, {
        serviceName: serviceName.trim(),
        serviceBaseUrl: trimmedBaseUrl,
        databaseId: service.databaseId ?? undefined,
        swaggerEndpoint: normalizedEndpoint,
      });
      onSave(updated);
      onClose();
    } catch {
      setError('Failed to save service. Check that the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setError(null);
    onClose();
  };

  const baseUrlTrimmed = baseUrl.trim();
  const baseUrlInvalid = !!baseUrlTrimmed && !/^https?:\/\//.test(baseUrlTrimmed);
  const canSave = !!baseUrlTrimmed && !baseUrlInvalid && !!serviceName.trim() && !loading;

  const filteredEndpoints = SWAGGER_ENDPOINTS.filter(ep =>
    !swaggerEndpoint || ep.toLowerCase().includes(swaggerEndpoint.toLowerCase())
  );

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      title={<span style={styles.modalTitle}>Edit Service</span>}
      width={520}
      centered
      footer={null}
      styles={{
        container: { padding: 0, background: 'var(--bg-surface-raised)', borderRadius: 'var(--r-md)' },
        header: { padding: '16px 48px 12px 20px', background: 'transparent', borderBottom: 'none', marginBottom: 0 },
        body: { padding: 0 },
      }}
    >
      <ConfigProvider
        componentSize="large"
        theme={{
          components: {
            Input: { hoverBorderColor: 'var(--border-strong)', activeShadow: 'none' },
          },
        }}
      >
        <div style={styles.body}>
          <div style={styles.sectionBody}>

            <div style={styles.field}>
              <label style={styles.label}>Base URL</label>
              <Input
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
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
                onChange={e => setServiceName(e.target.value)}
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
                  onPressEnter={handleSave}
                />
              </Dropdown>
            </div>

            {error && <span style={styles.errorText}>{error}</span>}

          </div>

          <div style={styles.footerSeparator} />
          <div style={styles.footer}>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              style={styles.btnPrimary}
              onClick={handleSave}
              disabled={!canSave}
              loading={loading}
            >
              Save Changes
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
    font: 'var(--text-2xl)',
    color: 'var(--text-primary)',
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
    font: 'var(--text-sm)',
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    userSelect: 'none',
  },
  errorText: {
    font: 'var(--text-sm)',
    color: 'var(--status-critical)',
  },
  optional: {
    textTransform: 'none',
    letterSpacing: 0,
    color: 'var(--text-disabled)',
    fontWeight: 400,
  },
  footerSeparator: {
    height: 1,
    background: 'var(--border-subtle)',
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
    color: 'var(--text-tertiary)',
    border: '1px solid var(--border-strong)',
  },
};
