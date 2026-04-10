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
      const response = await createEndpoint({
        serviceId,
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
            Select: { hoverBorderColor: '#424242' },
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
