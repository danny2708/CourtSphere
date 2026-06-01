import { useMemo, useState, type ReactNode } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "../../../components/common/Button";
import { EmptyState } from "../../../components/common/EmptyState";

export type AdminColumn<TRow> = {
  key: string;
  header: string;
  render: (row: TRow) => ReactNode;
};

type AdminFilterValue = string | number | boolean | null | undefined;

export type AdminAdvancedFilter<TRow> = {
  key: string;
  label: string;
  options: Array<{ label: string; value: string }>;
  getValue: (row: TRow) => AdminFilterValue | AdminFilterValue[];
};

type AdminDataTableProps<TRow> = {
  advancedFilters?: Array<AdminAdvancedFilter<TRow>>;
  columns: Array<AdminColumn<TRow>>;
  emptyMessage?: string;
  getRowKey: (row: TRow) => string;
  rows: TRow[];
};

type FlatRow = Record<string, string>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
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

function normalizeFilterValue(value: AdminFilterValue): string {
  return value === null || value === undefined ? "" : String(value);
}

export function AdminDataTable<TRow>({ advancedFilters = [], columns, emptyMessage, getRowKey, rows }: AdminDataTableProps<TRow>) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [fieldFilters, setFieldFilters] = useState<Record<string, string>>({});
  const [keyword, setKeyword] = useState("");
  const flattenedRows = useMemo(() => rows.map((row) => ({ row, values: flattenRow(row) })), [rows]);
  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const activeFieldFilters = advancedFilters
      .map((filter) => [filter, fieldFilters[filter.key]?.trim()] as const)
      .filter(([, value]) => value);

    if (!normalizedKeyword && activeFieldFilters.length === 0) {
      return rows;
    }

    return flattenedRows
      .filter(({ row, values }) => {
        const matchesKeyword = normalizedKeyword
          ? Object.values(values).some((value) => value.toLowerCase().includes(normalizedKeyword))
          : true;
        const matchesFields = activeFieldFilters.every(([filter, selectedValue]) => {
          const rawValue = filter.getValue(row);
          const rowValues = Array.isArray(rawValue) ? rawValue : [rawValue];

          return rowValues.map(normalizeFilterValue).includes(selectedValue);
        });

        return matchesKeyword && matchesFields;
      })
      .map(({ row }) => row);
  }, [advancedFilters, fieldFilters, flattenedRows, keyword, rows]);
  const hasActiveFilters = Boolean(keyword.trim() || Object.values(fieldFilters).some((value) => value.trim()));
  const hasAdvancedFilters = advancedFilters.length > 0;

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
          {hasAdvancedFilters ? (
            <Button size="md" variant="secondary" onClick={() => setAdvancedOpen(true)}>
              <SlidersHorizontal aria-hidden="true" size={18} />
              Tìm kiếm nâng cao
            </Button>
          ) : null}
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

      {advancedOpen && hasAdvancedFilters ? (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setAdvancedOpen(false)}>
          <div className="dialog-panel admin-filter-dialog" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
            <div>
              <p className="eyebrow">Admin</p>
              <h2>Tìm kiếm nâng cao</h2>
            </div>
            <div className="admin-filter-dialog__grid">
              {advancedFilters.map((field) => (
                <label className="admin-filter-field" key={field.key}>
                  <span>{field.label}</span>
                  <select
                    value={fieldFilters[field.key] ?? ""}
                    onChange={(event) => updateFieldFilter(field.key, event.target.value)}
                  >
                    <option value="">Tất cả</option>
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
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
