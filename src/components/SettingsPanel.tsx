import { Segmented, Typography } from 'antd';
import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import { useThemeMode } from '../hooks/useThemeMode';

export default function SettingsPanel() {
  const { mode, setMode } = useThemeMode();

  return (
    <div style={styles.container}>
      <div style={styles.group}>
        <Typography.Text style={styles.groupTitle}>Appearance</Typography.Text>
        <div style={styles.row}>
          <span style={styles.rowLabel}>Theme</span>
          <Segmented
            value={mode}
            onChange={value => setMode(value as 'light' | 'dark')}
            options={[
              { value: 'light', icon: <SunOutlined />, label: 'Light' },
              { value: 'dark', icon: <MoonOutlined />, label: 'Dark' },
            ]}
          />
        </div>
        <span style={styles.hint}>
          Applies immediately across the workspace. Your choice is remembered on this device.
        </span>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    padding: 'var(--sp-4)',
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--sp-3)',
  },
  groupTitle: {
    font: 'var(--text-xs)',
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--sp-3)',
  },
  rowLabel: {
    font: 'var(--text-base-md)',
    color: 'var(--text-primary)',
  },
  hint: {
    font: 'var(--text-sm)',
    color: 'var(--text-tertiary)',
  },
};
