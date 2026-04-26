import { CloseOutlined, DownOutlined } from '@ant-design/icons';
import { Select } from 'antd';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { EndpointMappingTab } from '../services/endpointsApi';
import type { DatabaseResponse } from '../services/databaseApi';

interface MappingWorkspaceTab extends EndpointMappingTab {
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
  tablesBySchema: Record<string, string[]>;
  tablesStatusBySchema: Record<string, 'idle' | 'loading' | 'ready' | 'error'>;
  tablesErrorBySchema: Record<string, string | null>;
  workspaceMode: 'prompt' | 'empty-grid' | 'response-model-grid';
}

interface MappingWorkspaceProps {
  tabs: MappingWorkspaceTab[];
  activeTabId: number | null;
  onSelectTab: (endpointId: number) => void;
  onCloseTab: (endpointId: number) => void;
  onLoadTables: (endpointId: number, schemaName: string) => void;
  onChangeWorkspaceMode: (
    endpointId: number,
    workspaceMode: MappingWorkspaceTab['workspaceMode'],
  ) => void;
}

const EMPTY_GRID_ROWS = 12;

interface MappingGridRow {
  name: string;
  type: string;
  format: string;
}

function SchemaCell({
  value,
  disabled,
  options,
  onChange,
  onOpenDropdown,
}: {
  value: string;
  disabled: boolean;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
  onOpenDropdown?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const blurTimeoutRef = useRef<number | null>(null);

  const stopEditing = () => {
    if (blurTimeoutRef.current !== null) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setEditing(false);
    setDropdownOpen(false);
    setSearchValue('');
  };

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (editing) {
      setSearchValue(value);
    }
  }, [editing, value]);

  if (editing && !disabled) {
    return (
      <div style={styles.schemaEditorShell}>
        <Select
          autoFocus
          open={dropdownOpen}
          value={value || undefined}
          searchValue={searchValue}
          showSearch={{
            filterOption: (input, option) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
          }}
          placeholder=""
          options={options}
          variant="borderless"
          suffixIcon={null}
          onSearch={nextValue => {
            setSearchValue(nextValue);
          }}
          onChange={nextValue => {
            onChange(nextValue);
            stopEditing();
          }}
          onBlur={() => {
            blurTimeoutRef.current = window.setTimeout(() => {
              stopEditing();
            }, 0);
          }}
          onFocus={() => {
            if (blurTimeoutRef.current !== null) {
              window.clearTimeout(blurTimeoutRef.current);
              blurTimeoutRef.current = null;
            }
          }}
          onOpenChange={open => {
            setDropdownOpen(open);
          }}
          className="schema-inline-select"
          style={styles.schemaSelectEditing}
        />
        <button
          type="button"
          style={styles.schemaEditorArrowButton}
          onMouseDown={event => {
            event.preventDefault();
          }}
          onClick={() => {
            onOpenDropdown?.();
            setDropdownOpen(open => !open);
          }}
        >
          <DownOutlined />
        </button>
      </div>
    );
  }

  return (
    <div
      role={disabled ? undefined : 'button'}
      tabIndex={disabled ? -1 : 0}
      style={{
        ...styles.schemaCellButton,
        ...(disabled ? styles.schemaCellButtonDisabled : null),
      }}
      onClick={() => {
        if (!disabled) {
          setEditing(true);
          setDropdownOpen(false);
        }
      }}
      onKeyDown={event => {
        if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          setEditing(true);
          setDropdownOpen(false);
          setSearchValue(value);
        }
      }}
    >
      <span
        style={{
          ...styles.schemaCellLabel,
          ...(value ? styles.schemaCellLabelFilled : styles.schemaCellLabelPlaceholder),
        }}
      >
        {value}
      </span>
      <span style={styles.schemaCellArrow}>
        <button
          type="button"
          style={styles.schemaArrowButton}
          tabIndex={-1}
          onMouseDown={event => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={event => {
            event.stopPropagation();
            if (!disabled) {
              setEditing(true);
              setDropdownOpen(true);
              setSearchValue(value);
            }
          }}
        >
          <DownOutlined />
        </button>
      </span>
    </div>
  );
}

function TabCloseButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      style={{
        ...styles.tabCloseBtn,
        ...(hovered ? styles.tabCloseBtnHovered : null),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={event => {
        event.stopPropagation();
        onClick();
      }}
    >
      <CloseOutlined />
    </button>
  );
}

