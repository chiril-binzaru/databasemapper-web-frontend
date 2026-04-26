import { useState } from 'react';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppSidebar from './components/AppSidebar';
import AppSidePanel from './components/AppSidePanel';
import MappingWorkspace from './components/MappingWorkspace';
import type { PanelType } from './types/panel';
import type { CSSProperties } from 'react';
import { getEndpointMapping, getEndpointResponseModel } from './services/endpointsApi';
import type { EndpointMappingTab } from './services/endpointsApi';
import { getDatabaseSchemas, getServiceDatabase } from './services/databaseApi';
import type { DatabaseResponse } from './services/databaseApi';

interface OpenMappingTab extends EndpointMappingTab {
  mappingStatus: 'loading' | 'ready' | 'error';
  mapping: unknown | null;
  mappingError: string | null;
  responseModelStatus: 'loading' | 'ready' | 'error';
  responseModel: unknown | null;
  responseModelError: string | null;
  databaseStatus: 'loading' | 'ready' | 'error';
  database: DatabaseResponse | null;
  databaseError: string | null;
  schemasStatus: 'loading' | 'ready' | 'error';
  schemas: string[];
  schemasError: string | null;
  workspaceMode: 'prompt' | 'empty-grid' | 'response-model-grid';
}

function AppLayout() {
  const [openPanel, setOpenPanel] = useState<PanelType>(null);
  const [pinned, setPinned] = useState(false);
  const [panelWidth, setPanelWidth] = useState(576);
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
          mappingStatus: 'loading',
          mapping: null,
          mappingError: null,
          responseModelStatus: 'loading',
          responseModel: null,
          responseModelError: null,
          databaseStatus: 'loading',
          database: null,
          databaseError: null,
          schemasStatus: 'loading',
          schemas: [],
          schemasError: null,
          workspaceMode: 'prompt',
        },
      ];
    });
    setActiveMappingTabId(mappingTab.endpointId);

    if (!shouldFetch) {
      return;
    }

    void (async () => {
      const [mappingResult, responseModelResult, databaseResult] = await Promise.allSettled([
        getEndpointMapping(mappingTab.endpointId),
        getEndpointResponseModel(mappingTab.endpointId),
        getServiceDatabase(mappingTab.serviceId),
      ]);
      const resolvedDatabase = databaseResult.status === 'fulfilled' ? databaseResult.value : null;

      const schemasResult = resolvedDatabase
        ? await Promise.allSettled([getDatabaseSchemas(resolvedDatabase.databaseId)])
        : null;

      setMappingTabs(prev => prev.map(tab => (
        tab.endpointId === mappingTab.endpointId
          ? {
              ...tab,
              mappingStatus: mappingResult.status === 'fulfilled' ? 'ready' : 'error',
              mapping: mappingResult.status === 'fulfilled' ? mappingResult.value : null,
              mappingError: mappingResult.status === 'fulfilled'
                ? null
                : 'Failed to load mapping for this endpoint.',
              responseModelStatus: responseModelResult.status === 'fulfilled' ? 'ready' : 'error',
              responseModel: responseModelResult.status === 'fulfilled' ? responseModelResult.value : null,
              responseModelError: responseModelResult.status === 'fulfilled'
                ? null
                : 'Failed to load response model for this endpoint.',
              databaseStatus: databaseResult.status === 'fulfilled' ? 'ready' : 'error',
              database: resolvedDatabase,
              databaseError: databaseResult.status === 'fulfilled'
                ? null
                : 'Failed to load database details for this service.',
              schemasStatus: schemasResult
                ? schemasResult[0].status === 'fulfilled' ? 'ready' : 'error'
                : 'ready',
              schemas: schemasResult && schemasResult[0].status === 'fulfilled'
                ? schemasResult[0].value
                : [],
              schemasError: schemasResult
                ? schemasResult[0].status === 'fulfilled'
                  ? null
                  : 'Failed to load database schemas.'
                : null,
            }
          : tab
      )));
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

  const handleChangeWorkspaceMode = (
    endpointId: number,
    workspaceMode: OpenMappingTab['workspaceMode'],
  ) => {
    setMappingTabs(prev => prev.map(tab => (
      tab.endpointId === endpointId
        ? { ...tab, workspaceMode }
        : tab
    )));
  };

  return (
    <div style={styles.root}>
      <AppSidebar activePanel={openPanel} onToggle={handleToggle} />
      <div style={styles.workspace}>
        {openPanel && (
          <AppSidePanel
            panel={openPanel}
            pinned={pinned}
            width={panelWidth}
            onClose={handleClose}
            onTogglePin={() => setPinned(p => !p)}
            onOpenMapping={handleOpenMapping}
            onResize={setPanelWidth}
          />
        )}
        <div style={styles.main}>
          <MappingWorkspace
            tabs={mappingTabs}
            activeTabId={activeMappingTabId}
            onSelectTab={setActiveMappingTabId}
            onCloseTab={handleCloseMappingTab}
            onChangeWorkspaceMode={handleChangeWorkspaceMode}
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
