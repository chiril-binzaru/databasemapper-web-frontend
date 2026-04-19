import { CloseOutlined } from '@ant-design/icons';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { EndpointMappingTab } from '../services/endpointsApi';

interface MappingWorkspaceTab extends EndpointMappingTab {
  mappingStatus: 'loading' | 'ready' | 'error';
  mapping: unknown | null;
  mappingError: string | null;
  responseModelStatus: 'loading' | 'ready' | 'error';
  responseModel: unknown | null;
  responseModelError: string | null;
  workspaceMode: 'prompt' | 'empty-grid' | 'response-model-grid';
}

interface MappingWorkspaceProps {
  tabs: MappingWorkspaceTab[];
  activeTabId: number | null;
  onSelectTab: (endpointId: number) => void;
  onCloseTab: (endpointId: number) => void;
  onChangeWorkspaceMode: (
    endpointId: number,
    workspaceMode: MappingWorkspaceTab['workspaceMode'],
  ) => void;
}

const EMPTY_GRID_ROWS = 12;

interface MappingGridRow {
  name: string;
  type: string;
  example: string;
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

function getValueType(value: unknown): string {
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value === null) {
    return 'null';
  }
  return typeof value;
}

function formatExample(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? '[]' : '[…]';
  }
  return '{…}';
}

function flattenResponseModel(value: unknown, prefix = ''): MappingGridRow[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return prefix ? [{ name: prefix, type: 'array', example: '[]' }] : [];
    }

    const sample = value[0];
    if (sample !== null && typeof sample === 'object' && !Array.isArray(sample)) {
      const nestedRows = flattenResponseModel(sample, prefix ? `${prefix}[]` : '[]');
      return nestedRows.length > 0 ? nestedRows : [{ name: prefix || '[]', type: 'array<object>', example: '[…]' }];
    }

    return [{ name: prefix || '[]', type: `array<${getValueType(sample)}>`, example: '[…]' }];
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return prefix ? [{ name: prefix, type: 'object', example: '{…}' }] : [];
    }

    return entries.flatMap(([key, nestedValue]) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      if (nestedValue !== null && typeof nestedValue === 'object') {
        const nestedRows = flattenResponseModel(nestedValue, nextPrefix);
        return nestedRows.length > 0
          ? nestedRows
          : [{ name: nextPrefix, type: getValueType(nestedValue), example: formatExample(nestedValue) }];
      }

      return [{
        name: nextPrefix,
        type: getValueType(nestedValue),
        example: formatExample(nestedValue),
      }];
    });
  }

  return prefix
    ? [{
        name: prefix,
        type: getValueType(value),
        example: formatExample(value),
      }]
    : [];
}

function MappingGrid({
  serviceRows,
}: {
  serviceRows: MappingGridRow[];
}) {
  const serviceRowCount = Math.max(EMPTY_GRID_ROWS, serviceRows.length);
  const databaseRowCount = Math.max(EMPTY_GRID_ROWS, serviceRows.length);

  return (
    <div style={styles.gridShell}>
      <div style={styles.gridPane}>
        <div style={styles.gridSectionHeader}>Service</div>
        <div style={styles.gridHeaderRow}>
          <span style={styles.gridHeaderCell}>Field</span>
          <span style={styles.gridHeaderCell}>Type</span>
          <span style={styles.gridHeaderCell}>Example</span>
        </div>
        {Array.from({ length: serviceRowCount }).map((_, index) => {
          const row = serviceRows[index];

          return (
            <div key={`service-${index}`} style={styles.gridRow}>
              <span style={styles.gridCellText}>{row?.name ?? ''}</span>
              <span style={styles.gridCellText}>{row?.type ?? ''}</span>
              <span style={styles.gridCellTextMuted}>{row?.example ?? ''}</span>
            </div>
          );
        })}
      </div>

      <div style={styles.gridDivider} />

      <div style={styles.gridPane}>
        <div style={styles.gridSectionHeader}>Database</div>
        <div style={styles.databaseGridHeaderRow}>
          <span style={styles.gridHeaderCell}>User</span>
          <span style={styles.gridHeaderCell}>Table</span>
          <span style={styles.gridHeaderCell}>Column</span>
          <span style={styles.gridHeaderCell}>Type</span>
        </div>
        {Array.from({ length: databaseRowCount }).map((_, index) => (
          <div key={`database-${index}`} style={styles.databaseGridRow}>
            <span style={styles.gridCell} />
            <span style={styles.gridCell} />
            <span style={styles.gridCell} />
            <span style={styles.gridCell} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MappingWorkspace({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
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
                serviceRows={activeTab.workspaceMode === 'response-model-grid'
                  ? flattenResponseModel(activeTab.responseModel)
                  : []}
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
    minHeight: 40,
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
    minHeight: 40,
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
};
