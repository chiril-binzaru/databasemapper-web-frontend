import { Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';

export default function ConnectionsPanel() {
  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <Button
          type="text"
          icon={<PlusOutlined />}
          size="small"
          style={{ color: 'var(--text-secondary)' }}
          disabled
        >
          New Connection
        </Button>
      </div>

      <div style={styles.empty}>
        <span style={styles.emptyText}>No database connections configured</span>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  toolbar: {
    padding: 'var(--sp-3) var(--sp-4)',
    borderBottom: '1px solid var(--border-subtle)',
    flexShrink: 0,
  },
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    font: 'var(--text-sm)',
    color: 'var(--text-disabled)',
  },
};
