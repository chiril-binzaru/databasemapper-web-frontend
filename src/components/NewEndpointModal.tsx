import { useState } from 'react';
import { Modal, Input, Button, Select, ConfigProvider } from 'antd';
import { ApiOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import { createEndpoint } from '../services/endpointsApi';
import type { EndpointItem } from '../services/endpointsApi';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

interface NewEndpointModalProps {
  open: boolean;
  serviceId: number;
  onClose: () => void;
  onAdd: (endpoints: EndpointItem[]) => void;
}

export default function NewEndpointModal({ open, serviceId, onClose, onAdd }: NewEndpointModalProps) {
  const [httpMethod, setHttpMethod] = useState('GET');
  const [endpointPath, setEndpointPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setHttpMethod('GET');
    setEndpointPath('');
    setError(null);
  };

  const handleAdd = async () => {
    if (!endpointPath.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await createEndpoint(serviceId, {
        httpMethod,
        endpointPath: endpointPath.trim(),
      });
      onAdd(response.endpoints);
      reset();
      onClose();
    } catch {
      setError('Failed to create endpoint. Check that the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    reset();
    onClose();
  };

  const canAdd = !!endpointPath.trim() && !loading;

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      title={<span style={styles.modalTitle}>Add Endpoint</span>}
      width={480}
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
            Select: { hoverBorderColor: 'var(--border-strong)' },
          },
        }}
      >
        <div style={styles.body}>
          <div style={styles.sectionBody}>

            <div style={styles.field}>
              <label style={styles.label}>HTTP Method</label>
              <Select
                value={httpMethod}
                onChange={setHttpMethod}
                options={HTTP_METHODS.map(m => ({ value: m, label: m }))}
                style={{ width: '100%' }}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Endpoint Path</label>
              <Input
                value={endpointPath}
                onChange={e => setEndpointPath(e.target.value)}
                placeholder="/api/users"
                onPressEnter={handleAdd}
                autoFocus
              />
            </div>

            {error && <span style={styles.errorText}>{error}</span>}

          </div>

          <div style={styles.footerSeparator} />
          <div style={styles.footer}>
            <Button
              type="primary"
              icon={<ApiOutlined />}
              style={styles.btnPrimary}
              onClick={handleAdd}
              disabled={!canAdd}
              loading={loading}
            >
              Add Endpoint
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
