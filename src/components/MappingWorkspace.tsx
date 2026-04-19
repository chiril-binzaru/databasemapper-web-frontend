import { CloseOutlined } from '@ant-design/icons';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { EndpointMappingTab } from '../services/endpointsApi';

interface MappingWorkspaceTab extends EndpointMappingTab {
  status: 'loading' | 'ready' | 'error';
  mapping: unknown | null;
  error: string | null;
}

interface MappingWorkspaceProps {
  tabs: MappingWorkspaceTab[];
  activeTabId: number | null;
  onSelectTab: (endpointId: number) => void;
  onCloseTab: (endpointId: number) => void;
}

const EMPTY_GRID_ROWS = 12;

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

  if (Array.isArray(mapping)) {
    return mapping.length === 0;
  }

  if (typeof mapping === 'object') {
    return Object.keys(mapping as Record<string, unknown>).length === 0;
  }

  return false;
}

export default function MappingWorkspace({ tabs, activeTabId, onSelectTab, onCloseTab }: MappingWorkspaceProps) {
  const safeTabs = tabs ?? [];
  const safeOnSelectTab = onSelectTab ?? (() => {});
  const safeOnCloseTab = onCloseTab ?? (() => {});
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

          {activeTab.status === 'loading' ? (
            <div style={styles.placeholderState}>Loading mapping...</div>
          ) : activeTab.status === 'error' ? (
            <div style={styles.placeholderStateError}>{activeTab.error ?? 'Failed to load mapping.'}</div>
          ) : isMappingEmpty(activeTab.mapping) ? (
            <div style={styles.gridShell}>
              <div style={styles.gridPane}>
                <div style={styles.gridSectionHeader}>Service</div>
                <div style={styles.gridHeaderRow}>
                  <span style={styles.gridHeaderCell}>Field</span>
                  <span style={styles.gridHeaderCell}>Type</span>
                  <span style={styles.gridHeaderCell}>Example</span>
                </div>
                {Array.from({ length: EMPTY_GRID_ROWS }).map((_, index) => (
                  <div key={`service-${index}`} style={styles.gridRow}>
                    <span style={styles.gridCellMuted}>{index + 1}</span>
                    <span style={styles.gridCell} />
                    <span style={styles.gridCell} />
                  </div>
                ))}
              </div>

              <div style={styles.gridDivider} />

              <div style={styles.gridPane}>
                <div style={styles.gridSectionHeader}>Database</div>
                <div style={styles.gridHeaderRow}>
                  <span style={styles.gridHeaderCell}>Column</span>
                  <span style={styles.gridHeaderCell}>Type</span>
                  <span style={styles.gridHeaderCell}>Table</span>
                </div>
                {Array.from({ length: EMPTY_GRID_ROWS }).map((_, index) => (
                  <div key={`database-${index}`} style={styles.gridRow}>
                    <span style={styles.gridCellMuted}>{index + 1}</span>
                    <span style={styles.gridCell} />
                    <span style={styles.gridCell} />
                  </div>
                ))}
              </div>
            </div>
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
    gridTemplateColumns: '64px 1fr 1fr',
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
    gridTemplateColumns: '64px 1fr 1fr',
    minHeight: 40,
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  gridCellMuted: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.22)',
    fontSize: 11,
    background: 'rgba(255,255,255,0.02)',
  },
  gridCell: {
    borderRight: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.01)',
  },
};
