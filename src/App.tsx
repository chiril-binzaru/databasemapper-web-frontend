import { useState } from 'react';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppSidebar from './components/AppSidebar';
import AppSidePanel from './components/AppSidePanel';
import MappingWorkspace from './components/MappingWorkspace';
import type { PanelType } from './types/panel';
import type { CSSProperties } from 'react';
import { getEndpointMapping } from './services/endpointsApi';
import type { EndpointMappingTab } from './services/endpointsApi';

interface OpenMappingTab extends EndpointMappingTab {
  status: 'loading' | 'ready' | 'error';
  mapping: unknown | null;
  error: string | null;
}

function AppLayout() {
  const [openPanel, setOpenPanel] = useState<PanelType>(null);
  const [pinned, setPinned] = useState(false);
  const [mappingTabs, setMappingTabs] = useState<OpenMappingTab[]>([]);
  const [activeMappingTabId, setActiveMappingTabId] = useState<number | null>(null);

  const handleToggle = (panel: NonNullable<PanelType>) => {
    setOpenPanel(prev => (prev === panel ? null : panel));
  };

  const handleClose = () => {
    setOpenPanel(null);
    setPinned(false);
  };

  const handleOpenMapping = (mappingTab: EndpointMappingTab) => {
    let shouldFetch = false;

    setMappingTabs(prev => {
      const existingTab = prev.find(tab => tab.endpointId === mappingTab.endpointId);

      if (existingTab) {
        return prev;
      }

      shouldFetch = true;

      return [
        ...prev,
        {
          ...mappingTab,
          status: 'loading',
          mapping: null,
          error: null,
        },
      ];
    });
    setActiveMappingTabId(mappingTab.endpointId);

    if (!shouldFetch) {
      return;
    }

    void (async () => {
      try {
        const mapping = await getEndpointMapping(mappingTab.endpointId);
        setMappingTabs(prev => prev.map(tab => (
          tab.endpointId === mappingTab.endpointId
            ? { ...tab, status: 'ready', mapping, error: null }
            : tab
        )));
      } catch {
        setMappingTabs(prev => prev.map(tab => (
          tab.endpointId === mappingTab.endpointId
            ? { ...tab, status: 'error', error: 'Failed to load mapping for this endpoint.' }
            : tab
        )));
      }
    })();
  };

  const handleCloseMappingTab = (endpointId: number) => {
    setMappingTabs(prev => {
      const nextTabs = prev.filter(tab => tab.endpointId !== endpointId);

      setActiveMappingTabId(currentActiveId => {
        if (currentActiveId !== endpointId) {
          return currentActiveId;
        }

        if (nextTabs.length === 0) {
          return null;
        }

        const closedIndex = prev.findIndex(tab => tab.endpointId === endpointId);
        const nextActiveTab = nextTabs[Math.min(closedIndex, nextTabs.length - 1)];
        return nextActiveTab.endpointId;
      });

      return nextTabs;
    });
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
            onOpenMapping={handleOpenMapping}
          />
        )}
        <div style={styles.main}>
          <MappingWorkspace
            tabs={mappingTabs}
            activeTabId={activeMappingTabId}
            onSelectTab={setActiveMappingTabId}
            onCloseTab={handleCloseMappingTab}
          />
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
