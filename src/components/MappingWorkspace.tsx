import { Typography } from 'antd';
import type { CSSProperties } from 'react';

export default function MappingWorkspace() {
  return (
    <div style={styles.root}>
      <Typography.Text style={styles.text}>
        No mapping is currently open. Select one from the Mappings panel.
      </Typography.Text>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 14,
  },
};
