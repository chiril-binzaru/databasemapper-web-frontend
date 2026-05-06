import { useState } from 'react';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppSidebar from './components/AppSidebar';
import AppSidePanel from './components/AppSidePanel';
import MappingWorkspace from './components/MappingWorkspace';
import type { PanelType } from './types/panel';
import type { CSSProperties } from 'react';
import {
  createEndpointMapping,
  getEndpointMapping,
  getEndpointResponseModel,
  replaceEndpointMapping,
} from './services/endpointsApi';
import type { EndpointMappingTab, MappingDto, MappingFieldEntry } from './services/endpointsApi';
import { getDatabaseSchemas, getDatabaseTables, getServiceDatabase } from './services/databaseApi';
import type { DatabaseResponse } from './services/databaseApi';

interface OpenMappingTab extends EndpointMappingTab {
  mappingStatus: 'loading' | 'ready' | 'error';
  mapping: MappingDto | null;
  mappingError: string | null;
  isDirty: boolean;
  saveStatus: 'idle' | 'saving' | 'error';
  saveError: string | null;
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

function deriveModelNameFromEndpoint(endpointPath: string): string {
  const segments = endpointPath
    .split('/')
    .map(segment => segment.replace(/[{}]/g, '').trim())
    .filter(Boolean);
  const source = segments[segments.length - 1] ?? 'Mapping';
  const words = source.split(/[^a-zA-Z0-9]+/).filter(Boolean);

  if (words.length === 0) {
    return 'Mapping';
  }

  return words
    .map(word => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join('');
}

function getResponseModelRootName(responseModel: unknown): string | null {
  if (!responseModel || typeof responseModel !== 'object' || Array.isArray(responseModel)) {
    return null;
  }

  return Object.keys(responseModel as Record<string, unknown>)[0] ?? null;
}

function getRefName(ref: unknown): string | null {
  if (typeof ref !== 'string') {
    return null;
  }

  const match = ref.match(/#\/components\/schemas\/(.+)$/);
  return match ? match[1] : null;
}

function createFieldMappingsFromResponseModel(responseModel: unknown, rootModelName: string): MappingFieldEntry[] {
  if (!responseModel || typeof responseModel !== 'object' || Array.isArray(responseModel)) {
    return [];
  }

  const schemas = responseModel as Record<string, unknown>;

  const createEntries = (schemaName: string, visited = new Set<string>()): MappingFieldEntry[] => {
    if (visited.has(schemaName)) {
      return [];
    }

    const schema = schemas[schemaName];
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
      return [];
    }

    const properties = (schema as { properties?: unknown }).properties;
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
      return [];
    }

    const nextVisited = new Set(visited);
    nextVisited.add(schemaName);

    return Object.entries(properties as Record<string, unknown>).map<MappingFieldEntry>(([modelField, fieldSchema]) => {
      const normalizedFieldSchema =
        fieldSchema && typeof fieldSchema === 'object' && !Array.isArray(fieldSchema)
          ? fieldSchema as Record<string, unknown>
          : {};
      const directRefName = getRefName(normalizedFieldSchema.$ref);

      if (directRefName) {
        return {
          modelField,
          kind: 'MODEL',
          type: directRefName,
          format: '',
          modelName: directRefName,
          fieldMappings: createEntries(directRefName, nextVisited),
        };
      }

      if (normalizedFieldSchema.type === 'array') {
        const items =
          normalizedFieldSchema.items && typeof normalizedFieldSchema.items === 'object' && !Array.isArray(normalizedFieldSchema.items)
            ? normalizedFieldSchema.items as Record<string, unknown>
            : null;
        const itemRefName = items ? getRefName(items.$ref) : null;

        if (itemRefName) {
          return {
            modelField,
            kind: 'LIST_OF_MODELS',
            type: 'array',
            format: '',
            modelName: itemRefName,
            fieldMappings: createEntries(itemRefName, nextVisited),
          };
        }

        return {
          modelField,
          kind: 'LIST_OF_VALUES',
          type: 'array',
          format: items && typeof items.format === 'string' ? items.format : '',
        };
      }

      return {
        modelField,
        kind: 'VALUE',
        type: typeof normalizedFieldSchema.type === 'string' ? normalizedFieldSchema.type : '',
        format: typeof normalizedFieldSchema.format === 'string' ? normalizedFieldSchema.format : '',
      };
    });
  };

  return createEntries(rootModelName);
}

function createEmptyMapping(tab: EndpointMappingTab): MappingDto {
  return {
    modelName: deriveModelNameFromEndpoint(tab.endpointPath),
    fieldMappings: [],
  };
}

function createMappingWithResponseModel(tab: EndpointMappingTab, responseModel: unknown): MappingDto {
  const modelName = getResponseModelRootName(responseModel) ?? deriveModelNameFromEndpoint(tab.endpointPath);

  return {
    modelName,
    fieldMappings: createFieldMappingsFromResponseModel(responseModel, modelName),
  };
}

function AppLayout() {
  const { message } = AntApp.useApp();
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
          isDirty: false,
          saveStatus: 'idle',
          saveError: null,
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
        let databaseStatus: OpenMappingTab['databaseStatus'] = 'idle';
        let database: DatabaseResponse | null = null;
        let databaseError: string | null = null;
        let schemasStatus: OpenMappingTab['schemasStatus'] = 'idle';
        let schemas: string[] = [];
        let schemasError: string | null = null;

        if (mapping) {
          databaseStatus = 'ready';
          schemasStatus = 'ready';

          try {
            database = await getServiceDatabase(mappingTab.serviceId);
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
        }

        setMappingTabs(prev => prev.map(tab => (
          tab.endpointId === mappingTab.endpointId
            ? {
                ...tab,
                mappingStatus: 'ready',
                mapping,
                mappingError: null,
                isDirty: false,
                saveStatus: 'idle',
                saveError: null,
                databaseStatus,
                database,
                databaseError,
                schemasStatus,
                schemas,
                schemasError,
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
                isDirty: false,
                saveStatus: 'idle',
                saveError: null,
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

  const handleCreateMapping = (
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
        mappingStatus: 'loading',
        mappingError: null,
        saveStatus: 'idle',
        saveError: null,
        workspaceMode,
        responseModelStatus: workspaceMode === 'response-model-grid' ? 'loading' : 'idle',
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
      let responseModelStatus: OpenMappingTab['responseModelStatus'] =
        workspaceMode === 'response-model-grid' ? 'ready' : 'idle';
      let responseModel: unknown | null = null;
      let responseModelError: string | null = null;
      let databaseStatus: OpenMappingTab['databaseStatus'] = 'ready';
      let database: DatabaseResponse | null = null;
      let databaseError: string | null = null;
      let schemasStatus: OpenMappingTab['schemasStatus'] = 'ready';
      let schemas: string[] = [];
      let schemasError: string | null = null;
      let mapping: MappingDto;

      if (workspaceMode === 'response-model-grid') {
        try {
          responseModel = await getEndpointResponseModel(endpointId);
        } catch {
          responseModelStatus = 'error';
          responseModelError = 'Failed to load response model for this endpoint.';
        }
      }

      const mappingPayload = workspaceMode === 'response-model-grid'
        ? createMappingWithResponseModel(targetTab, responseModel)
        : createEmptyMapping(targetTab);

      try {
        mapping = await createEndpointMapping(endpointId, mappingPayload);
      } catch {
        setMappingTabs(prev => prev.map(tab => (
          tab.endpointId === endpointId
            ? {
                ...tab,
                mappingStatus: 'ready',
                mapping: null,
                mappingError: 'Failed to create mapping for this endpoint.',
                workspaceMode: 'prompt',
              }
            : tab
        )));
        void message.error('Failed to create mapping.');
        return;
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
              mappingStatus: 'ready',
              mapping,
              mappingError: null,
              isDirty: false,
              saveStatus: 'idle',
              saveError: null,
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
      void message.success('Mapping created.');
    })();
  };

  const handleChangeMapping = (endpointId: number, mapping: MappingDto) => {
    setMappingTabs(prev => prev.map(tab => (
      tab.endpointId === endpointId
        ? {
            ...tab,
            mapping,
            isDirty: true,
            saveStatus: 'idle',
            saveError: null,
          }
        : tab
    )));
  };

  const handleSaveMapping = (endpointId: number) => {
    const targetTab = mappingTabs.find(tab => tab.endpointId === endpointId) ?? null;

    if (!targetTab?.mapping || !targetTab.isDirty || targetTab.saveStatus === 'saving') {
      return;
    }

    const mappingToSave = targetTab.mapping;

    setMappingTabs(prev => prev.map(tab => (
      tab.endpointId === endpointId
        ? {
            ...tab,
            saveStatus: 'saving',
            saveError: null,
          }
        : tab
    )));

    void (async () => {
      try {
        const mapping = await replaceEndpointMapping(endpointId, mappingToSave);

        setMappingTabs(prev => prev.map(tab => (
          tab.endpointId === endpointId
            ? {
                ...tab,
                mapping,
                isDirty: false,
                saveStatus: 'idle',
                saveError: null,
              }
            : tab
        )));
        void message.success('Mapping saved.');
      } catch {
        setMappingTabs(prev => prev.map(tab => (
          tab.endpointId === endpointId
            ? {
                ...tab,
                saveStatus: 'error',
                saveError: 'Failed to save mapping.',
              }
            : tab
        )));
        void message.error('Failed to save mapping.');
      }
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
            onCreateMapping={handleCreateMapping}
            onChangeMapping={handleChangeMapping}
            onSaveMapping={handleSaveMapping}
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
