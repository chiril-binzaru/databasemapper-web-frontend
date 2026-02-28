import { useState } from 'react';
import { Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import NewConnectionModal from './NewConnectionModal';

export default function ConnectionsPanel() {
  const [modalOpen, setModalOpen] = useState(false);

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
            New Connection
          </Button>
        </div>

        <div style={styles.empty}>
          <span style={styles.emptyText}>No database connections configured</span>
        </div>
      </div>

      <NewConnectionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
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
};
