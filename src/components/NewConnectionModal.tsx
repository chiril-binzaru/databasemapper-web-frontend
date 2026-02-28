import { useState } from 'react';
import { Modal, Radio, Select, Input, Button, ConfigProvider } from 'antd';
import { ApiOutlined, LinkOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import PostgresIcon from '../assets/db/postgresql_icon.svg?react';
import MySQLIcon from '../assets/db/mysql_icon.svg?react';
import OracleIcon from '../assets/db/oracle_icon.svg?react';
import MSSQLIcon from '../assets/db/microsoftsql_icon.svg?react';

type ConnectionMode = 'form' | 'string';

const dbOptionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
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
  {
    value: 'mssql',
    label: <span style={dbOptionStyle}><DbIcon icon={MSSQLIcon} />Microsoft SQL Server</span>,
  },
  {
    value: 'mysql',
    label: <span style={dbOptionStyle}><DbIcon icon={MySQLIcon} />MySQL</span>,
  },
  {
    value: 'oracle',
    label: <span style={dbOptionStyle}><DbIcon icon={OracleIcon} />Oracle</span>,
  },
  {
    value: 'postgres',
    label: <span style={dbOptionStyle}><DbIcon icon={PostgresIcon} />PostgreSQL</span>,
  },
];

interface NewConnectionModalProps {
  open: boolean;
  onClose: () => void;
}

export default function NewConnectionModal({ open, onClose }: NewConnectionModalProps) {
  const [mode, setMode] = useState<ConnectionMode>('form');

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={<span style={styles.modalTitle}>New Connection</span>}
      width={660}
      centered
      footer={null}
      styles={{
        container: { padding: 0, background: '#2b2b2b', borderRadius: 8, maxHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' },
        header: { padding: '16px 48px 12px 20px', background: 'transparent', borderBottom: 'none', marginBottom: 0, flexShrink: 0 },
        body: { padding: 0, overflowY: 'auto' },
      }}
    >
      <ConfigProvider theme={{
        components: {
          Input:  { hoverBorderColor: '#424242', activeShadow: 'none' },
          Select: { hoverBorderColor: '#424242', activeOutlineColor: 'transparent' },
          Radio:  { colorBorder: 'white' },
        },
      }}>
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
                    style={{ width: '100%' }}
                    options={DB_OPTIONS}
                    popupMatchSelectWidth
                  />
                </div>
                <div style={{ ...styles.field, width: 90 }}>
                  <label style={styles.label}>Port</label>
                  <Input />
                </div>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Host</label>
                <Input />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Database Name</label>
                <Input />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Username</label>
                <Input />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Password</label>
                <Input.Password />
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
                  autoSize={{ minRows: 3, maxRows: 6 }}
                  style={{ fontFamily: 'monospace', fontSize: 12, resize: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div style={styles.footerSeparator} />
          <div style={styles.footer}>
            <Button
              type="text"
              icon={<ApiOutlined />}
              style={styles.btnTest}
              onClick={() => {}}
            >
              Test Connection
            </Button>
            <Button
              type="primary"
              icon={<LinkOutlined />}
              style={styles.btnPrimary}
              onClick={() => {}}
            >
              Connect
            </Button>
            <Button type="text" style={styles.btnCancel} onClick={onClose}>
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
    fontSize: 15,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.85)',
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
    fontSize: 12,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.65)',
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
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
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
    background: '#3a3a3a',
    margin: '4px 20px',
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
  btnTest: {
    color: 'rgba(255,255,255,0.5)',
    border: '1px solid rgba(255,255,255,0.5)',
  },
  btnPrimary: {
    boxShadow: 'none',
  },
  btnCancel: {
    color: 'rgba(255,255,255,0.45)',
    border: '1px solid rgba(255,255,255,0.45)',
  },
};
