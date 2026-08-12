import { MinusOutlined, PlusOutlined } from '@ant-design/icons';
import PinIcon from '../assets/pin_icon.svg?react';
import { Tooltip, Typography } from 'antd';
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { PanelType } from '../types/panel';
import ServicesPanel from './ServicesPanel';
import SettingsPanel from './SettingsPanel';
import NewServiceModal from './NewServiceModal';
import { useQueryClient } from '@tanstack/react-query';
import type { EndpointMappingTab } from '../services/endpointsApi';

interface AppSidePanelProps {
  panel: PanelType;
  hidden?: boolean;
  pinned: boolean;
  width: number;
  onClose: () => void;
  onTogglePin: () => void;
  onOpenMapping: (mapping: EndpointMappingTab) => void;
  onResize: (nextWidth: number) => void;
}

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
          color: active ? 'var(--accent)' : 'var(--text-tertiary)',
          background: active
            ? 'var(--accent-subtle)'
            : hovered
            ? 'var(--bg-subtle)'
            : 'transparent',
        }}
      >
        {children}
      </div>
    </Tooltip>
  );
}

const MIN_PANEL_WIDTH = 420;
const MAX_PANEL_WIDTH = 920;

export default function AppSidePanel({
  panel,
  hidden = false,
  pinned,
  width,
  onClose,
  onTogglePin,
  onOpenMapping,
  onResize,
}: AppSidePanelProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const nextWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, event.clientX));
      onResize(nextWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onResize]);

  if (!panel) return null;

  return (
    <>
      <div
        style={{
          ...(pinned ? styles.panelPinned : styles.panelFloat),
          width,
          ...(hidden ? { display: 'none' } : null),
        }}
      >
        <div style={styles.header}>
          <Typography.Text style={styles.title}>
            {panel === 'settings' ? 'Settings' : 'Services'}
          </Typography.Text>
          <div style={styles.actions}>
            {panel === 'services' && (
              <ActionBtn tooltip="Add Service" onClick={() => setAddModalOpen(true)}>
                <PlusOutlined />
              </ActionBtn>
            )}
            <ActionBtn tooltip={pinned ? 'Unpin' : 'Pin'} active={pinned} onClick={onTogglePin}>
              <PinIcon width={20} height={20} />
            </ActionBtn>
            <ActionBtn tooltip="Hide" onClick={onClose}>
              <MinusOutlined />
            </ActionBtn>
          </div>
        </div>
        <div style={styles.content}>
          {panel === 'settings' ? (
            <SettingsPanel />
          ) : (
            <ServicesPanel onOpenMapping={onOpenMapping} />
          )}
        </div>
        <div
          style={styles.resizeHandle}
          onMouseDown={event => {
            event.preventDefault();
            setIsResizing(true);
          }}
        />
      </div>

      <NewServiceModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdd={(services) => queryClient.setQueryData(['services'], services)}
      />
    </>
  );
}

const base: CSSProperties = {
  background: 'var(--bg-surface)',
  borderRight: '1px solid var(--border-subtle)',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
};

const styles: Record<string, CSSProperties> = {
  panelFloat: {
    ...base,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 10,
    boxShadow: 'var(--shadow-lg)',
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
    padding: '0 var(--sp-4)',
    borderBottom: '1px solid var(--border-subtle)',
    flexShrink: 0,
  },
  title: {
    font: 'var(--text-lg)',
    color: 'var(--text-primary)',
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
    borderRadius: 'var(--r-xs)',
    fontSize: 20,
    transition: 'background 0.15s, color 0.15s',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
  },
  resizeHandle: {
    position: 'absolute',
    top: 0,
    right: -3,
    width: 7,
    bottom: 0,
    cursor: 'ew-resize',
    zIndex: 20,
  },
};
