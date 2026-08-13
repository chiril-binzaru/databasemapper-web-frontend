import { useState } from 'react';
import { Modal, Input, Button, Select, ConfigProvider } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';
import axios from 'axios';
import type { CSSProperties } from 'react';
import PostgresIcon from '../assets/db/postgresql_icon.svg?react';
import MySQLIcon from '../assets/db/mysql_icon.svg?react';
import OracleIcon from '../assets/db/oracle_icon.svg?react';
import MSSQLIcon from '../assets/db/microsoftsql_icon.svg?react';
import { createServiceDatabase } from '../services/databaseApi';
import type { DatabaseResponse } from '../services/databaseApi';

const DATABASE_TYPES = [
  { value: 'SQL_SERVER', label: 'Microsoft SQL Server', icon: MSSQLIcon },
  { value: 'MYSQL', label: 'MySQL', icon: MySQLIcon },
  { value: 'ORACLE', label: 'Oracle', icon: OracleIcon },
  { value: 'POSTGRESQL', label: 'PostgreSQL', icon: PostgresIcon },
] as const;

type DatabaseType = DatabaseResponse['databaseType'];

const dbOptionStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  overflow: 'hidden',
};

function DbIcon({ icon: Icon }: { icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }) {
  return (
    <span style={styles.dbIcon}>
      <Icon width={16} height={16} />
    </span>
  );
}

interface NewDatabaseModalProps {
  open: boolean;
  serviceId: number;
  onClose: () => void;
  onAdd: (database: DatabaseResponse) => void;
}

export default function NewDatabaseModal({ open, serviceId, onClose, onAdd }: NewDatabaseModalProps) {
  const [databaseType, setDatabaseType] = useState<DatabaseType>('POSTGRESQL');
  const [databaseName, setDatabaseName] = useState('');
  const [databaseHost, setDatabaseHost] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setDatabaseType('POSTGRESQL');
    setDatabaseName('');
    setDatabaseHost('');
    setError(null);
  };

  const handleAdd = async () => {
    if (!databaseName.trim() || !databaseHost.trim()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const database = await createServiceDatabase(serviceId, {
        databaseType,
        databaseName: databaseName.trim(),
        databaseHost: databaseHost.trim(),
      });
      onAdd(database);
      reset();
      onClose();
    } catch (caught) {
      // A service holds at most one database, so a second assignment is
      // rejected rather than replacing the existing one.
      setError(
        axios.isAxiosError(caught) && caught.response?.status === 409
          ? 'This service already has a database assigned.'
          : 'Failed to add database. Check that the server is running.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    reset();
    onClose();
  };

  const canAdd = !!databaseName.trim() && !!databaseHost.trim() && !loading;

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      title={<span style={styles.modalTitle}>Add Database</span>}
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
              <label style={styles.label}>Database Type</label>
              <Select
                value={databaseType}
                onChange={setDatabaseType}
                options={DATABASE_TYPES.map(({ value, label }) => ({ value, label }))}
                style={{ width: '100%' }}
                popupMatchSelectWidth
                disabled={loading}
                optionRender={option => {
                  const type = DATABASE_TYPES.find(t => t.value === option.value);
                  return (
                    <span style={dbOptionStyle}>
                      {type && <DbIcon icon={type.icon} />}
                      {option.label}
                    </span>
                  );
                }}
                labelRender={props => {
                  const type = DATABASE_TYPES.find(t => t.value === props.value);
                  if (!type) {
                    return <>{props.label}</>;
                  }
                  return (
                    <span style={dbOptionStyle}>
                      <DbIcon icon={type.icon} />
                      {type.label}
                    </span>
                  );
                }}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Database Name</label>
              <Input
                value={databaseName}
                onChange={e => setDatabaseName(e.target.value)}
                placeholder="petclinic"
                onPressEnter={handleAdd}
                disabled={loading}
                autoFocus
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Host</label>
              <Input
                value={databaseHost}
                onChange={e => setDatabaseHost(e.target.value)}
                placeholder="localhost:5432"
                onPressEnter={handleAdd}
                disabled={loading}
              />
            </div>

            {error && <span style={styles.errorText}>{error}</span>}

          </div>

          <div style={styles.footerSeparator} />
          <div style={styles.footer}>
            <Button
              type="primary"
              icon={<DatabaseOutlined />}
              style={styles.btnPrimary}
              onClick={handleAdd}
              disabled={!canAdd}
              loading={loading}
            >
              Add Database
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
  dbIcon: {
    width: 16,
    height: 16,
    flexShrink: 0,
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
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
