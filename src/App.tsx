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
import { getDatabaseSchemas, getDatabaseTables, getServiceDatabase } from './services/databaseApi';
import type { DatabaseResponse } from './services/databaseApi';

interface OpenMappingTab extends EndpointMappingTab {
  mappingStatus: 'loading' | 'ready' | 'error';
  mapping: unknown | null;
  mappingError: string | null;
  responseModelStatus: 'idle' | 'loading' | 'ready' | 'error';
  responseModel: unknown | null;
  responseModelError: string | null;
  databaseStatus: 'idle' | 'loading' | 'ready' | 'error';
  database: DatabaseResponse | null;
  databaseError: string | null;
  schemasStatus: 'idle' | 'loading' | 'ready' | 'error';
  schemas: string[];
  schemasError: string | null;
  tablesBySchema: Record<string, string[]>;
  tablesStatusBySchema: Record<string, 'idle' | 'loading' | 'ready' | 'error'>;
  tablesErrorBySchema: Record<string, string | null>;
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
          responseModelStatus: 'idle',
          responseModel: null,
          responseModelError: null,
          databaseStatus: 'idle',
          database: null,
          databaseError: null,
          schemasStatus: 'idle',
          schemas: [],
          schemasError: null,
          tablesBySchema: {},
          tablesStatusBySchema: {},
          tablesErrorBySchema: {},
          workspaceMode: 'prompt',
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
            ? {
                ...tab,
                mappingStatus: 'ready',
                mapping,
                mappingError: null,
              }
            : tab
        )));
      } catch {
        setMappingTabs(prev => prev.map(tab => (
          tab.endpointId === mappingTab.endpointId
            ? {
                ...tab,
                mappingStatus: 'error',
                mapping: null,
                mappingError: 'Failed to load mapping for this endpoint.',
              }
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

  const handleChangeWorkspaceMode = (
    endpointId: number,
    workspaceMode: OpenMappingTab['workspaceMode'],
  ) => {
    if (workspaceMode === 'prompt') {
      setMappingTabs(prev => prev.map(tab => (
        tab.endpointId === endpointId
          ? { ...tab, workspaceMode }
          : tab
      )));
      return;
    }

    const targetTab = mappingTabs.find(tab => tab.endpointId === endpointId) ?? null;

    if (!targetTab) {
      return;
    }

    setMappingTabs(prev => prev.map(tab => {
      if (tab.endpointId !== endpointId) {
        return tab;
      }

      return {
        ...tab,
        workspaceMode,
        responseModelStatus: 'loading',
        responseModel: null,
        responseModelError: null,
        databaseStatus: 'loading',
        database: null,
        databaseError: null,
        schemasStatus: 'loading',
        schemas: [],
        schemasError: null,
      };
    }));

    const serviceId = targetTab.serviceId;

    void (async () => {
      let responseModelStatus: OpenMappingTab['responseModelStatus'] = 'ready';
      let responseModel: unknown | null = null;
      let responseModelError: string | null = null;
      let databaseStatus: OpenMappingTab['databaseStatus'] = 'ready';
      let database: DatabaseResponse | null = null;
      let databaseError: string | null = null;
      let schemasStatus: OpenMappingTab['schemasStatus'] = 'ready';
      let schemas: string[] = [];
      let schemasError: string | null = null;

      try {
        responseModel = await getEndpointResponseModel(endpointId);
      } catch {
        responseModelStatus = 'error';
        responseModelError = 'Failed to load response model for this endpoint.';
      }

      try {
        database = await getServiceDatabase(serviceId);
      } catch {
        databaseStatus = 'error';
        databaseError = 'Failed to load database details for this service.';
      }

      if (database) {
        try {
          schemas = await getDatabaseSchemas(database.databaseId);
        } catch {
          schemasStatus = 'error';
          schemasError = 'Failed to load database schemas.';
        }
      }

      setMappingTabs(prev => prev.map(tab => (
        tab.endpointId === endpointId
          ? {
              ...tab,
              responseModelStatus,
              responseModel,
              responseModelError,
              databaseStatus,
              database,
              databaseError,
              schemasStatus,
              schemas,
              schemasError,
            }
          : tab
      )));
    })();
  };

  const handleLoadTables = (endpointId: number, schemaName: string) => {
    if (!schemaName) {
      return;
    }

    let databaseId: number | null = null;
    let shouldFetch = false;

    setMappingTabs(prev => prev.map(tab => {
      if (tab.endpointId !== endpointId) {
        return tab;
      }

      databaseId = tab.database?.databaseId ?? null;
      const currentStatus = tab.tablesStatusBySchema[schemaName] ?? 'idle';

      if (!databaseId || currentStatus !== 'idle') {
        return tab;
      }

      shouldFetch = true;

      return {
        ...tab,
        tablesStatusBySchema: {
          ...tab.tablesStatusBySchema,
          [schemaName]: 'loading',
        },
        tablesErrorBySchema: {
          ...tab.tablesErrorBySchema,
          [schemaName]: null,
        },
      };
    }));

    if (!shouldFetch || !databaseId) {
      return;
    }

    void (async () => {
      try {
        const tables = await getDatabaseTables(databaseId, schemaName);

        setMappingTabs(prev => prev.map(tab => (
          tab.endpointId === endpointId
            ? {
                ...tab,
                tablesBySchema: {
                  ...tab.tablesBySchema,
                  [schemaName]: tables,
                },
                tablesStatusBySchema: {
                  ...tab.tablesStatusBySchema,
                  [schemaName]: 'ready',
                },
                tablesErrorBySchema: {
                  ...tab.tablesErrorBySchema,
                  [schemaName]: null,
                },
              }
            : tab
        )));
      } catch {
        setMappingTabs(prev => prev.map(tab => (
          tab.endpointId === endpointId
            ? {
                ...tab,
                tablesStatusBySchema: {
                  ...tab.tablesStatusBySchema,
                  [schemaName]: 'error',
                },
                tablesErrorBySchema: {
                  ...tab.tablesErrorBySchema,
                  [schemaName]: 'Failed to load tables for this schema.',
                },
              }
            : tab
        )));
      }
    })();
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
            onLoadTables={handleLoadTables}
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
