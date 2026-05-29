import type { ReactNode } from "react";

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

export function AdminDataTable<TRow>({ columns, emptyMessage, getRowKey, rows }: AdminDataTableProps<TRow>) {
  if (rows.length === 0) {
    return <EmptyState title="Chưa có dữ liệu" message={emptyMessage ?? "Không có dữ liệu phù hợp."} />;
  }

  return (
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
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