function MappingTab({
  tab,
  isActive,
  onSelect,
  onClose,
}: {
  tab: MappingWorkspaceTab;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        ...styles.tab,
        ...(isActive ? styles.tabActive : null),
        ...(!isActive && hovered ? styles.tabHovered : null),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
    >
      <div style={styles.tabMeta}>
        <span style={styles.tabMethod}>{tab.httpMethod}</span>
        <span style={styles.tabPath}>{tab.endpointPath}</span>
      </div>
      <TabCloseButton onClick={onClose} />
    </div>
  );
}

function isMappingEmpty(mapping: unknown | null): boolean {
  if (mapping === null || mapping === undefined) {
    return true;
  }

  if (typeof mapping === 'string') {
    const normalizedValue = mapping.trim().toLowerCase();
    return normalizedValue === '' || normalizedValue === 'null' || normalizedValue === 'undefined';
  }

  if (typeof mapping === 'number' || typeof mapping === 'boolean') {
    return false;
  }

  if (Array.isArray(mapping)) {
    return mapping.length === 0 || mapping.every(item => isMappingEmpty(item as unknown));
  }

  if (typeof mapping === 'object') {
    const values = Object.values(mapping as Record<string, unknown>);
    return values.length === 0 || values.every(value => isMappingEmpty(value));
  }

  return false;
}

