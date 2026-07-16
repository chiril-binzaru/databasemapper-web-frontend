import { Tooltip } from 'antd';
import { AppstoreOutlined, SettingOutlined } from '@ant-design/icons';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { PanelType } from '../types/panel';

interface AppSidebarProps {
  activePanel: PanelType;
  onToggle: (panel: NonNullable<PanelType>) => void;
}

const NAV_ITEMS: { key: NonNullable<PanelType>; icon: React.ReactNode; label: string }[] = [
  { key: 'services', icon: <AppstoreOutlined />, label: 'Services' },
  { key: 'settings', icon: <SettingOutlined />, label: 'Settings' },
];

interface NavBtnProps {
  item: typeof NAV_ITEMS[number];
  isActive: boolean;
  onToggle: () => void;
}

function NavBtn({ item, isActive, onToggle }: NavBtnProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <Tooltip title={item.label} placement="right">
      <div
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          ...styles.iconBtn,
          color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
          background: isActive
            ? 'var(--accent-subtle)'
            : hovered
            ? 'var(--bg-subtle)'
            : 'transparent',
        }}
      >
        {item.icon}
      </div>
    </Tooltip>
  );
}

export default function AppSidebar({ activePanel, onToggle }: AppSidebarProps) {
  return (
    <div style={styles.sidebar}>
      {NAV_ITEMS.map(item => (
        <NavBtn
          key={item.key}
          item={item}
          isActive={activePanel === item.key}
          onToggle={() => onToggle(item.key)}
        />
      ))}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  sidebar: {
    width: 64,
    flexShrink: 0,
    background: 'var(--bg-surface)',
    borderRight: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 'var(--sp-3)',
    gap: 6,
  },
  iconBtn: {
    width: 46,
    height: 46,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    borderRadius: 'var(--r-md)',
    fontSize: 22,
    transition: 'background 0.15s, color 0.15s',
  },
};
