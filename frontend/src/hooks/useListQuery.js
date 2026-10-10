import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebounce } from './index';

/**
 * Listados con filtros en la URL (se conservan al recargar o compartir el
 * enlace), búsqueda con debounce y carga paginada.
 *
 * @param fetcher  (params, { signal }) => Promise<{ items, pagination }>
 * @param paramMap { claveEnApi: [claveEnUrl, valorPorDefecto] }
 */
export function useListQuery(fetcher, paramMap, { pageSize = 10 } = {}) {
  const [params, setParams] = useSearchParams();

  const filters = {};
  for (const [apiKey, [urlKey, fallback]] of Object.entries(paramMap)) {
    filters[apiKey] = params.get(urlKey) ?? fallback;
  }
  filters.page = Number(params.get('pagina')) || 1;

  const setFilter = useCallback(
    (updates, resetPage = true) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [apiKey, value] of Object.entries(updates)) {
            const urlKey = apiKey === 'page' ? 'pagina' : paramMap[apiKey][0];
            if (value === '' || value === null || value === undefined) next.delete(urlKey);
            else next.set(urlKey, String(value));
          }
          if (resetPage && !('page' in updates)) next.delete('pagina');
          return next;
        },
        { replace: true },
      );
    },
    // paramMap es un literal estable por página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setParams],
  );

  // Búsqueda con debounce sincronizada con la URL.
  const [searchInput, setSearchInput] = useState(filters.search ?? '');
  const debouncedSearch = useDebounce(searchInput.trim());
  useEffect(() => {
    if ('search' in paramMap && debouncedSearch !== (filters.search ?? '')) setFilter({ search: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filters.search, setFilter]);

  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState({ key: null, data: null, error: null });
  const requestKey = `${JSON.stringify(filters)}|${reloadKey}`;

  useEffect(() => {
    const f = JSON.parse(requestKey.slice(0, requestKey.lastIndexOf('|')));
    const controller = new AbortController();
    fetcher({ ...f, pageSize }, { signal: controller.signal })
      .then((res) => setResult({ key: requestKey, data: res, error: null }))
      .catch((err) => {
        if (err.name !== 'AbortError') setResult((prev) => ({ key: requestKey, data: prev.data, error: err.message }));
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, pageSize]);

  const loading = result.key !== requestKey;
  const hasFilters = Object.entries(paramMap).some(
    ([apiKey, [, fallback]]) => !['sortBy', 'sortDir'].includes(apiKey) && filters[apiKey] !== fallback,
  );

  return {
    filters,
    setFilter,
    searchInput,
    setSearchInput,
    data: result.data,
    error: loading ? null : result.error,
    loading,
    hasFilters,
    reload: () => setReloadKey((k) => k + 1),
    clearFilters: () => {
      setSearchInput('');
      setParams({}, { replace: true });
    },
    toggleSort: (key) => {
      const dir = filters.sortBy === key && filters.sortDir === 'asc' ? 'desc' : 'asc';
      setFilter({ sortBy: key, sortDir: dir }, false);
    },
  };
}
