import { CloseOutlined, KeyOutlined } from '@ant-design/icons';
import { ChevronDown } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import type {
  EndpointMappingTab,
  JoinConditionPairDto,
  JoinEntryDto,
  MappingDto,
  MappingFieldEntry,
} from '../services/endpointsApi';
import type { DatabaseResponse, DbColumnResponse } from '../services/databaseApi';

interface MappingWorkspaceTab extends EndpointMappingTab {
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
  columnsByTable: Record<string, DbColumnResponse[]>;
  columnsStatusByTable: Record<string, 'idle' | 'loading' | 'ready' | 'error'>;
  columnsErrorByTable: Record<string, string | null>;
  workspaceMode: 'prompt' | 'empty-grid' | 'response-model-grid';
}

interface MappingWorkspaceProps {
  tabs: MappingWorkspaceTab[];
  activeTabId: number | null;
  onSelectTab: (endpointId: number) => void;
  onCloseTab: (endpointId: number) => void;
  onLoadTables: (endpointId: number, schemaName: string) => void;
  onLoadColumns: (endpointId: number, schemaName: string, tableName: string) => void;
  onCreateMapping: (
    endpointId: number,
    workspaceMode: MappingWorkspaceTab['workspaceMode'],
  ) => void;
  onChangeMapping: (endpointId: number, mapping: MappingDto) => void;
  onSaveMapping: (endpointId: number) => void;
}

const EMPTY_GRID_ROWS = 12;

const JOIN_OPERATOR_OPTIONS: Array<{ label: string; value: JoinConditionPairDto['operator'] }> = [
  { label: '=', value: 'EQ' },
  { label: '!=', value: 'NEQ' },
  { label: '>', value: 'GT' },
  { label: '<', value: 'LT' },
  { label: '>=', value: 'GTE' },
  { label: '<=', value: 'LTE' },
  { label: 'IN', value: 'IN' },
  { label: 'NOT IN', value: 'NOT_IN' },
];

interface MappingGridRow {
  name: string;
  type: string;
  format: string;
}

interface SelectedJoinTable {
  key: string;
  schemaName: string;
  tableName: string;
}

interface JoinEdgePoint {
  key: string;
  x: number;
  y: number;
  leftX: number;
  rightX: number;
}

interface JoinEdgeLine {
  join: JoinEntryDto;
  joinIndex: number;
  leftPoint: JoinEdgePoint;
  rightPoint: JoinEdgePoint;
}

interface ScopeEntry {
  path: string;
  tables: SelectedJoinTable[];
}

function createTableKey(schemaName: string, tableName: string): string {
  return JSON.stringify([schemaName, tableName]);
}

function createColumnPath(schemaName: string, tableName: string, columnName: string): string {
  return `${schemaName}.${tableName}.${columnName}`;
}

function getTableKeyFromColumnPath(columnPath: string | undefined): string | null {
  if (!columnPath) {
    return null;
  }

  const [schemaName = '', tableName = ''] = columnPath.split('.');
  return schemaName && tableName ? createTableKey(schemaName, tableName) : null;
}

function parseTableKey(tableKey: string): SelectedJoinTable | null {
  try {
    const [schemaName, tableName] = JSON.parse(tableKey) as unknown[];

    if (typeof schemaName === 'string' && typeof tableName === 'string' && schemaName && tableName) {
      return { key: tableKey, schemaName, tableName };
    }
  } catch {
    return null;
  }

  return null;
}

function getScopesFromMapping(
  mapping: MappingDto | null,
  selectedSchemas: string[],
  selectedTables: string[],
  serviceRows: MappingGridRow[],
): ScopeEntry[] {
  if (!mapping) {
    return [];
  }

  const tableKeyByField = new Map<string, string>();
  serviceRows.forEach((row, index) => {
    const schema = selectedSchemas[index] ?? '';
    const table = selectedTables[index] ?? '';
    if (schema && table) {
      tableKeyByField.set(row.name, createTableKey(schema, table));
    }
  });

  const scopes: ScopeEntry[] = [];

  // Returns all distinct tableKeys collected in this scope AND all descendants,
  // so each parent scope can include its children's tables.
  const traverse = (entries: MappingFieldEntry[], scopePath: string, prefix: string): string[] => {
    const ownTableKeys: string[] = [];
    const childInfos: Array<{ childMappings: MappingFieldEntry[]; childPath: string; childPrefix: string }> = [];

    for (const entry of entries) {
      const fieldPath = prefix
        ? `${prefix}.${entry.serviceInfo.modelField}`
        : entry.serviceInfo.modelField;

      if (entry.fieldMappings && entry.fieldMappings.length > 0) {
        const childPath = scopePath === '/'
          ? `/${entry.serviceInfo.modelField}`
          : `${scopePath}/${entry.serviceInfo.modelField}`;
        childInfos.push({ childMappings: entry.fieldMappings, childPath, childPrefix: fieldPath });
      } else {
        const tableKey = tableKeyByField.get(fieldPath);
        if (tableKey) ownTableKeys.push(tableKey);
      }
    }

    const descendantKeys: string[] = [];
    childInfos.forEach(({ childMappings, childPath, childPrefix }) => {
      const childKeys = traverse(childMappings, childPath, childPrefix);
      descendantKeys.push(...childKeys);
    });

    const allTableKeySet = new Set([...ownTableKeys, ...descendantKeys]);
    const tables = Array.from(allTableKeySet)
      .map(parseTableKey)
      .filter((t): t is SelectedJoinTable => t !== null);

    scopes.push({ path: scopePath, tables });

    return Array.from(allTableKeySet);
  };

  traverse(mapping.fieldMappings, '/', '');

  // Sort shallowest scope first so / is always scopes[0]
  scopes.sort((a, b) => {
    const aDepth = a.path === '/' ? 0 : a.path.split('/').length - 1;
    const bDepth = b.path === '/' ? 0 : b.path.split('/').length - 1;
    return aDepth - bDepth;
  });

  return scopes;
}

const TABLE_CARD_WIDTH = 230;
const EDGE_CORNER_RADIUS = 10;

function buildEdgePath(left: JoinEdgePoint, right: JoinEdgePoint): string {
  const sy = left.y;
  const ty = right.y;

  // Pick exit/entry sides based on which table is further left
  const goingRight = left.leftX < right.leftX;
  const sx = goingRight ? left.rightX : left.leftX;
  const tx = goingRight ? right.leftX : right.rightX;

  if (Math.abs(sx - tx) < 1) {
    return `M ${sx} ${sy} V ${ty}`;
  }
  if (Math.abs(sy - ty) < 1) {
    return `M ${sx} ${sy} H ${tx}`;
  }

  const midX = (sx + tx) / 2;
  const dy = ty - sy;
  const dir = dy > 0 ? 1 : -1;
  const r = Math.min(
    EDGE_CORNER_RADIUS,
    Math.abs(midX - sx) / 2,
    Math.abs(tx - midX) / 2,
    Math.abs(dy) / 2,
  );
  const c1x = goingRight ? midX - r : midX + r;
  const c2x = goingRight ? midX + r : midX - r;

  return [
    `M ${sx} ${sy}`,
    `H ${c1x}`,
    `Q ${midX} ${sy} ${midX} ${sy + dir * r}`,
    `V ${ty - dir * r}`,
    `Q ${midX} ${ty} ${c2x} ${ty}`,
    `H ${tx}`,
  ].join(' ');
}

function getJoinColor(joinIndex: number): string {
  const hue = Math.round((joinIndex * 137.508) % 360);
  return `hsl(${hue}, 68%, 60%)`;
}

