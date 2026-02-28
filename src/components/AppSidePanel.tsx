import { MinusOutlined } from '@ant-design/icons';
import PinIcon from '../assets/pin_icon.svg?react';
import { Tooltip, Typography } from 'antd';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { PanelType } from '../types/panel';
import ConnectionsPanel from './ConnectionsPanel';

interface AppSidePanelProps {
  panel: PanelType;
  pinned: boolean;
  onClose: () => void;
  onTogglePin: () => void;
}

const PANEL_TITLES: Record<NonNullable<PanelType>, string> = {
  mappings: 'Mappings',
  connections: 'Connections',
  swagger: 'Swaggers',
};

const PANEL_PLACEHOLDERS: Record<'mappings' | 'swagger', string> = {
  mappings: 'No mappings created yet',
  swagger: 'No Swagger spec loaded',
};

interface ActionBtnProps {
  tooltip: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function ActionBtn({ tooltip, active, onClick, children }: ActionBtnProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <Tooltip title={tooltip} placement="bottom">
      <div
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          ...styles.actionBtn,
          color: active ? '#4096ff' : 'rgba(255,255,255,0.45)',
          background: active
            ? 'rgba(64,150,255,0.15)'
            : hovered
            ? 'rgba(255,255,255,0.08)'
            : 'transparent',
        }}
      >
        {children}
      </div>
    </Tooltip>
  );
}

function PanelContent({ panel }: { panel: NonNullable<PanelType> }) {
  if (panel === 'connections') {
    return <ConnectionsPanel />;
  }
  return (
    <div style={styles.placeholderWrap}>
      <Typography.Text style={styles.placeholder}>
        {PANEL_PLACEHOLDERS[panel]}
      </Typography.Text>
    </div>
  );
}

export default function AppSidePanel({ panel, pinned, onClose, onTogglePin }: AppSidePanelProps) {
  if (!panel) return null;

  return (
    <div style={pinned ? styles.panelPinned : styles.panelFloat}>
      <div style={styles.header}>
        <Typography.Text style={styles.title}>{PANEL_TITLES[panel]}</Typography.Text>
        <div style={styles.actions}>
          <ActionBtn tooltip={pinned ? 'Unpin' : 'Pin'} active={pinned} onClick={onTogglePin}>
            <PinIcon width={20} height={20} />
          </ActionBtn>
          <ActionBtn tooltip="Hide" onClick={onClose}>
            <MinusOutlined />
          </ActionBtn>
        </div>
      </div>
      <div style={styles.content}>
        <PanelContent panel={panel} />
      </div>
    </div>
  );
}

const base: CSSProperties = {
  width: 576,
  background: '#1f1f1f',
  borderRight: '1px solid #2a2a2a',
  display: 'flex',
  flexDirection: 'column',
};

const styles: Record<string, CSSProperties> = {
  panelFloat: {
    ...base,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 10,
    boxShadow: '4px 0 16px rgba(0,0,0,0.5)',
  },
  panelPinned: {
    ...base,
    flexShrink: 0,
    position: 'relative',
  },
  header: {
    height: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    borderBottom: '1px solid #2a2a2a',
    flexShrink: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.75)',
  },
  actions: {
    display: 'flex',
    gap: 4,
  },
  actionBtn: {
    width: 34,
    height: 34,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    borderRadius: 4,
    fontSize: 20,
    transition: 'background 0.15s, color 0.15s',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
  },
  placeholderWrap: {
    padding: 16,
  },
  placeholder: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.2)',
  },
};
