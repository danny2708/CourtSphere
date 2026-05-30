import { useMemo, useState, type ReactNode } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "../../../components/common/Button";
import { EmptyState } from "../../../components/common/EmptyState";

export type AdminColumn<TRow> = {
  key: string;
  header: string;
  render: (row: TRow) => ReactNode;
};

type AdminDataTableProps<TRow> = {
  columns: Array<AdminColumn<TRow>>;
  emptyMessage?: string;
  getRowKey: (row: TRow) => string;
  rows: TRow[];
};

type FlatRow = Record<string, string>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
}

function labelFromPath(path: string): string {
  return path
    .replace(/\[(\d+)\]/g, " $1")
    .replace(/\./g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (value) => value.toUpperCase());
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function flattenValue(value: unknown, path: string, output: FlatRow): void {
  if (Array.isArray(value)) {
    const primitiveValues = value
      .map((item) => stringifyValue(item))
      .filter(Boolean);

    if (primitiveValues.length > 0 && path) {
      output[path] = primitiveValues.join(" ");
    }

    value.forEach((item, index) => {
      if (isPlainObject(item)) {
        flattenValue(item, `${path}[${index}]`, output);
      }
    });
    return;
  }

  if (isPlainObject(value)) {
    Object.entries(value).forEach(([key, childValue]) => {
      flattenValue(childValue, path ? `${path}.${key}` : key, output);
    });
    return;
  }

  if (path) {
    output[path] = stringifyValue(value);
  }
}

function flattenRow(row: unknown): FlatRow {
  const output: FlatRow = {};
  flattenValue(row, "", output);

  return output;
}

export function AdminDataTable<TRow>({ columns, emptyMessage, getRowKey, rows }: AdminDataTableProps<TRow>) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [fieldFilters, setFieldFilters] = useState<Record<string, string>>({});
  const [keyword, setKeyword] = useState("");
  const flattenedRows = useMemo(() => rows.map((row) => ({ row, values: flattenRow(row) })), [rows]);
  const filterFields = useMemo(() => {
    const fieldMap = new Map<string, string>();

    flattenedRows.forEach(({ values }) => {
      Object.entries(values).forEach(([key, value]) => {
        if (value.trim()) {
          fieldMap.set(key, labelFromPath(key));
        }
      });
    });

    return [...fieldMap.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [flattenedRows]);
  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const activeFieldFilters = Object.entries(fieldFilters)
      .map(([key, value]) => [key, value.trim().toLowerCase()] as const)
      .filter(([, value]) => value);

    if (!normalizedKeyword && activeFieldFilters.length === 0) {
      return rows;
    }

    return flattenedRows
      .filter(({ values }) => {
        const matchesKeyword = normalizedKeyword
          ? Object.values(values).some((value) => value.toLowerCase().includes(normalizedKeyword))
          : true;
        const matchesFields = activeFieldFilters.every(([key, value]) =>
          (values[key] ?? "").toLowerCase().includes(value)
        );

        return matchesKeyword && matchesFields;
      })
      .map(({ row }) => row);
  }, [fieldFilters, flattenedRows, keyword, rows]);
  const hasActiveFilters = Boolean(keyword.trim() || Object.values(fieldFilters).some((value) => value.trim()));

  function updateFieldFilter(key: string, value: string) {
    setFieldFilters((current) => ({
      ...current,
      [key]: value
    }));
  }

  function resetFilters() {
    setKeyword("");
    setFieldFilters({});
  }

  if (rows.length === 0) {
    return <EmptyState title="Chưa có dữ liệu" message={emptyMessage ?? "Không có dữ liệu phù hợp."} />;
  }

  return (
    <>
      <div className="admin-table-filter-card">
        <label className="admin-table-search">
          <Search aria-hidden="true" size={20} />
          <input
            placeholder="Tìm kiếm"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </label>
        <div className="admin-table-filter-actions">
          {hasActiveFilters ? (
            <Button size="md" variant="ghost" onClick={resetFilters}>
              <X aria-hidden="true" size={18} />
              Xóa lọc
            </Button>
          ) : null}
          <Button size="md" variant="secondary" onClick={() => setAdvancedOpen(true)}>
            <SlidersHorizontal aria-hidden="true" size={18} />
            Tìm kiếm nâng cao
          </Button>
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <EmptyState title="Không có kết quả" message="Không có dữ liệu phù hợp với bộ lọc hiện tại." />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key}>{column.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={getRowKey(row)}>
                  {columns.map((column) => (
                    <td key={column.key}>{column.render(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {advancedOpen ? (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setAdvancedOpen(false)}>
          <div className="dialog-panel admin-filter-dialog" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
            <div>
              <p className="eyebrow">Admin</p>
              <h2>Tìm kiếm nâng cao</h2>
            </div>
            <div className="admin-filter-dialog__grid">
              {filterFields.map((field) => (
                <label className="admin-filter-field" key={field.key}>
                  <span>{field.label}</span>
                  <input
                    placeholder={field.label}
                    value={fieldFilters[field.key] ?? ""}
                    onChange={(event) => updateFieldFilter(field.key, event.target.value)}
                  />
                </label>
              ))}
            </div>
            <div className="dialog-actions">
              <Button variant="ghost" onClick={resetFilters}>
                Làm mới
              </Button>
              <Button onClick={() => setAdvancedOpen(false)}>Áp dụng</Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