function SchemaCell({
  value,
  disabled,
  options,
  onChange,
  onOpenDropdown,
  suffix,
  variant = 'plain',
}: {
  value: string;
  disabled: boolean;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
  onOpenDropdown?: () => void;
  suffix?: ReactNode;
  variant?: 'plain' | 'outlined';
}) {
  const [editing, setEditing] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [hoveredOptionValue, setHoveredOptionValue] = useState<string | null>(null);
  const blurTimeoutRef = useRef<number | null>(null);
  const editorInputRef = useRef<HTMLInputElement | null>(null);
  const visibleOptions = searchValue
    ? options.filter(option => option.label.toLowerCase().includes(searchValue.toLowerCase()))
    : options;
  const displayValue = options.find(option => option.value === value)?.label ?? value;

  const startEditing = (openDropdown = false) => {
    if (openDropdown) {
      onOpenDropdown?.();
    }

    setSearchValue(displayValue);
    setEditing(true);
    setDropdownOpen(openDropdown);
  };

  const stopEditing = () => {
    if (blurTimeoutRef.current !== null) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setEditing(false);
    setDropdownOpen(false);
    setSearchValue('');
    setHoveredOptionValue(null);
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
      setSearchValue(displayValue);
    }
  }, [displayValue, editing]);

  useLayoutEffect(() => {
    if (editing && !disabled) {
      const input = editorInputRef.current;

      if (input) {
        const caretPosition = input.value.length;
        input.focus();
        input.setSelectionRange(caretPosition, caretPosition);
      }
    }
  }, [disabled, editing]);

  if (editing && !disabled) {
    return (
      <div
        style={{
          ...styles.schemaEditorShell,
          ...(variant === 'outlined' ? styles.schemaEditorShellOutlined : null),
        }}
      >
        <input
          ref={editorInputRef}
          value={searchValue}
          style={styles.schemaEditorInput}
          spellCheck={false}
          onChange={event => {
            setSearchValue(event.target.value);
            setDropdownOpen(true);
          }}
          onFocus={() => {
            if (blurTimeoutRef.current !== null) {
              window.clearTimeout(blurTimeoutRef.current);
              blurTimeoutRef.current = null;
            }
          }}
          onBlur={() => {
            blurTimeoutRef.current = window.setTimeout(() => {
              stopEditing();
            }, 0);
          }}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              stopEditing();
            }

            if (event.key === 'Enter') {
              const matchingOption = visibleOptions[0];

              if (matchingOption) {
                onChange(matchingOption.value);
              }

              stopEditing();
            }
          }}
        />
        <button
          type="button"
          style={styles.schemaEditorArrowButton}
          onMouseDown={event => {
            event.preventDefault();
          }}
          onClick={() => {
            const nextDropdownOpen = !dropdownOpen;

            if (nextDropdownOpen) {
              onOpenDropdown?.();
            }

            setDropdownOpen(nextDropdownOpen);
            editorInputRef.current?.focus();
          }}
        >
          <ChevronDown size={14} strokeWidth={1.8} />
        </button>
        {dropdownOpen && visibleOptions.length > 0 && (
          <div style={styles.schemaDropdown}>
            {visibleOptions.map(option => (
              <button
                key={option.value}
                type="button"
                style={{
                  ...styles.schemaDropdownOption,
                  ...(option.value === value ? styles.schemaDropdownOptionSelected : null),
                  ...(option.value === hoveredOptionValue ? styles.schemaDropdownOptionHovered : null),
                }}
                onMouseDown={event => {
                  event.preventDefault();
                }}
                onMouseEnter={() => {
                  setHoveredOptionValue(option.value);
                }}
                onMouseLeave={() => {
                  setHoveredOptionValue(currentValue => currentValue === option.value ? null : currentValue);
                }}
                onClick={() => {
                  onChange(option.value);
                  stopEditing();
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      role={disabled ? undefined : 'button'}
      tabIndex={disabled ? -1 : 0}
      style={{
        ...styles.schemaCellButton,
        ...(variant === 'outlined' ? styles.schemaCellButtonOutlined : null),
        ...(disabled ? styles.schemaCellButtonDisabled : null),
      }}
      onClick={() => {
        if (!disabled) {
          startEditing(false);
        }
      }}
      onKeyDown={event => {
        if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          startEditing(false);
        }
      }}
    >
      <span
        style={{
          ...styles.schemaCellLabel,
          ...(value ? styles.schemaCellLabelFilled : styles.schemaCellLabelPlaceholder),
        }}
      >
        {displayValue}
      </span>
      {suffix}
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
              startEditing(true);
            }
          }}
        >
          <ChevronDown size={14} strokeWidth={1.8} />
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

function TabDirtyIndicator() {
  return <span aria-label="Unsaved changes" style={styles.tabDirtyIndicator} />;
}

function ScopeSelect({
  value,
  scopes,
  onChange,
}: {
  value: number;
  scopes: ScopeEntry[];
  onChange: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const blurTimeoutRef = useRef<number | null>(null);

  const close = () => {
    setOpen(false);
    setHoveredIndex(null);
  };

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div style={styles.scopeSelectShell}>
      <button
        type="button"
        style={styles.scopeSelectTrigger}
        onClick={() => setOpen(o => !o)}
        onBlur={() => {
          blurTimeoutRef.current = window.setTimeout(close, 0);
        }}
        onFocus={() => {
          if (blurTimeoutRef.current !== null) {
            window.clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
          }
        }}
      >
        <span style={styles.schemaCellLabel}>{scopes[value]?.path ?? ''}</span>
        <ChevronDown size={13} strokeWidth={1.8} style={{ flexShrink: 0 }} />
      </button>
      {open && (
        <div style={styles.scopeSelectDropdown}>
          {scopes.map((scope, i) => (
            <button
              key={scope.path}
              type="button"
              style={{
                ...styles.schemaDropdownOption,
                ...(i === value ? styles.schemaDropdownOptionSelected : null),
                ...(i === hoveredIndex ? styles.schemaDropdownOptionHovered : null),
              }}
              onMouseDown={event => event.preventDefault()}
              onClick={() => { onChange(i); close(); }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {scope.path}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function JoinDefinitionModal({
  open,
  scopes,
  schemasStatus,
  schemas,
  columnsByTable,
  columnsStatusByTable,
  tablesBySchema,
  tablesStatusBySchema,
  joins,
  endpointId,
  onLoadTables,
  onLoadColumns,
  onChangeJoins,
  onClose,
}: {
  open: boolean;
  scopes: ScopeEntry[];
  schemasStatus: MappingWorkspaceTab['schemasStatus'];
  schemas: string[];
  columnsByTable: MappingWorkspaceTab['columnsByTable'];
  columnsStatusByTable: MappingWorkspaceTab['columnsStatusByTable'];
  tablesBySchema: MappingWorkspaceTab['tablesBySchema'];
  tablesStatusBySchema: MappingWorkspaceTab['tablesStatusBySchema'];
  joins: JoinEntryDto[];
  endpointId: number;
  onLoadTables: (endpointId: number, schemaName: string) => void;
  onLoadColumns: (endpointId: number, schemaName: string, tableName: string) => void;
  onChangeJoins: (joins: JoinEntryDto[]) => void;
  onClose: () => void;
}) {
  const diagramRef = useRef<HTMLDivElement | null>(null);
  const columnButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const deleteSelectedJoinRef = useRef<() => void>(() => {});
  const joinsRef = useRef(joins);
  const draggingStateRef = useRef<{
    tableKey: string;
    startMouseX: number;
    startMouseY: number;
    startTableX: number;
    startTableY: number;
  } | null>(null);
  joinsRef.current = joins;
  const [edgePoints, setEdgePoints] = useState<Record<string, JoinEdgePoint>>({});
  const [pendingColumnPath, setPendingColumnPath] = useState<string | null>(null);
  const [hoveredColumnPath, setHoveredColumnPath] = useState<string | null>(null);
  const [selectedJoinIndex, setSelectedJoinIndex] = useState<number | null>(null);
  const [selectedScopeIndex, setSelectedScopeIndex] = useState(0);
  const [extraTables, setExtraTables] = useState<SelectedJoinTable[]>([]);
  const [tablePositions, setTablePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [addTableSchema, setAddTableSchema] = useState('');
  const [addTableTable, setAddTableTable] = useState('');

  const currentScope = scopes[selectedScopeIndex] ?? { path: '/', tables: [] };
  const scopeTables = currentScope.tables;
  const scopeTableKeys = new Set(scopeTables.map(t => t.key));
  const allTables = [
    ...scopeTables,
    ...extraTables.filter(t => !scopeTableKeys.has(t.key)),
  ];
  const tablesSignature = allTables.map(t => t.key).join('|');
  const allTableKeys = new Set(allTables.map(t => t.key));

  const schemaOptions = schemas.map(s => ({ label: s, value: s }));

  const visibleJoins = joins
    .map((join, index) => ({ join, index }))
    .filter(({ join }) => (
      allTableKeys.has(getTableKeyFromColumnPath(join.left) ?? '')
      && allTableKeys.has(getTableKeyFromColumnPath(join.right) ?? '')
    ));

  const updateEdgePoints = () => {
    const diagram = diagramRef.current;
    if (!diagram) {
      return;
    }

    const diagramRect = diagram.getBoundingClientRect();
    const nextPoints: Record<string, JoinEdgePoint> = {};

    Object.entries(columnButtonRefs.current).forEach(([columnPath, element]) => {
      if (!element) {
        return;
      }

      const rect = element.getBoundingClientRect();
      nextPoints[columnPath] = {
        key: columnPath,
        x: rect.left - diagramRect.left + rect.width / 2,
        y: rect.top - diagramRect.top + rect.height / 2,
        leftX: rect.left - diagramRect.left,
        rightX: rect.right - diagramRect.left,
      };
    });

    setEdgePoints(nextPoints);
  };

  // Reset UI state when modal opens or scope changes
  useEffect(() => {
    if (!open) {
      return;
    }
    setPendingColumnPath(null);
    setSelectedJoinIndex(null);
    setHoveredColumnPath(null);
  }, [open, tablesSignature]);

  // Reset to first scope and clear selection on open
  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedScopeIndex(0);
  }, [open]);

  // Re-derive extraTables from persisted joins whenever scope or open changes,
  // so previously-defined junction tables always reappear automatically.
  useEffect(() => {
    if (!open) {
      return;
    }
    const currentScopeTableKeys = new Set(currentScope.tables.map(t => t.key));
    const seen = new Set<string>();
    const fromJoins: SelectedJoinTable[] = [];

    joinsRef.current.forEach(join => {
      [join.left, join.right].forEach(path => {
        if (!path) {
          return;
        }
        const tableKey = getTableKeyFromColumnPath(path);
        if (tableKey && !currentScopeTableKeys.has(tableKey) && !seen.has(tableKey)) {
          seen.add(tableKey);
          const parsed = parseTableKey(tableKey);
          if (parsed) {
            fromJoins.push(parsed);
          }
        }
      });
    });

    setExtraTables(fromJoins);
    setAddTableSchema('');
    setAddTableTable('');
  }, [open, selectedScopeIndex]);

  // Guard scope index against out-of-bounds when scopes change
  useEffect(() => {
    if (selectedScopeIndex >= scopes.length && scopes.length > 0) {
      setSelectedScopeIndex(0);
    }
  }, [scopes.length, selectedScopeIndex]);

  // Initialise / extend table positions when allTables changes
  useEffect(() => {
    setTablePositions(prev => {
      const next: Record<string, { x: number; y: number }> = {};
      allTables.forEach((table, index) => {
        next[table.key] = prev[table.key] ?? { x: 24 + index * (TABLE_CARD_WIDTH + 28), y: 24 };
      });
      return next;
    });
  }, [tablesSignature]);

  // Global drag move / release
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const ds = draggingStateRef.current;
      if (!ds) {
        return;
      }
      const x = Math.max(0, ds.startTableX + (e.clientX - ds.startMouseX));
      const y = Math.max(0, ds.startTableY + (e.clientY - ds.startMouseY));
      setTablePositions(prev => ({ ...prev, [ds.tableKey]: { x, y } }));
    };
    const handleMouseUp = () => {
      if (draggingStateRef.current) {
        draggingStateRef.current = null;
        document.body.style.cursor = '';
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    updateEdgePoints();
  }, [columnsByTable, joins, open, tablesSignature, tablePositions]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    window.addEventListener('resize', updateEdgePoints);
    return () => window.removeEventListener('resize', updateEdgePoints);
  }, [open]);

  // Load columns for every table currently shown in the diagram
  useEffect(() => {
    if (!open) {
      return;
    }
    allTables.forEach(table => {
      if ((columnsStatusByTable[table.key] ?? 'idle') === 'idle') {
        onLoadColumns(endpointId, table.schemaName, table.tableName);
      }
    });
  }, [open, tablesSignature, columnsStatusByTable, endpointId, onLoadColumns]);

  const removeExtraTable = (tableKey: string) => {
    setExtraTables(prev => prev.filter(t => t.key !== tableKey));
    const nextJoins = joinsRef.current.filter(join =>
      getTableKeyFromColumnPath(join.left) !== tableKey &&
      getTableKeyFromColumnPath(join.right) !== tableKey,
    );
    onChangeJoins(nextJoins);
    setSelectedJoinIndex(prev => {
      if (prev === null) {
        return null;
      }
      const join = joinsRef.current[prev];
      if (!join) {
        return null;
      }
      return getTableKeyFromColumnPath(join.left) === tableKey
        || getTableKeyFromColumnPath(join.right) === tableKey
        ? null
        : prev;
    });
  };

  const handleAddTable = () => {
    if (!addTableSchema || !addTableTable) {
      return;
    }
    const tableKey = createTableKey(addTableSchema, addTableTable);
    if (!allTables.find(t => t.key === tableKey)) {
      const parsed = parseTableKey(tableKey);
      if (parsed) {
        setExtraTables(prev => [...prev, parsed]);
        if ((columnsStatusByTable[tableKey] ?? 'idle') === 'idle') {
          onLoadColumns(endpointId, addTableSchema, addTableTable);
        }
      }
    }
    setAddTableOpen(false);
    setAddTableSchema('');
    setAddTableTable('');
  };

  // Delete selected join via keyboard
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete') {
        return;
      }
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return;
      }
      deleteSelectedJoinRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (!open) {
    return null;
  }

  const edgeLines = visibleJoins
    .map<JoinEdgeLine | null>(({ join, index }) => {
      const leftPoint = join.left ? edgePoints[join.left] : undefined;
      const rightPoint = join.right ? edgePoints[join.right] : undefined;

      return leftPoint && rightPoint
        ? { join, joinIndex: index, leftPoint, rightPoint }
        : null;
    })
    .filter((line): line is JoinEdgeLine => line !== null);

  const selectedJoin = selectedJoinIndex !== null ? joins[selectedJoinIndex] : null;

  const columnJoinColors = new Map<string, string>();
  visibleJoins.forEach(({ join, index }) => {
    const color = getJoinColor(index);
    if (join.left) columnJoinColors.set(join.left, color);
    if (join.right) columnJoinColors.set(join.right, color);
  });

  const columnPathOptions = allTables.flatMap(table => (columnsByTable[table.key] ?? []).map(column => {
    const columnPath = createColumnPath(table.schemaName, table.tableName, column.name);
    return { label: columnPath, value: columnPath };
  }));

  const handleTableDragStart = (e: ReactMouseEvent<HTMLDivElement>, tableKey: string) => {
    if (e.target instanceof Element && (e.target as Element).closest('button')) {
      return;
    }
    e.preventDefault();
    const pos = tablePositions[tableKey] ?? { x: 0, y: 0 };
    draggingStateRef.current = {
      tableKey,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startTableX: pos.x,
      startTableY: pos.y,
    };
    document.body.style.cursor = 'grabbing';
  };

  const selectEdgeFromDiagramClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    if (target.closest('[data-join-table="true"]') || target.tagName === 'path') {
      return;
    }
    setSelectedJoinIndex(null);
  };

  const handleColumnClick = (columnPath: string) => {
    if (!pendingColumnPath) {
      setPendingColumnPath(columnPath);
      return;
    }

    if (pendingColumnPath === columnPath) {
      setPendingColumnPath(null);
      return;
    }

    const pendingTableKey = getTableKeyFromColumnPath(pendingColumnPath);
    const nextTableKey = getTableKeyFromColumnPath(columnPath);

    if (!pendingTableKey || !nextTableKey || pendingTableKey === nextTableKey) {
      setPendingColumnPath(columnPath);
      return;
    }

    const existingJoinIndex = joins.findIndex(join => (
      (join.left === pendingColumnPath && join.right === columnPath)
      || (join.left === columnPath && join.right === pendingColumnPath)
    ));

    if (existingJoinIndex >= 0) {
      setSelectedJoinIndex(existingJoinIndex);
      setPendingColumnPath(null);
      return;
    }

    const nextJoins = [
      ...joins,
      {
        left: pendingColumnPath,
        right: columnPath,
        additionalJoinConditions: [],
      },
    ];

    onChangeJoins(nextJoins);
    setSelectedJoinIndex(nextJoins.length - 1);
    setPendingColumnPath(null);
  };

  const deleteSelectedJoin = () => {
    if (selectedJoinIndex === null) {
      return;
    }
    onChangeJoins(joins.filter((_, index) => index !== selectedJoinIndex));
    setSelectedJoinIndex(null);
  };

  deleteSelectedJoinRef.current = deleteSelectedJoin;

  const updateSelectedJoin = (nextJoin: JoinEntryDto) => {
    if (selectedJoinIndex === null) {
      return;
    }
    onChangeJoins(joins.map((join, index) => (
      index === selectedJoinIndex ? nextJoin : join
    )));
  };

  const addAdditionalCondition = () => {
    if (!selectedJoin) {
      return;
    }
    updateSelectedJoin({
      ...selectedJoin,
      additionalJoinConditions: [
        ...(selectedJoin.additionalJoinConditions ?? []),
        {
          left: selectedJoin.left ?? '',
          operator: 'EQ',
          right: selectedJoin.right ?? '',
        },
      ],
    });
  };

  const updateAdditionalCondition = (
    conditionIndex: number,
    patch: Partial<JoinConditionPairDto>,
  ) => {
    if (!selectedJoin) {
      return;
    }
    updateSelectedJoin({
      ...selectedJoin,
      additionalJoinConditions: (selectedJoin.additionalJoinConditions ?? []).map((condition, index) => (
        index === conditionIndex ? { ...condition, ...patch } : condition
      )),
    });
  };

  const removeAdditionalCondition = (conditionIndex: number) => {
    if (!selectedJoin) {
      return;
    }
    updateSelectedJoin({
      ...selectedJoin,
      additionalJoinConditions: (selectedJoin.additionalJoinConditions ?? []).filter((_, index) => index !== conditionIndex),
    });
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.joinModal}>

        {/* Row 1 — title + scope + close */}
        <div style={styles.joinModalHeader}>
          <span style={styles.joinModalTitle}>Define joins</span>
          <div style={styles.joinScopeRow}>
            <span style={styles.joinScopeLabel}>Scope</span>
            <ScopeSelect
              value={selectedScopeIndex}
              scopes={scopes}
              onChange={setSelectedScopeIndex}
            />
          </div>
          <button type="button" style={styles.joinModalCloseButton} onClick={onClose}>
            <CloseOutlined />
          </button>
        </div>

        {/* Row 2 — add table controls */}
        <div style={styles.joinAddTableRow}>
          <SchemaCell
            value={addTableSchema}
            options={schemaOptions}
            disabled={schemasStatus !== 'ready' || schemas.length === 0}
            variant="outlined"
            onChange={value => {
              setAddTableSchema(value);
              setAddTableTable('');
              if (value && (tablesStatusBySchema[value] ?? 'idle') === 'idle') {
                onLoadTables(endpointId, value);
              }
            }}
          />
          <SchemaCell
            value={addTableTable}
            options={(tablesBySchema[addTableSchema] ?? []).map(t => ({ label: t, value: t }))}
            disabled={!addTableSchema}
            variant="outlined"
            onOpenDropdown={() => {
              if (addTableSchema && (tablesStatusBySchema[addTableSchema] ?? 'idle') === 'idle') {
                onLoadTables(endpointId, addTableSchema);
              }
            }}
            onChange={setAddTableTable}
          />
          <button
            type="button"
            style={{
              ...styles.joinModalActionButton,
              ...(!addTableSchema || !addTableTable ? styles.gridHeaderActionButtonDisabled : null),
            }}
            disabled={!addTableSchema || !addTableTable}
            onClick={handleAddTable}
          >
            Add to tables space
          </button>
        </div>

        {/* Row 3 — diagram canvas, fills remaining height */}
        <div style={styles.joinDiagram}>
          <div style={styles.joinTableCanvas} onScroll={updateEdgePoints}>
            <div
              ref={diagramRef}
              style={{
                ...styles.joinTableCanvasContent,
                width: Math.max(800, ...allTables.map(t => (tablePositions[t.key]?.x ?? 0) + TABLE_CARD_WIDTH + 60)),
                height: Math.max(500, ...allTables.map(t => (tablePositions[t.key]?.y ?? 0) + 400)),
              }}
              onClick={selectEdgeFromDiagramClick}
            >
              <svg style={styles.joinDiagramSvg}>
                {edgeLines.map(line => {
                  const selected = line.joinIndex === selectedJoinIndex;
                  const d = buildEdgePath(line.leftPoint, line.rightPoint);
                  return (
                    <g key={`${line.join.left}-${line.join.right}`}>
                      <path
                        d={d}
                        style={styles.joinEdgeHitArea}
                        onClick={() => setSelectedJoinIndex(line.joinIndex)}
                      />
                      <path
                        d={d}
                        style={selected ? styles.joinEdgeSelected : styles.joinEdge}
                      />
                    </g>
                  );
                })}
              </svg>

              {allTables.map(table => {
                const pos = tablePositions[table.key] ?? { x: 0, y: 0 };
                const columns = columnsByTable[table.key] ?? [];
                const colStatus = columnsStatusByTable[table.key] ?? 'idle';
                const isExtra = !scopeTableKeys.has(table.key);
                return (
                  <div
                    key={table.key}
                    data-join-table="true"
                    style={{ ...styles.joinDiagramTable, left: pos.x, top: pos.y }}
                  >
                    <div
                      style={styles.joinDiagramTableHeader}
                      onMouseDown={e => handleTableDragStart(e, table.key)}
                    >
                      <span style={styles.joinDiagramTableName}>{table.schemaName}.{table.tableName}</span>
                      {isExtra && (
                        <button
                          type="button"
                          style={styles.joinDiagramTableRemove}
                          title="Remove table"
                          onClick={() => removeExtraTable(table.key)}
                        >
                          <CloseOutlined />
                        </button>
                      )}
                    </div>
                    <div style={styles.joinDiagramColumnList}>
                      {colStatus === 'error' ? (
                        <span style={styles.joinDiagramEmptyColumns}>Failed to load columns.</span>
                      ) : columns.length === 0 ? (
                        <span style={styles.joinDiagramEmptyColumns}>Loading columns...</span>
                      ) : columns.map(column => {
                        const columnPath = createColumnPath(table.schemaName, table.tableName, column.name);
                        const isPending = pendingColumnPath === columnPath;
                        const isHovered = hoveredColumnPath === columnPath && !isPending;
                        const isTarget = pendingColumnPath !== null
                          && hoveredColumnPath === columnPath
                          && getTableKeyFromColumnPath(pendingColumnPath) !== getTableKeyFromColumnPath(columnPath);
                        const isSelectedMember = selectedJoin !== null
                          && (selectedJoin.left === columnPath || selectedJoin.right === columnPath);
                        return (
                          <button
                            key={columnPath}
                            ref={element => { columnButtonRefs.current[columnPath] = element; }}
                            type="button"
                            style={{
                              ...styles.joinDiagramColumn,
                              ...(isPending ? styles.joinDiagramColumnPending : null),
                              ...(isTarget ? styles.joinDiagramColumnTarget : null),
                              ...(isHovered ? styles.joinDiagramColumnHovered : null),
                              ...(isSelectedMember ? styles.joinDiagramColumnSelectedMember : null),
                            }}
                            onClick={() => handleColumnClick(columnPath)}
                            onMouseEnter={() => setHoveredColumnPath(columnPath)}
                            onMouseLeave={() => setHoveredColumnPath(null)}
                          >
                            <span
                            style={{
                              ...styles.joinDiagramHandle,
                              ...(columnJoinColors.has(columnPath) ? {
                                background: columnJoinColors.get(columnPath),
                                borderColor: columnJoinColors.get(columnPath),
                                boxShadow: `0 0 5px ${columnJoinColors.get(columnPath)}80`,
                              } : null),
                            }}
                          />
                            <span style={styles.joinDiagramColumnName}>
                              <span>{column.name}</span>
                              {column.primaryKey && <KeyOutlined style={styles.primaryKeyIcon} />}
                            </span>
                            <span style={styles.joinDiagramColumnType}>{column.dataType ?? ''}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 4 — join conditions panel */}
        <div style={styles.joinBottomPanel}>
          {selectedJoin ? (
            <>
              <div style={styles.joinBottomPanelHeader}>
                <span style={styles.joinSidePanelTitle}>Join conditions</span>
                <span style={styles.joinInspectorPath}>{selectedJoin.left}</span>
                <span style={styles.joinInspectorOperator}>=</span>
                <span style={styles.joinInspectorPath}>{selectedJoin.right}</span>
                <div style={{ flex: 1 }} />
                <button type="button" style={styles.joinModalActionButton} onClick={addAdditionalCondition}>
                  Add condition
                </button>
                <button type="button" style={styles.joinDeleteButton} onClick={deleteSelectedJoin}>
                  Remove join
                </button>
              </div>
              {(selectedJoin.additionalJoinConditions ?? []).length > 0 && (
                <div style={styles.joinBottomConditionsList}>
                  {(selectedJoin.additionalJoinConditions ?? []).map((condition, conditionIndex) => (
                    <div key={conditionIndex} style={styles.joinConditionCard}>
                      <SchemaCell
                        value={condition.left}
                        options={columnPathOptions}
                        disabled={columnPathOptions.length === 0}
                        variant="outlined"
                        onChange={value => updateAdditionalCondition(conditionIndex, { left: value })}
                      />
                      <SchemaCell
                        value={condition.operator}
                        options={JOIN_OPERATOR_OPTIONS}
                        disabled={false}
                        variant="outlined"
                        onChange={value => updateAdditionalCondition(conditionIndex, { operator: value as JoinConditionPairDto['operator'] })}
                      />
                      <SchemaCell
                        value={condition.right ?? ''}
                        options={columnPathOptions}
                        disabled={columnPathOptions.length === 0}
                        variant="outlined"
                        onChange={value => updateAdditionalCondition(conditionIndex, {
                          right: value,
                          rightLiteral: undefined,
                          rightValues: undefined,
                        })}
                      />
                      <button type="button" style={styles.joinConditionRemoveButton} onClick={() => removeAdditionalCondition(conditionIndex)}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <span style={styles.joinModalNote}>
              Click a column, then a column in another table to create a join.
            </span>
          )}
        </div>

        {/* Row 5 — footer */}
        <div style={styles.joinModalFooter}>
          <button type="button" style={styles.joinModalActionButton} onClick={onClose}>
            Close
          </button>
        </div>

      </div>
    </div>
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
      {tab.isDirty ? <TabDirtyIndicator /> : <TabCloseButton onClick={onClose} />}
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

function flattenMappingEntries(entries: MappingFieldEntry[], prefix = ''): MappingFieldEntry[] {
  return entries.flatMap(entry => {
    const fieldPath = prefix ? `${prefix}.${entry.serviceInfo.modelField}` : entry.serviceInfo.modelField;
    const currentEntry = {
      ...entry,
      serviceInfo: {
        ...entry.serviceInfo,
        modelField: fieldPath,
      },
    };

    if (entry.fieldMappings && entry.fieldMappings.length > 0) {
      return [currentEntry, ...flattenMappingEntries(entry.fieldMappings, fieldPath)];
    }

    return [currentEntry];
  });
}

function parseColumnPath(columnPath: string | undefined): { schema: string; table: string; column: string } {
  if (!columnPath) {
    return { schema: '', table: '', column: '' };
  }

  const [schema = '', table = '', column = ''] = columnPath.split('.');
  return { schema, table, column };
}

function updateMappingColumnPaths(
  mapping: MappingDto,
  serviceRows: MappingGridRow[],
  selectedSchemas: string[],
  selectedTables: string[],
  selectedColumns: string[],
  selectedColumnTypes: string[],
  selectedPrimaryKeys: boolean[],
): MappingDto {
  const columnPathByField = new Map<string, string | undefined>();
  const columnTypeByField = new Map<string, string | undefined>();
  const primaryKeyByField = new Map<string, boolean>();

  serviceRows.forEach((row, index) => {
    const schema = selectedSchemas[index] ?? '';
    const table = selectedTables[index] ?? '';
    const column = selectedColumns[index] ?? '';
    const columnType = selectedColumnTypes[index] ?? '';
    const primaryKey = selectedPrimaryKeys[index] ?? false;
    const columnPath = schema && table && column
      ? `${schema}.${table}.${column}`
      : schema && table
        ? `${schema}.${table}`
        : schema || undefined;
    columnPathByField.set(row.name, columnPath);
    columnTypeByField.set(row.name, columnType || undefined);
    primaryKeyByField.set(row.name, primaryKey);
  });

  const updateEntries = (entries: MappingFieldEntry[], prefix = ''): MappingFieldEntry[] => entries.map(entry => {
    const fieldPath = prefix ? `${prefix}.${entry.serviceInfo.modelField}` : entry.serviceInfo.modelField;
    const nextEntry: MappingFieldEntry = { ...entry };

    if (columnPathByField.has(fieldPath)) {
      const columnPath = columnPathByField.get(fieldPath);

      if (columnPath) {
        const columnType = columnTypeByField.get(fieldPath);
        const primaryKey = primaryKeyByField.get(fieldPath) ?? false;
        nextEntry.databaseInfo = {
          ...nextEntry.databaseInfo,
          columnPath,
        };
        if (columnType) {
          nextEntry.databaseInfo.columnType = columnType;
        } else {
          delete nextEntry.databaseInfo.columnType;
        }
        nextEntry.databaseInfo.primaryKey = primaryKey;
      } else {
        const databaseInfo = { ...(nextEntry.databaseInfo ?? {}) };
        delete databaseInfo.columnPath;
        delete databaseInfo.columnType;
        delete databaseInfo.primaryKey;
        nextEntry.databaseInfo = Object.keys(databaseInfo).length > 0 ? databaseInfo : undefined;
      }
    }

    if (entry.fieldMappings) {
      nextEntry.fieldMappings = updateEntries(entry.fieldMappings, fieldPath);
    }

    return nextEntry;
  });

  return {
    ...mapping,
    fieldMappings: updateEntries(mapping.fieldMappings),
  };
}

function getRowsFromMapping(mapping: MappingDto | null): MappingGridRow[] {
  if (!mapping) {
    return [];
  }

  return flattenMappingEntries(mapping.fieldMappings)
    .filter(entry => !entry.fieldMappings || entry.fieldMappings.length === 0)
    .map(entry => ({
      name: entry.serviceInfo.modelField,
      type: entry.serviceInfo.type ?? '',
      format: entry.serviceInfo.format ?? '',
    }));
}

function MappingGrid({
  endpointId,
  mapping,
  serviceRows,
  schemasStatus,
  schemas,
  schemasError,
  tablesBySchema,
  tablesStatusBySchema,
  tablesErrorBySchema,
  columnsByTable,
  columnsStatusByTable,
  columnsErrorByTable,
  onLoadTables,
  onLoadColumns,
  onChangeMapping,
}: {
  endpointId: number;
  mapping: MappingDto | null;
  serviceRows: MappingGridRow[];
  schemasStatus: MappingWorkspaceTab['schemasStatus'];
  schemas: string[];
  schemasError: string | null;
  tablesBySchema: MappingWorkspaceTab['tablesBySchema'];
  tablesStatusBySchema: MappingWorkspaceTab['tablesStatusBySchema'];
  tablesErrorBySchema: MappingWorkspaceTab['tablesErrorBySchema'];
  columnsByTable: MappingWorkspaceTab['columnsByTable'];
  columnsStatusByTable: MappingWorkspaceTab['columnsStatusByTable'];
  columnsErrorByTable: MappingWorkspaceTab['columnsErrorByTable'];
  onLoadTables: (endpointId: number, schemaName: string) => void;
  onLoadColumns: (endpointId: number, schemaName: string, tableName: string) => void;
  onChangeMapping: (endpointId: number, mapping: MappingDto) => void;
}) {
  const serviceRowCount = Math.max(EMPTY_GRID_ROWS, serviceRows.length);
  const databaseRowCount = Math.max(EMPTY_GRID_ROWS, serviceRows.length);
  const [selectedSchemas, setSelectedSchemas] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [selectedColumnTypes, setSelectedColumnTypes] = useState<string[]>([]);
  const [selectedPrimaryKeys, setSelectedPrimaryKeys] = useState<boolean[]>([]);
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  useEffect(() => {
    const flattenedEntries = mapping ? flattenMappingEntries(mapping.fieldMappings) : [];

    setSelectedSchemas(Array.from({ length: databaseRowCount }, (_, index) => {
      const row = serviceRows[index];
      const entry = row ? flattenedEntries.find(item => item.serviceInfo.modelField === row.name) : null;
      return parseColumnPath(entry?.databaseInfo?.columnPath).schema;
    }));

    setSelectedTables(Array.from({ length: databaseRowCount }, (_, index) => {
      const row = serviceRows[index];
      const entry = row ? flattenedEntries.find(item => item.serviceInfo.modelField === row.name) : null;
      return parseColumnPath(entry?.databaseInfo?.columnPath).table;
    }));

    setSelectedColumns(Array.from({ length: databaseRowCount }, (_, index) => {
      const row = serviceRows[index];
      const entry = row ? flattenedEntries.find(item => item.serviceInfo.modelField === row.name) : null;
      return parseColumnPath(entry?.databaseInfo?.columnPath).column;
    }));

    setSelectedColumnTypes(Array.from({ length: databaseRowCount }, (_, index) => {
      const row = serviceRows[index];
      const entry = row ? flattenedEntries.find(item => item.serviceInfo.modelField === row.name) : null;
      return entry?.databaseInfo?.columnType ?? '';
    }));

    setSelectedPrimaryKeys(Array.from({ length: databaseRowCount }, (_, index) => {
      const row = serviceRows[index];
      const entry = row ? flattenedEntries.find(item => item.serviceInfo.modelField === row.name) : null;
      return entry?.databaseInfo?.primaryKey ?? false;
    }));
  }, [databaseRowCount, mapping, serviceRows]);

  const schemaOptions = schemas.map(schema => ({
    label: schema,
    value: schema,
  }));

  const emitMappingChange = (
    nextSchemas: string[],
    nextTables: string[],
    nextColumns: string[],
    nextColumnTypes: string[],
    nextPrimaryKeys: boolean[],
  ) => {
    if (!mapping) {
      return;
    }

    const resolvedPrimaryKeys = nextColumns.map((columnName, index) => {
      const schemaName = nextSchemas[index] ?? '';
      const tableName = nextTables[index] ?? '';

      if (!schemaName || !tableName || !columnName) {
        return false;
      }

      const tableKey = createTableKey(schemaName, tableName);
      const columnInfo = (columnsByTable[tableKey] ?? []).find(column => column.name === columnName);
      return columnInfo?.primaryKey ?? nextPrimaryKeys[index] ?? false;
    });

    onChangeMapping(
      endpointId,
      updateMappingColumnPaths(
        mapping,
        serviceRows,
        nextSchemas,
        nextTables,
        nextColumns,
        nextColumnTypes,
        resolvedPrimaryKeys,
      ),
    );
  };

  const emitJoinsChange = (joins: JoinEntryDto[]) => {
    if (!mapping) {
      return;
    }

    onChangeMapping(endpointId, {
      ...mapping,
      joins,
    });
  };

  const scopes = useMemo(
    () => getScopesFromMapping(mapping, selectedSchemas, selectedTables, serviceRows),
    [mapping, selectedSchemas, selectedTables, serviceRows],
  );

  useEffect(() => {
    setSelectedPrimaryKeys(currentPrimaryKeys => currentPrimaryKeys.map((currentPrimaryKey, index) => {
      const schemaName = selectedSchemas[index] ?? '';
      const tableName = selectedTables[index] ?? '';
      const columnName = selectedColumns[index] ?? '';

      if (!schemaName || !tableName || !columnName) {
        return false;
      }

      const tableKey = createTableKey(schemaName, tableName);
      const columnInfo = (columnsByTable[tableKey] ?? []).find(column => column.name === columnName);
      return columnInfo?.primaryKey ?? currentPrimaryKey;
    }));
  }, [columnsByTable, selectedColumns, selectedSchemas, selectedTables]);

  return (
    <>
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
        <div style={styles.gridSectionHeader}>
          <span>Database</span>
          <div style={styles.gridHeaderActions}>
            <button
              type="button"
              style={styles.gridHeaderActionButton}
              onClick={() => setJoinModalOpen(true)}
            >
              Joins
            </button>
          </div>
        </div>
        <div style={styles.databaseGridHeaderRow}>
          <span style={styles.gridHeaderCell}>Schema</span>
          <span style={styles.gridHeaderCell}>Table</span>
          <span style={styles.gridHeaderCell}>Column</span>
          <span style={styles.gridHeaderCell}>Type</span>
        </div>
        {Array.from({ length: databaseRowCount }).map((_, index) => {
          const serviceRow = serviceRows[index];

          if (!serviceRow) {
            return (
              <div key={`database-${index}`} style={styles.databaseGridRow}>
                <span style={styles.gridCellText} />
                <span style={styles.gridCellText} />
                <span style={styles.gridCellText} />
                <span style={styles.gridCellTextMuted} />
              </div>
            );
          }

          const selectedSchema = selectedSchemas[index] ?? '';
          const selectedTable = selectedTables[index] ?? '';
          const selectedColumn = selectedColumns[index] ?? '';
          const selectedColumnType = selectedColumnTypes[index] ?? '';
          const selectedPrimaryKey = selectedPrimaryKeys[index] ?? false;
          const tableKey = selectedSchema && selectedTable ? createTableKey(selectedSchema, selectedTable) : '';
          const tablesStatus = selectedSchema ? (tablesStatusBySchema[selectedSchema] ?? 'idle') : 'idle';
          const columnsStatus = tableKey ? (columnsStatusByTable[tableKey] ?? 'idle') : 'idle';
          const columns = tableKey ? (columnsByTable[tableKey] ?? []) : [];
          const tableOptions = (tablesBySchema[selectedSchema] ?? []).map(table => ({
            label: table,
            value: table,
          }));
          const columnOptions = columns.map(column => ({
            label: column.name,
            value: column.name,
          }));
          const selectedColumnInfo = columns.find(column => column.name === selectedColumn);

          return (
            <div key={`database-${index}`} style={styles.databaseGridRow}>
              <span style={styles.schemaGridCell}>
                <SchemaCell
                  value={selectedSchemas[index] ?? ''}
                  options={schemaOptions}
                  disabled={schemasStatus !== 'ready' || schemas.length === 0}
                  onChange={value => {
                    const nextSchemas = [...selectedSchemas];
                    const previousSchema = nextSchemas[index] ?? '';
                    nextSchemas[index] = value;

                    const nextTables = [...selectedTables];
                    const nextColumns = [...selectedColumns];
                    const nextColumnTypes = [...selectedColumnTypes];
                    const nextPrimaryKeys = [...selectedPrimaryKeys];
                    if (previousSchema !== value) {
                      nextTables[index] = '';
                      nextColumns[index] = '';
                      nextColumnTypes[index] = '';
                      nextPrimaryKeys[index] = false;
                    }

                    setSelectedSchemas(nextSchemas);
                    setSelectedTables(nextTables);
                    setSelectedColumns(nextColumns);
                    setSelectedColumnTypes(nextColumnTypes);
                    setSelectedPrimaryKeys(nextPrimaryKeys);
                    setSelectedJoinRowIndexes(prev => {
                      if (!prev.has(index)) {
                        return prev;
                      }

                      const next = new Set(prev);
                      next.delete(index);
                      return next;
                    });
                    emitMappingChange(nextSchemas, nextTables, nextColumns, nextColumnTypes, nextPrimaryKeys);

                    if (value && (tablesStatusBySchema[value] ?? 'idle') === 'idle') {
                      onLoadTables(endpointId, value);
                    }
                  }}
                />
              </span>
              <span style={styles.schemaGridCell}>
                <SchemaCell
                  value={selectedTables[index] ?? ''}
                  options={tableOptions}
                  disabled={!selectedSchema}
                  onOpenDropdown={() => {
                    if (selectedSchema && tablesStatus === 'idle') {
                      onLoadTables(endpointId, selectedSchema);
                    }
                  }}
                  onChange={value => {
                    const nextTables = [...selectedTables];
                    const previousTable = nextTables[index] ?? '';
                    nextTables[index] = value;

                    const nextColumns = [...selectedColumns];
                    const nextColumnTypes = [...selectedColumnTypes];
                    const nextPrimaryKeys = [...selectedPrimaryKeys];
                    if (previousTable !== value) {
                      nextColumns[index] = '';
                      nextColumnTypes[index] = '';
                      nextPrimaryKeys[index] = false;
                    }

                    setSelectedTables(nextTables);
                    setSelectedColumns(nextColumns);
                    setSelectedColumnTypes(nextColumnTypes);
                    setSelectedPrimaryKeys(nextPrimaryKeys);
                    emitMappingChange(selectedSchemas, nextTables, nextColumns, nextColumnTypes, nextPrimaryKeys);

                    if (selectedSchema && value && (columnsStatusByTable[createTableKey(selectedSchema, value)] ?? 'idle') === 'idle') {
                      onLoadColumns(endpointId, selectedSchema, value);
                    }
                  }}
                />
              </span>
              <span style={styles.schemaGridCell}>
                <SchemaCell
                  value={selectedColumn}
                  options={columnOptions}
                  disabled={!selectedSchema || !selectedTable}
                  suffix={(selectedColumnInfo?.primaryKey ?? selectedPrimaryKey) ? <KeyOutlined style={styles.primaryKeyIcon} /> : null}
                  onOpenDropdown={() => {
                    if (selectedSchema && selectedTable && columnsStatus === 'idle') {
                      onLoadColumns(endpointId, selectedSchema, selectedTable);
                    }
                  }}
                  onChange={value => {
                    const nextColumns = [...selectedColumns];
                    nextColumns[index] = value;
                    const selectedColumnInfo = columns.find(column => column.name === value);
                    const nextColumnTypes = [...selectedColumnTypes];
                    nextColumnTypes[index] = selectedColumnInfo?.dataType ?? '';
                    const nextPrimaryKeys = [...selectedPrimaryKeys];
                    nextPrimaryKeys[index] = selectedColumnInfo?.primaryKey ?? false;

                    setSelectedColumns(nextColumns);
                    setSelectedColumnTypes(nextColumnTypes);
                    setSelectedPrimaryKeys(nextPrimaryKeys);
                    emitMappingChange(selectedSchemas, selectedTables, nextColumns, nextColumnTypes, nextPrimaryKeys);
                  }}
                />
              </span>
              <span style={styles.gridCellTextMuted}>{selectedColumnInfo?.dataType ?? selectedColumnType}</span>
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
        {!schemasError && !Object.values(tablesErrorBySchema).find(Boolean) && Object.values(columnsErrorByTable).find(Boolean) && (
          <div style={styles.databaseGridNote}>
            {Object.values(columnsErrorByTable).find(Boolean)}
          </div>
        )}
      </div>
    </div>
    <JoinDefinitionModal
      open={joinModalOpen}
      scopes={scopes}
      schemasStatus={schemasStatus}
      schemas={schemas}
      columnsByTable={columnsByTable}
      columnsStatusByTable={columnsStatusByTable}
      tablesBySchema={tablesBySchema}
      tablesStatusBySchema={tablesStatusBySchema}
      joins={mapping?.joins ?? []}
      endpointId={endpointId}
      onLoadTables={onLoadTables}
      onLoadColumns={onLoadColumns}
      onChangeJoins={emitJoinsChange}
      onClose={() => setJoinModalOpen(false)}
    />
    </>
  );
}

export default function MappingWorkspace({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onLoadTables,
  onLoadColumns,
  onCreateMapping,
  onChangeMapping,
  onSaveMapping,
}: MappingWorkspaceProps) {
  const safeTabs = tabs ?? [];
  const safeOnSelectTab = onSelectTab ?? (() => {});
  const safeOnCloseTab = onCloseTab ?? (() => {});
  const safeOnLoadColumns = onLoadColumns ?? (() => {});
  const safeOnCreateMapping = onCreateMapping ?? (() => {});
  const safeOnChangeMapping = onChangeMapping ?? (() => {});
  const safeOnSaveMapping = onSaveMapping ?? (() => {});
  const activeTab = safeTabs.find(tab => tab.endpointId === activeTabId) ?? null;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();

        if (activeTab?.isDirty) {
          safeOnSaveMapping(activeTab.endpointId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, safeOnSaveMapping]);

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
            <div style={styles.saveStatusGroup}>
              {activeTab.saveStatus === 'saving' && (
                <span style={styles.saveStatusText}>Saving...</span>
              )}
              {activeTab.saveStatus === 'error' && (
                <span style={styles.saveStatusError}>{activeTab.saveError ?? 'Save failed.'}</span>
              )}
              {activeTab.isDirty && activeTab.saveStatus !== 'saving' && (
                <span style={styles.saveStatusText}>Unsaved changes</span>
              )}
            </div>
          </div>

          {activeTab.mappingStatus === 'loading' ? (
            <div style={styles.placeholderState}>Loading mapping...</div>
          ) : activeTab.mappingStatus === 'error' ? (
            <div style={styles.placeholderStateError}>{activeTab.mappingError ?? 'Failed to load mapping.'}</div>
          ) : activeTab.workspaceMode !== 'prompt' ? (
            <MappingGrid
              key={`${activeTab.endpointId}-${activeTab.workspaceMode}`}
              endpointId={activeTab.endpointId}
              mapping={activeTab.mapping}
              serviceRows={getRowsFromMapping(activeTab.mapping)}
              schemasStatus={activeTab.schemasStatus}
              schemas={activeTab.schemas}
              schemasError={activeTab.schemasError}
              tablesBySchema={activeTab.tablesBySchema}
              tablesStatusBySchema={activeTab.tablesStatusBySchema}
              tablesErrorBySchema={activeTab.tablesErrorBySchema}
              columnsByTable={activeTab.columnsByTable}
              columnsStatusByTable={activeTab.columnsStatusByTable}
              columnsErrorByTable={activeTab.columnsErrorByTable}
              onLoadTables={onLoadTables}
              onLoadColumns={safeOnLoadColumns}
              onChangeMapping={safeOnChangeMapping}
            />
          ) : isMappingEmpty(activeTab.mapping) ? (
            activeTab.workspaceMode === 'prompt' ? (
              <div style={styles.emptyMappingPrompt}>
                <span style={styles.emptyMappingTitle}>Current endpoint has no mapping yet.</span>
                <button
                  type="button"
                  style={styles.inlineAction}
                  onClick={() => safeOnCreateMapping(activeTab.endpointId, 'empty-grid')}
                >
                  Create empty mapping
                </button>
                <button
                  type="button"
                  style={styles.inlineAction}
                  onClick={() => safeOnCreateMapping(activeTab.endpointId, 'response-model-grid')}
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
                {activeTab.mappingError && (
                  <span style={styles.inlineHintError}>{activeTab.mappingError}</span>
                )}
                {activeTab.responseModelStatus === 'ready' && flattenResponseModel(activeTab.responseModel).length === 0 && (
                  <span style={styles.inlineHint}>Response model is empty, so the Service side will stay blank.</span>
                )}
              </div>
            ) : null
          ) : (
            <MappingGrid
              key={`${activeTab.endpointId}-persisted`}
              endpointId={activeTab.endpointId}
              mapping={activeTab.mapping}
              serviceRows={getRowsFromMapping(activeTab.mapping)}
              schemasStatus={activeTab.schemasStatus}
              schemas={activeTab.schemas}
              schemasError={activeTab.schemasError}
              tablesBySchema={activeTab.tablesBySchema}
              tablesStatusBySchema={activeTab.tablesStatusBySchema}
              tablesErrorBySchema={activeTab.tablesErrorBySchema}
              columnsByTable={activeTab.columnsByTable}
              columnsStatusByTable={activeTab.columnsStatusByTable}
              columnsErrorByTable={activeTab.columnsErrorByTable}
              onLoadTables={onLoadTables}
              onLoadColumns={safeOnLoadColumns}
              onChangeMapping={safeOnChangeMapping}
            />
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
  tabDirtyIndicator: {
    width: 9,
    height: 9,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.62)',
    flexShrink: 0,
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
  saveStatusGroup: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 140,
  },
  saveStatusText: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 12,
  },
  saveStatusError: {
    color: '#ffccc7',
    fontSize: 12,
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
    justifyContent: 'space-between',
    gap: 12,
    padding: '0 14px',
    background: 'linear-gradient(180deg, rgba(64,150,255,0.14) 0%, rgba(64,150,255,0.04) 100%)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  gridHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    textTransform: 'none',
    letterSpacing: 0,
  },
  gridHeaderActionButton: {
    minHeight: 24,
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 4,
    background: 'rgba(255,255,255,0.04)',
    color: 'rgba(255,255,255,0.72)',
    padding: '0 8px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  },
  gridHeaderActionButtonDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
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
    lineHeight: '18px',
  },
  gridCellTextMuted: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 12px',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.01)',
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: '18px',
  },
  schemaEditorShell: {
    position: 'relative',
    width: '100%',
    minWidth: 0,
    height: '100%',
    display: 'flex',
    alignItems: 'stretch',
    padding: '0 12px',
    background: 'rgba(255,255,255,0.01)',
    color: 'rgba(255,255,255,0.74)',
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: '18px',
  },
  schemaGridCell: {
    display: 'flex',
    alignItems: 'stretch',
    minWidth: 0,
    padding: 0,
    borderRight: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.01)',
  },
  schemaCellButton: {
    width: '100%',
    minWidth: 0,
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
    color: 'rgba(255,255,255,0.74)',
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: '18px',
  },
  schemaCellButtonOutlined: {
    minHeight: 30,
    border: '1px solid rgba(105,177,255,0.24)',
    borderRadius: 5,
    background: 'rgba(105,177,255,0.08)',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.025)',
    color: 'rgba(255,255,255,0.82)',
    padding: '0 8px',
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
    fontSize: 10,
  },
  schemaEditorArrowButton: {
    width: 18,
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
    fontSize: 10,
  },
  schemaEditorShellOutlined: {
    minHeight: 30,
    border: '1px solid rgba(105,177,255,0.34)',
    borderRadius: 5,
    background: 'rgba(105,177,255,0.1)',
    padding: '0 8px',
  },
  schemaEditorInput: {
    flex: '1 1 auto',
    width: 0,
    minWidth: 0,
    height: '100%',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    padding: 0,
    color: 'rgba(255,255,255,0.74)',
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: '18px',
  },
  schemaDropdown: {
    position: 'absolute',
    zIndex: 20,
    top: '100%',
    left: 0,
    right: 0,
    maxHeight: 220,
    overflowY: 'auto',
    padding: 4,
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6,
    background: '#1f1f1f',
    boxShadow: '0 8px 22px rgba(0,0,0,0.35)',
  },
  schemaDropdownOption: {
    width: '100%',
    minHeight: 28,
    display: 'flex',
    alignItems: 'center',
    border: 'none',
    borderRadius: 4,
    background: 'transparent',
    padding: '0 8px',
    color: 'rgba(255,255,255,0.74)',
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'left',
    cursor: 'pointer',
    lineHeight: '18px',
  },
  schemaDropdownOptionSelected: {
    background: 'rgba(64,150,255,0.18)',
    color: 'rgba(255,255,255,0.88)',
  },
  schemaDropdownOptionHovered: {
    background: 'rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.92)',
  },
  schemaCellButtonDisabled: {
    cursor: 'not-allowed',
  },
  schemaCellLabel: {
    flex: '1 1 auto',
    minWidth: 0,
    lineHeight: '18px',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    fontSize: 12,
    fontFamily: 'inherit',
  },
  schemaCellLabelFilled: {
    color: 'rgba(255,255,255,0.74)',
  },
  schemaCellLabelPlaceholder: {
    color: 'rgba(255,255,255,0.32)',
  },
  schemaCellArrow: {
    width: 18,
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: 'rgba(255,255,255,0.38)',
    fontSize: 10,
  },
  databaseGridNote: {
    padding: '10px 12px',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    color: '#ffccc7',
    fontSize: 12,
    background: 'rgba(255,120,117,0.04)',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: 'rgba(0,0,0,0.58)',
  },
  joinModal: {
    width: 'min(1400px, calc(100vw - 48px))',
    height: 'min(760px, calc(100vh - 48px))',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    background: '#1b1b1b',
    boxShadow: '0 22px 60px rgba(0,0,0,0.45)',
    padding: 18,
  },
  joinModalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  joinModalTitle: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 16,
    fontWeight: 700,
    flexShrink: 0,
  },
  joinScopeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: '1 1 auto',
    minWidth: 0,
  },
  joinScopeLabel: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 12,
    fontWeight: 600,
    flexShrink: 0,
  },
  scopeSelectShell: {
    position: 'relative',
    flex: '1 1 auto',
    minWidth: 0,
    maxWidth: 340,
  },
  scopeSelectTrigger: {
    width: '100%',
    height: 30,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 4,
    background: 'rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontFamily: 'monospace',
    padding: '0 8px',
    cursor: 'pointer',
    outline: 'none',
    textAlign: 'left',
  },
  scopeSelectDropdown: {
    position: 'absolute',
    zIndex: 30,
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    maxHeight: 200,
    overflowY: 'auto',
    padding: 4,
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6,
    background: '#1f1f1f',
    boxShadow: '0 8px 22px rgba(0,0,0,0.35)',
  },
  joinModalCloseButton: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: 4,
    background: 'transparent',
    color: 'rgba(255,255,255,0.55)',
    cursor: 'pointer',
  },
  joinDiagram: {
    position: 'relative',
    flex: '1 1 auto',
    minHeight: 0,
    minWidth: 0,
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    overflow: 'hidden',
    background: '#181818',
  },
  joinAddTableRow: {
    display: 'flex',
    alignItems: 'stretch',
    gap: 8,
    minHeight: 32,
  },
  joinDiagramSvg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 1,
    overflow: 'visible',
  },
  joinEdgeHitArea: {
    fill: 'none',
    stroke: 'transparent',
    strokeWidth: 14,
    cursor: 'pointer',
    pointerEvents: 'stroke',
  },
  joinEdge: {
    fill: 'none',
    stroke: 'rgba(105,177,255,0.72)',
    strokeWidth: 2,
    strokeLinejoin: 'round',
    pointerEvents: 'none',
  },
  joinEdgeSelected: {
    fill: 'none',
    stroke: '#49cc90',
    strokeWidth: 2.5,
    strokeLinejoin: 'round',
    pointerEvents: 'none',
  },
  joinTableCanvas: {
    height: '100%',
    minHeight: 0,
    overflow: 'auto',
  },
  joinTableCanvasContent: {
    position: 'relative',
  },
  joinDiagramTable: {
    position: 'absolute',
    width: TABLE_CARD_WIDTH,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 7,
    background: '#202020',
    boxShadow: '0 10px 24px rgba(0,0,0,0.25)',
  },
  joinDiagramTableHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    padding: '7px 8px 7px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(64,150,255,0.16)',
    cursor: 'grab',
    userSelect: 'none',
  },
  joinDiagramTableName: {
    flex: '1 1 auto',
    minWidth: 0,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    color: 'rgba(255,255,255,0.86)',
    fontSize: 12,
    fontWeight: 700,
    fontFamily: 'monospace',
    lineHeight: '18px',
  },
  joinDiagramTableRemove: {
    flexShrink: 0,
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: 3,
    background: 'transparent',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    cursor: 'pointer',
    padding: 0,
  },
  joinDiagramColumnList: {
    display: 'flex',
    flexDirection: 'column',
    padding: '6px 0',
  },
  joinDiagramEmptyColumns: {
    padding: '8px 12px',
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
  },
  joinDiagramColumn: {
    width: '100%',
    minHeight: 30,
    display: 'grid',
    gridTemplateColumns: '14px minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: 8,
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.72)',
    padding: '0 10px',
    textAlign: 'left',
    cursor: 'crosshair',
  },
  joinDiagramColumnPending: {
    background: 'rgba(73,204,144,0.16)',
    color: 'rgba(255,255,255,0.92)',
  },
  joinDiagramColumnHovered: {
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.9)',
  },
  joinDiagramColumnTarget: {
    background: 'rgba(97,170,254,0.16)',
    color: 'rgba(255,255,255,0.92)',
    boxShadow: 'inset 0 0 0 1px rgba(97,170,254,0.4)',
  },
  joinDiagramColumnSelectedMember: {
    background: 'rgba(73,204,144,0.1)',
    color: 'rgba(255,255,255,0.88)',
    boxShadow: 'inset 0 0 0 1px rgba(73,204,144,0.35)',
  },
  joinDiagramEmpty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    padding: 24,
    textAlign: 'center',
  },
  joinDiagramHandle: {
    width: 9,
    height: 9,
    borderRadius: '50%',
    border: '1px solid rgba(105,177,255,0.9)',
    background: '#181818',
  },
  joinDiagramColumnName: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: '18px',
  },
  primaryKeyIcon: {
    flexShrink: 0,
    color: '#b7eb8f',
    fontSize: 12,
  },
  joinDiagramColumnType: {
    color: 'rgba(255,255,255,0.36)',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  joinModalFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  joinBottomPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    borderTop: '1px solid rgba(255,255,255,0.08)',
    paddingTop: 10,
  },
  joinBottomPanelHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  joinSidePanelTitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  },
  joinBottomConditionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: 160,
    overflowY: 'auto',
  },
  joinConditionLabel: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  joinConditionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  joinConditionCard: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 74px minmax(0, 1fr) auto',
    alignItems: 'stretch',
    gap: 8,
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    background: 'rgba(0,0,0,0.14)',
    overflow: 'visible',
    padding: 8,
  },
  joinConditionRemoveButton: {
    minHeight: 28,
    whiteSpace: 'nowrap',
    border: '1px solid rgba(255,120,117,0.28)',
    borderRadius: 4,
    background: 'transparent',
    color: '#ffccc7',
    padding: '0 10px',
    fontSize: 12,
    cursor: 'pointer',
  },
  joinInspector: {
    flex: '1 1 auto',
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  joinInspectorTitle: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 12,
    fontWeight: 700,
  },
  joinInspectorPath: {
    maxWidth: 260,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  joinInspectorOperator: {
    color: '#49cc90',
    fontSize: 13,
    fontWeight: 700,
  },
  joinDeleteButton: {
    minHeight: 28,
    border: '1px solid rgba(255,120,117,0.36)',
    borderRadius: 4,
    background: 'rgba(255,120,117,0.08)',
    color: '#ffccc7',
    padding: '0 10px',
    fontSize: 12,
    cursor: 'pointer',
  },
  joinModalNote: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 12,
  },
  joinModalActionButton: {
    minHeight: 30,
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: 4,
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.78)',
    padding: '0 12px',
    fontSize: 12,
    cursor: 'pointer',
  },
};
