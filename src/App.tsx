import { useState } from 'react';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppSidebar from './components/AppSidebar';
import AppSidePanel from './components/AppSidePanel';
import AppHeader from './components/AppHeader';
import MappingWorkspace from './components/MappingWorkspace';
import type { PanelType } from './types/panel';
import type { CSSProperties } from 'react';

function AppLayout() {
  const [openPanel, setOpenPanel] = useState<PanelType>(null);
  const [pinned, setPinned] = useState(false);

  const handleToggle = (panel: NonNullable<PanelType>) => {
    setOpenPanel(prev => (prev === panel ? null : panel));
  };

  const handleClose = () => {
    setOpenPanel(null);
    setPinned(false);
  };

  return (
    <div style={styles.root}>
      <AppSidebar activePanel={openPanel} onToggle={handleToggle} />
      <div style={styles.workspace}>
        {openPanel && (
          <AppSidePanel
            panel={openPanel}
            pinned={pinned}
            onClose={handleClose}
            onTogglePin={() => setPinned(p => !p)}
          />
        )}
        <div style={styles.main}>
          <AppHeader currentMapping={undefined} currentConnection={undefined} currentSwagger={undefined} />
          <MappingWorkspace />
        </div>
      </div>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 5 minutes — no refetch on panel re-open within that window
      staleTime: 5 * 60 * 1000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
        <AntApp>
          <AppLayout />
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    background: '#141414',
  },
  workspace: {
    flex: 1,
    display: 'flex',
    position: 'relative',
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
  },
};
