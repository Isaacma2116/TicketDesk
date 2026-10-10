import { useState } from 'react';

export function moveItem(list, from, to) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Ordenamiento por arrastrar y soltar (HTML5) con asa, más mover arriba/abajo
 * para teclado y pantallas táctiles (donde el arrastre nativo no funciona).
 *
 *   const sortable = useSortable(items, onReorder);
 *   <li {...sortable.rowProps(i)}>
 *     <span {...sortable.handleProps(i)}>☰</span>
 *     <button onClick={() => sortable.move(i, i - 1)}>↑</button>
 */
export function useSortable(items, onReorder, { disabled = false } = {}) {
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  const reset = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  const move = (from, to) => {
    if (disabled) return;
    const next = moveItem(items, from, to);
    if (next !== items) onReorder(next, { from, to });
  };

  return {
    move,
    dragging: dragIndex !== null,
    handleProps: (index) => ({
      draggable: !disabled,
      'aria-hidden': true,
      onDragStart: (e) => {
        setDragIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
        const row = e.currentTarget.closest('[data-sortable-row]');
        if (row) e.dataTransfer.setDragImage(row, 24, 24);
      },
      onDragEnd: reset,
    }),
    rowProps: (index) => ({
      'data-sortable-row': true,
      'data-dragging': dragIndex === index || undefined,
      'data-drag-over': (overIndex === index && dragIndex !== null && dragIndex !== index) || undefined,
      onDragOver: (e) => {
        if (dragIndex === null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (overIndex !== index) setOverIndex(index);
      },
      onDrop: (e) => {
        if (dragIndex === null) return;
        e.preventDefault();
        move(dragIndex, index);
        reset();
      },
    }),
  };
}
