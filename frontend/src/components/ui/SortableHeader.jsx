import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

/** Encabezado de tabla ordenable (mismo estilo en todos los listados). */
export function SortableHeader({ column, label, sortBy, sortDir, onSort }) {
  const active = sortBy === column;
  const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="sort-btn" data-active={active} onClick={() => onSort(column)}>
        {label}
        <Icon aria-hidden="true" />
      </button>
    </th>
  );
}
