import { useEffect, useState } from 'react';
import { App, Modal, Radio, Select, Input, Button, ConfigProvider } from 'antd';
import { ApiOutlined, LinkOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import PostgresIcon from '../assets/db/postgresql_icon.svg?react';
import MySQLIcon from '../assets/db/mysql_icon.svg?react';
import OracleIcon from '../assets/db/oracle_icon.svg?react';
import MSSQLIcon from '../assets/db/microsoftsql_icon.svg?react';
import { connectDatabaseConnection, createDatabaseConnection, testDatabaseConnection } from '../services/connectionsApi';
import type { ConnectionItem, CreateConnectionRequest } from '../services/connectionsApi';
import type { DatabaseResponse } from '../services/databaseApi';

type ConnectionMode = 'form' | 'string';

const dbOptionStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  overflow: 'hidden',
};

const dbIconStyle: CSSProperties = {
  width: 16,
  height: 16,
  flexShrink: 0,
  overflow: 'hidden',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function DbIcon({ icon: Icon }: { icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }) {
  return (
    <span style={dbIconStyle}>
      <Icon width={16} height={16} />
    </span>
  );
}

const DB_OPTIONS = [
  { value: 'mssql',    label: 'Microsoft SQL Server', icon: MSSQLIcon },
  { value: 'mysql',    label: 'MySQL',                icon: MySQLIcon },
  { value: 'oracle',   label: 'Oracle',               icon: OracleIcon },
  { value: 'postgres', label: 'PostgreSQL',           icon: PostgresIcon },
];

interface NewConnectionModalProps {
  open: boolean;
  database: DatabaseResponse;
  onClose: () => void;
  onAdd: (connection: ConnectionItem) => void;
}

const DATABASE_TYPE_TO_OPTION: Record<DatabaseResponse['databaseType'], string> = {
  SQL_SERVER: 'mssql',
  MYSQL: 'mysql',
  ORACLE: 'oracle',
  POSTGRESQL: 'postgres',
};

export default function NewConnectionModal({ open, database, onClose, onAdd }: NewConnectionModalProps) {
  const { message } = App.useApp();
  const [mode, setMode] = useState<ConnectionMode>('form');
  const [port, setPort] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [connectionString, setConnectionString] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createAndConnectLoading, setCreateAndConnectLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setMode('form');
    setPort('');
    setUsername('');
    setPassword('');
    setConnectionString('');
    setCreateLoading(false);
    setCreateAndConnectLoading(false);
    setTestLoading(false);
    setError(null);
  };

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open]);

  const handleCancel = () => {
    if (createLoading || createAndConnectLoading || testLoading) {
      return;
    }

    reset();
    onClose();
  };

  const getPayload = (): CreateConnectionRequest | null => {
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    const trimmedConnectionString = connectionString.trim();
    const parsedPort = Number(port);

    if (mode === 'form' && (!port.trim() || Number.isNaN(parsedPort) || !trimmedUsername || !trimmedPassword)) {
      setError('Port, username and password are required for Parameters mode.');
      return null;
    }

    if (mode === 'string' && !trimmedConnectionString) {
      setError('Connection string is required for Connection String mode.');
      return null;
    }

    return mode === 'form'
      ? {
          connectionMode: 'PARAMETERS',
          port: parsedPort,
          username: trimmedUsername,
          password: trimmedPassword,
        }
      : {
          connectionMode: 'CONNECTION_STRING',
          connectionString: trimmedConnectionString,
        };
  };

  const handleCreate = async () => {
    const payload = getPayload();
    if (!payload) {
      return;
    }

    setCreateLoading(true);
    setError(null);

    try {
      const connection = await createDatabaseConnection(database.databaseId, payload);

      onAdd(connection);
      reset();
      onClose();
    } catch {
      setError('Failed to create connection. Check that the server is running and the payload is valid.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCreateAndConnect = async () => {
    const payload = getPayload();
    if (!payload) {
      return;
    }

    setCreateAndConnectLoading(true);
    setError(null);

    try {
      const createdConnection = await createDatabaseConnection(database.databaseId, payload);

      try {
        const connectedConnection = await connectDatabaseConnection(
          database.databaseId,
          createdConnection.connectionId,
        );

        onAdd(connectedConnection);
        reset();
        onClose();
      } catch {
        onAdd(createdConnection);
        setError('Connection created but system failed to connect.');
      }
    } catch {
      setError('Failed to create connection. Check that the server is running and the payload is valid.');
    } finally {
      setCreateAndConnectLoading(false);
    }
  };

  const handleTest = async () => {
    const payload = getPayload();
    if (!payload) {
      return;
    }

    setTestLoading(true);
    setError(null);

    try {
      await testDatabaseConnection(database.databaseId, payload);
      message.success('Connection test passed.');
    } catch {
      setError('Connection test failed. Check the connection details and try again.');
    } finally {
      setTestLoading(false);
    }
  };

  const canSubmit = !createLoading && !createAndConnectLoading && !testLoading && (
    mode === 'form'
      ? !!port.trim() && !Number.isNaN(Number(port)) && !!username.trim() && !!password.trim()
      : !!connectionString.trim()
  );

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      title={<span style={styles.modalTitle}>New Connection</span>}
      width={660}
      centered
      footer={null}
      styles={{
        container: { padding: 0, background: 'var(--bg-surface-raised)', borderRadius: 'var(--r-md)', maxHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' },
        header: { padding: '16px 48px 12px 20px', background: 'transparent', borderBottom: 'none', marginBottom: 0, flexShrink: 0 },
        body: { padding: 0, overflowY: 'auto' },
      }}
    >
      <ConfigProvider
        componentSize="large"
        theme={{
          components: {
            Input:  { hoverBorderColor: 'var(--border-strong)', activeShadow: 'none' },
            Select: { hoverBorderColor: 'var(--border-strong)', activeOutlineColor: 'transparent' },
            Radio:  { colorBorder: 'var(--border-strong)' },
          },
        }}
      >
        <div style={styles.body}>

          {/* ── Form section ── */}
          <div style={{ ...styles.section, opacity: mode === 'form' ? 1 : 0.35 }}>
            <div style={styles.sectionHeader}>
              <Radio checked={mode === 'form'} onChange={() => setMode('form')} />
              <span style={styles.sectionTitle}>Form</span>
            </div>
            <div style={{
              ...styles.sectionBody,
              pointerEvents: mode === 'form' ? 'auto' : 'none',
            }}>
              <div style={styles.row}>
                <div style={{ ...styles.field, flex: 1 }}>
                  <label style={styles.label}>Database Type</label>
                  <Select
                    value={DATABASE_TYPE_TO_OPTION[database.databaseType]}
                    style={{ width: '100%' }}
                    options={DB_OPTIONS}
                    disabled
                    popupMatchSelectWidth
                    optionRender={(option) => (
                      <span style={dbOptionStyle}>
                        <DbIcon icon={(option.data as typeof DB_OPTIONS[number]).icon} />
                        {option.label}
                      </span>
                    )}
                    labelRender={(props) => {
                      const option = DB_OPTIONS.find(o => o.value === props.value);
                      if (!option) return <>{props.label}</>;
                      return (
                        <span style={dbOptionStyle}>
                          <DbIcon icon={option.icon} />
                          {option.label}
                        </span>
                      );
                    }}
                  />
                </div>
                <div style={{ ...styles.field, width: 90 }}>
                  <label style={styles.label}>Port</label>
                  <Input
                    value={port}
                    onChange={e => setPort(e.target.value)}
                    inputMode="numeric"
                    disabled={mode !== 'form' || createLoading || createAndConnectLoading || testLoading}
                  />
                </div>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Host</label>
                <Input value={database.databaseHost} disabled />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Database Name</label>
                <Input value={database.databaseName} disabled />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Username</label>
                <Input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  disabled={mode !== 'form' || createLoading || createAndConnectLoading || testLoading}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Password</label>
                <Input.Password
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={mode !== 'form' || createLoading || createAndConnectLoading || testLoading}
                />
              </div>
            </div>
          </div>

          <div style={styles.divider} />

          {/* ── Connection String section ── */}
          <div style={{ ...styles.section, opacity: mode === 'string' ? 1 : 0.35 }}>
            <div style={styles.sectionHeader}>
              <Radio checked={mode === 'string'} onChange={() => setMode('string')} />
              <span style={styles.sectionTitle}>Connection String</span>
            </div>
            <div style={{
              ...styles.sectionBody,
              pointerEvents: mode === 'string' ? 'auto' : 'none',
            }}>
              <div style={styles.field}>
                <label style={styles.label}>Connection String</label>
                <Input.TextArea
                  value={connectionString}
                  onChange={e => setConnectionString(e.target.value)}
                  rows={3}
                  style={{ fontFamily: 'monospace', fontSize: 14, resize: 'none', overflowY: 'auto' }}
                  disabled={mode !== 'string' || createLoading || createAndConnectLoading || testLoading}
                />
              </div>
            </div>
          </div>

          {error && <div style={styles.errorText}>{error}</div>}

          {/* ── Footer ── */}
          <div style={styles.footerSeparator} />
          <div style={styles.footer}>
            <Button
              type="text"
              icon={<ApiOutlined />}
              style={styles.btnTest}
              onClick={() => void handleTest()}
              disabled={!canSubmit}
              loading={testLoading}
            >
              Test Connection
            </Button>
            <Button
              type="primary"
              style={styles.btnPrimary}
              onClick={() => void handleCreate()}
              disabled={!canSubmit}
              loading={createLoading}
            >
              Create
            </Button>
            <Button
              type="primary"
              icon={<LinkOutlined />}
              style={styles.btnPrimary}
              onClick={() => void handleCreateAndConnect()}
              disabled={!canSubmit}
              loading={createAndConnectLoading}
            >
              Create and Connect
            </Button>
            <Button
              type="text"
              style={styles.btnCancel}
              onClick={handleCancel}
              disabled={createLoading || createAndConnectLoading || testLoading}
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
    font: 'var(--text-lg)',
    color: 'var(--text-primary)',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
  },
  section: {
    transition: 'opacity 0.2s ease',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 20px 8px',
  },
  sectionTitle: {
    font: 'var(--text-xs)',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
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
  row: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-end',
  },
  divider: {
    height: 1,
    background: 'var(--border-default)',
    margin: '4px 20px',
  },
  errorText: {
    font: 'var(--text-sm)',
    color: 'var(--status-critical)',
    padding: '0 20px 12px',
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
  btnTest: {
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-strong)',
  },
  btnPrimary: {
    boxShadow: 'none',
  },
  btnCancel: {
    color: 'var(--text-tertiary)',
    border: '1px solid var(--border-strong)',
  },
};
