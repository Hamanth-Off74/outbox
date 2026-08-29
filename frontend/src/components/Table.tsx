import React from 'react';

interface Column<T> {
  key: string;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField?: keyof T;
  isLoading?: boolean;
  emptyStateText?: string;
}

export default function Table<T>({
  columns,
  data,
  keyField,
  isLoading = false,
  emptyStateText = 'No records found',
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-slate-900/80 rounded-2xl border border-slate-800">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500" />
        <p className="mt-4 text-sm text-slate-400 font-medium">Loading records...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-slate-900/80 rounded-2xl border border-slate-800 text-center px-4">
        <svg className="mx-auto h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <h3 className="mt-2 text-sm font-semibold text-slate-200">No emails found</h3>
        <p className="mt-1 text-xs text-slate-500">{emptyStateText}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800 shadow-xl bg-slate-900/80">
      <table className="min-w-full divide-y divide-slate-800">
        <thead className="bg-slate-950/60">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className="px-6 py-4 text-left text-[11px] font-semibold text-slate-400 tracking-wider uppercase border-b border-slate-800"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
          {data.map((row, idx) => {
            const rowKey = keyField && row[keyField] ? String(row[keyField]) : String(idx);
            return (
              <tr key={rowKey} className="hover:bg-slate-800/40 transition-colors">
                {columns.map((col) => {
                  const cellValue = (row as any)[col.key];
                  return (
                    <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {col.render ? col.render(cellValue, row) : String(cellValue ?? '')}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