function getRefName(ref: unknown): string | null {
  if (typeof ref !== 'string') {
    return null;
  }

  const match = ref.match(/#\/components\/schemas\/(.+)$/);
  return match ? match[1] : null;
}

function flattenResponseModel(value: unknown): MappingGridRow[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  const schemas = value as Record<string, unknown>;
  const rootSchemaName = Object.keys(schemas)[0];
  if (!rootSchemaName) {
    return [];
  }

  const flattenSchema = (
    schemaName: string,
    prefix = '',
    visited = new Set<string>(),
  ): MappingGridRow[] => {
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

    return Object.entries(properties as Record<string, unknown>).flatMap(([fieldName, fieldSchema]) => {
      const normalizedFieldSchema =
        fieldSchema && typeof fieldSchema === 'object' && !Array.isArray(fieldSchema)
          ? fieldSchema as Record<string, unknown>
          : {};
      const fullFieldName = prefix ? `${prefix}.${fieldName}` : fieldName;

      const directRefName = getRefName(normalizedFieldSchema.$ref);
      if (directRefName) {
        const nestedRows = flattenSchema(directRefName, fullFieldName, nextVisited);
        return nestedRows.length > 0
          ? nestedRows
          : [{
              name: fullFieldName,
              type: directRefName,
              format: '',
            }];
      }

      if (normalizedFieldSchema.type === 'array') {
        const items =
          normalizedFieldSchema.items && typeof normalizedFieldSchema.items === 'object' && !Array.isArray(normalizedFieldSchema.items)
            ? normalizedFieldSchema.items as Record<string, unknown>
            : null;
        const itemRefName = items ? getRefName(items.$ref) : null;

        if (itemRefName) {
          const nestedRows = flattenSchema(itemRefName, fullFieldName, nextVisited);
          return nestedRows.length > 0
            ? nestedRows
            : [{
                name: fullFieldName,
                type: 'array',
                format: '',
              }];
        }

        return [{
          name: fullFieldName,
          type: 'array',
          format: items && typeof items.format === 'string' ? items.format : '',
        }];
      }

      return [{
        name: fullFieldName,
        type: typeof normalizedFieldSchema.type === 'string' ? normalizedFieldSchema.type : '',
        format: typeof normalizedFieldSchema.format === 'string' ? normalizedFieldSchema.format : '',
      }];
    });
  };

  return flattenSchema(rootSchemaName);
}

function MappingGrid({
  endpointId,
  serviceRows,
  schemasStatus,
  schemas,
  schemasError,
  tablesBySchema,
  tablesStatusBySchema,
  tablesErrorBySchema,
  onLoadTables,
}: {
  endpointId: number;
  serviceRows: MappingGridRow[];
  schemasStatus: MappingWorkspaceTab['schemasStatus'];
  schemas: string[];
  schemasError: string | null;
  tablesBySchema: MappingWorkspaceTab['tablesBySchema'];
  tablesStatusBySchema: MappingWorkspaceTab['tablesStatusBySchema'];
  tablesErrorBySchema: MappingWorkspaceTab['tablesErrorBySchema'];
  onLoadTables: (endpointId: number, schemaName: string) => void;
}) {
  const serviceRowCount = Math.max(EMPTY_GRID_ROWS, serviceRows.length);
  const databaseRowCount = Math.max(EMPTY_GRID_ROWS, serviceRows.length);
  const [selectedSchemas, setSelectedSchemas] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);

  useEffect(() => {
    setSelectedSchemas(prev => Array.from({ length: databaseRowCount }, (_, index) => prev[index] ?? ''));
  }, [databaseRowCount]);

  useEffect(() => {
    setSelectedTables(prev => Array.from({ length: databaseRowCount }, (_, index) => prev[index] ?? ''));
  }, [databaseRowCount]);

  const schemaOptions = schemas.map(schema => ({
    label: schema,
    value: schema,
  }));

  return (
    <div style={styles.gridShell}>
      <div style={styles.gridPane}>
        <div style={styles.gridSectionHeader}>Service</div>
        <div style={styles.gridHeaderRow}>
          <span style={styles.gridHeaderCell}>Field</span>
          <span style={styles.gridHeaderCell}>Type</span>
          <span style={styles.gridHeaderCell}>Format</span>
        </div>
        {Array.from({ length: serviceRowCount }).map((_, index) => {
          const row = serviceRows[index];

          return (
            <div key={`service-${index}`} style={styles.gridRow}>
              <span style={styles.gridCellText}>{row?.name ?? ''}</span>
              <span style={styles.gridCellText}>{row?.type ?? ''}</span>
              <span style={styles.gridCellTextMuted}>{row?.format ?? ''}</span>
            </div>
          );
        })}
      </div>

      <div style={styles.gridDivider} />

      <div style={styles.gridPane}>
        <div style={styles.gridSectionHeader}>Database</div>
        <div style={styles.databaseGridHeaderRow}>
          <span style={styles.gridHeaderCell}>Schema</span>
          <span style={styles.gridHeaderCell}>Table</span>
          <span style={styles.gridHeaderCell}>Column</span>
          <span style={styles.gridHeaderCell}>Type</span>
        </div>
        {Array.from({ length: databaseRowCount }).map((_, index) => {
          const selectedSchema = selectedSchemas[index] ?? '';
          const tablesStatus = selectedSchema ? (tablesStatusBySchema[selectedSchema] ?? 'idle') : 'idle';
          const tableOptions = (tablesBySchema[selectedSchema] ?? []).map(table => ({
            label: table,
            value: table,
          }));

          return (
            <div key={`database-${index}`} style={styles.databaseGridRow}>
              <span style={styles.schemaGridCell}>
                <SchemaCell
                  value={selectedSchemas[index] ?? ''}
                  options={schemaOptions}
                  disabled={schemasStatus !== 'ready' || schemas.length === 0}
                  onChange={value => {
                    setSelectedSchemas(prev => {
                      const next = [...prev];
                      const previousSchema = next[index] ?? '';
                      next[index] = value;

                      if (previousSchema !== value) {
                        setSelectedTables(currentTables => {
                          const nextTables = [...currentTables];
                          nextTables[index] = '';
                          return nextTables;
                        });
                      }

                      return next;
                    });
                  }}
                />
              </span>
              <span style={styles.schemaGridCell}>
                <SchemaCell
                  value={selectedTables[index] ?? ''}
                  options={tableOptions}
                  disabled={!selectedSchema || tablesStatus === 'loading'}
                  onOpenDropdown={() => {
                    if (selectedSchema) {
                      onLoadTables(endpointId, selectedSchema);
                    }
                  }}
                  onChange={value => {
                    setSelectedTables(prev => {
                      const next = [...prev];
                      next[index] = value;
                      return next;
                    });
                  }}
                />
              </span>
              <span style={styles.gridCell} />
              <span style={styles.gridCell} />
            </div>
          );
        })}
        {schemasStatus === 'error' && schemasError && (
          <div style={styles.databaseGridNote}>{schemasError}</div>
        )}
        {!schemasError && Object.values(tablesErrorBySchema).find(Boolean) && (
          <div style={styles.databaseGridNote}>
            {Object.values(tablesErrorBySchema).find(Boolean)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MappingWorkspace({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onLoadTables,
  onChangeWorkspaceMode,
}: MappingWorkspaceProps) {
  const safeTabs = tabs ?? [];
  const safeOnSelectTab = onSelectTab ?? (() => {});
  const safeOnCloseTab = onCloseTab ?? (() => {});
  const safeOnChangeWorkspaceMode = onChangeWorkspaceMode ?? (() => {});
  const activeTab = safeTabs.find(tab => tab.endpointId === activeTabId) ?? null;

  if (safeTabs.length === 0) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyStateCard}>
          <span style={styles.emptyTitle}>No mapping is open</span>
          <span style={styles.emptyText}>Click an endpoint in the Services panel to open its mapping in a new tab.</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <div style={styles.tabsBar}>
        {safeTabs.map(tab => {
          const isActive = tab.endpointId === activeTabId;

          return (
            <MappingTab
              key={tab.endpointId}
              tab={tab}
              isActive={isActive}
              onSelect={() => safeOnSelectTab(tab.endpointId)}
              onClose={() => safeOnCloseTab(tab.endpointId)}
            />
          );
        })}
      </div>

      {activeTab && (
        <div style={styles.canvas}>
          <div style={styles.canvasHeader}>
            <div style={styles.canvasTitleGroup}>
              <span style={styles.canvasTitle}>{activeTab.httpMethod} {activeTab.endpointPath}</span>
              <span style={styles.canvasSubtitle}>{activeTab.serviceName}</span>
            </div>
          </div>

          {activeTab.mappingStatus === 'loading' ? (
            <div style={styles.placeholderState}>Loading mapping...</div>
          ) : activeTab.mappingStatus === 'error' ? (
            <div style={styles.placeholderStateError}>{activeTab.mappingError ?? 'Failed to load mapping.'}</div>
          ) : isMappingEmpty(activeTab.mapping) ? (
            activeTab.workspaceMode === 'prompt' ? (
              <div style={styles.emptyMappingPrompt}>
                <span style={styles.emptyMappingTitle}>Current endpoint has no mapping yet.</span>
                <button
                  type="button"
                  style={styles.inlineAction}
                  onClick={() => safeOnChangeWorkspaceMode(activeTab.endpointId, 'empty-grid')}
                >
                  Create empty mapping
                </button>
                <button
                  type="button"
                  style={styles.inlineAction}
                  onClick={() => safeOnChangeWorkspaceMode(activeTab.endpointId, 'response-model-grid')}
                >
                  Create mapping with populated response model
                </button>
                {activeTab.responseModelStatus === 'loading' && (
                  <span style={styles.inlineHint}>Loading response model...</span>
                )}
                {activeTab.responseModelStatus === 'error' && (
                  <span style={styles.inlineHintError}>
                    {activeTab.responseModelError ?? 'Failed to load response model.'}
                  </span>
                )}
                {activeTab.responseModelStatus === 'ready' && flattenResponseModel(activeTab.responseModel).length === 0 && (
                  <span style={styles.inlineHint}>Response model is empty, so the Service side will stay blank.</span>
                )}
              </div>
            ) : (
              <MappingGrid
                key={`${activeTab.endpointId}-${activeTab.workspaceMode}`}
                endpointId={activeTab.endpointId}
                serviceRows={activeTab.workspaceMode === 'response-model-grid'
                  ? flattenResponseModel(activeTab.responseModel)
                  : []}
                schemasStatus={activeTab.schemasStatus}
                schemas={activeTab.schemas}
                schemasError={activeTab.schemasError}
                tablesBySchema={activeTab.tablesBySchema}
                tablesStatusBySchema={activeTab.tablesStatusBySchema}
                tablesErrorBySchema={activeTab.tablesErrorBySchema}
                onLoadTables={onLoadTables}
              />
            )
          ) : (
            <div style={styles.placeholderState}>Mapping data loaded. Rendering populated mappings comes next.</div>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    background: '#141414',
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyStateCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '24px 28px',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
  },
  emptyTitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 16,
    fontWeight: 600,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.32)',
    fontSize: 14,
  },
  tabsBar: {
    height: 44,
    display: 'flex',
    alignItems: 'stretch',
    overflowX: 'auto',
    borderBottom: '1px solid #262626',
    background: '#171717',
    flexShrink: 0,
  },
  tab: {
    minWidth: 220,
    maxWidth: 360,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '0 12px',
    borderRight: '1px solid #262626',
    background: '#171717',
    flexShrink: 0,
    transition: 'filter 0.15s ease, background 0.15s ease',
    cursor: 'default',
    userSelect: 'none',
  },
  tabActive: {
    background: '#1f1f1f',
    boxShadow: 'inset 0 -2px 0 #4096ff',
  },
  tabHovered: {
    filter: 'brightness(1.3)',
  },
  tabMeta: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'default',
  },
  tabMethod: {
    color: '#49cc90',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.05em',
    flexShrink: 0,
    cursor: 'default',
  },
  tabPath: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    cursor: 'default',
  },
  tabCloseBtn: {
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.35)',
    cursor: 'pointer',
    padding: 0,
    width: 18,
    height: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderRadius: 4,
    transition: 'background 0.15s ease, color 0.15s ease',
  },
  tabCloseBtnHovered: {
    background: 'rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.82)',
  },
  canvas: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: 16,
    gap: 14,
    overflow: 'auto',
  },
  canvasHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  canvasTitleGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  canvasTitle: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 16,
    fontWeight: 600,
  },
  canvasSubtitle: {
    color: 'rgba(255,255,255,0.32)',
    fontSize: 12,
  },
  placeholderState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.02)',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },
  placeholderStateError: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    borderRadius: 12,
    border: '1px solid rgba(255,120,117,0.28)',
    background: 'rgba(255,120,117,0.06)',
    color: '#ffccc7',
    fontSize: 13,
  },
  emptyMappingPrompt: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 10,
    padding: '20px 22px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.02)',
  },
  emptyMappingTitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
  },
  inlineAction: {
    border: 'none',
    background: 'transparent',
    color: '#69b1ff',
    fontSize: 13,
    padding: 0,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  inlineHint: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
  },
  inlineHintError: {
    color: '#ffccc7',
    fontSize: 12,
  },
  gridShell: {
    flex: 1,
    minHeight: 420,
    display: 'grid',
    gridTemplateColumns: '1fr 1px 1fr',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    overflow: 'hidden',
    background: '#181818',
  },
  gridPane: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  gridDivider: {
    background: 'rgba(255,255,255,0.1)',
  },
  gridSectionHeader: {
    height: 42,
    display: 'flex',
    alignItems: 'center',
    padding: '0 14px',
    background: 'linear-gradient(180deg, rgba(64,150,255,0.14) 0%, rgba(64,150,255,0.04) 100%)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  gridHeaderRow: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 0.8fr 1fr',
    height: 38,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    background: '#202020',
  },
  gridHeaderCell: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.46)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  gridRow: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 0.8fr 1fr',
    height: 40,
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  databaseGridHeaderRow: {
    display: 'grid',
    gridTemplateColumns: '0.9fr 1fr 1.1fr 0.8fr',
    height: 38,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    background: '#202020',
  },
  databaseGridRow: {
    display: 'grid',
    gridTemplateColumns: '0.9fr 1fr 1.1fr 0.8fr',
    height: 40,
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  gridCell: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.01)',
  },
  gridCellText: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.01)',
    color: 'rgba(255,255,255,0.74)',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  gridCellTextMuted: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.01)',
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  schemaEditorShell: {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'stretch',
    padding: '0 12px',
    background: 'rgba(255,255,255,0.01)',
  },
  schemaGridCell: {
    display: 'flex',
    alignItems: 'stretch',
    padding: 0,
    borderRight: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.01)',
  },
  schemaCellButton: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    border: 'none',
    background: 'transparent',
    padding: '0 12px',
    cursor: 'text',
    textAlign: 'left',
    outline: 'none',
  },
  schemaArrowButton: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    padding: 0,
    cursor: 'pointer',
  },
  schemaEditorArrowButton: {
    width: 28,
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.45)',
    padding: 0,
    cursor: 'pointer',
    flexShrink: 0,
  },
  schemaCellButtonDisabled: {
    cursor: 'not-allowed',
  },
  schemaCellLabel: {
    minWidth: 0,
    lineHeight: '40px',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    fontSize: 12,
  },
  schemaCellLabelFilled: {
    color: 'rgba(255,255,255,0.74)',
    fontFamily: 'monospace',
  },
  schemaCellLabelPlaceholder: {
    color: 'rgba(255,255,255,0.32)',
    lineHeight: '40px',
  },
  schemaCellArrow: {
    width: 28,
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
  },
  databaseGridNote: {
    padding: '10px 12px',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    color: '#ffccc7',
    fontSize: 12,
    background: 'rgba(255,120,117,0.04)',
  },
};
