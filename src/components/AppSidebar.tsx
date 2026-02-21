import { Tooltip } from 'antd';
import { NodeIndexOutlined } from '@ant-design/icons';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { PanelType } from '../types/panel';
import DbIcon from '../assets/db_icon.svg?react';
import SwaggerIcon from '../assets/swagger_icon.svg?react';

interface AppSidebarProps {
  activePanel: PanelType;
  onToggle: (panel: NonNullable<PanelType>) => void;
}

const NAV_ITEMS: { key: NonNullable<PanelType>; icon: React.ReactNode; label: string }[] = [
  { key: 'mappings', icon: <NodeIndexOutlined />, label: 'Mappings' },
  { key: 'connections', icon: <DbIcon />, label: 'Connections' },
  { key: 'swagger', icon: <SwaggerIcon width={25} height={25} />, label: 'Swagger' },
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
          color: isActive ? '#4096ff' : 'rgba(255,255,255,0.45)',
          background: isActive
            ? 'rgba(64,150,255,0.15)'
            : hovered
            ? 'rgba(255,255,255,0.08)'
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
    background: '#1a1a1a',
    borderRight: '1px solid #2a2a2a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 12,
    gap: 6,
  },
  iconBtn: {
    width: 46,
    height: 46,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    borderRadius: 8,
    fontSize: 22,
    transition: 'background 0.15s, color 0.15s',
  },
};
