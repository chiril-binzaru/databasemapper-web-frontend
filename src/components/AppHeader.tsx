import { Tag, Space, Typography } from 'antd';
import { NodeIndexOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import DbIcon from '../assets/db_icon.svg?react';
import SwaggerIcon from '../assets/swagger_icon.svg?react';

interface AppHeaderProps {
  currentMapping?: string;
  currentConnection?: string;
  currentSwagger?: string;
}

export default function AppHeader({ currentMapping, currentConnection, currentSwagger }: AppHeaderProps) {
  return (
    <div style={styles.header}>
      <Space size={32}>
        <Space size={8}>
          <NodeIndexOutlined style={styles.icon} />
          <Typography.Text style={styles.label}>Mapping:</Typography.Text>
          {currentMapping
            ? <Tag color="purple" style={styles.tag}>{currentMapping}</Tag>
            : <Typography.Text style={styles.empty}>—</Typography.Text>
          }
        </Space>

        <Space size={8}>
          <DbIcon width={17} height={17} style={styles.icon} />
          <Typography.Text style={styles.label}>Connection:</Typography.Text>
          {currentConnection
            ? <Tag color="blue" style={styles.tag}>{currentConnection}</Tag>
            : <Typography.Text style={styles.empty}>—</Typography.Text>
          }
        </Space>

        <Space size={8}>
          <SwaggerIcon width={17} height={17} style={styles.icon} />
          <Typography.Text style={styles.label}>Swagger:</Typography.Text>
          {currentSwagger
            ? <Tag color="cyan" style={styles.tag}>{currentSwagger}</Tag>
            : <Typography.Text style={styles.empty}>—</Typography.Text>
          }
        </Space>
      </Space>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  header: {
    height: 48,
    flexShrink: 0,
    background: '#1a1a1a',
    borderBottom: '1px solid #2a2a2a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 17,
  },
  label: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 15,
  },
  tag: {
    fontSize: 14,
    lineHeight: '24px',
    padding: '0 10px',
  },
  empty: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 15,
  },
};
