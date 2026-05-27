import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../../store';
import { useKeyboard, useKeyCombo } from '../../hooks/useKeyboard';
import { api } from '../../utils/api';
import type { SearchResult } from '../../types';

const MODULE_ROUTES: Record<string, string> = {
  subscriptions: '/subscriptions',
  shops: '/shops',
  projects: '/projects',
  social: '/social',
  invoices: '/finances',
};

export function SearchModal() {
  const { searchModalOpen, setSearchModalOpen } = useUIStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useKeyCombo('k', true, () => setSearchModalOpen(true), []);
  useKeyboard('Escape', () => { if (searchModalOpen) { setSearchModalOpen(false); setQuery(''); } }, [searchModalOpen]);

  useEffect(() => {
    if (searchModalOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
    }
  }, [searchModalOpen]);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get<SearchResult[]>(`/search?q=${encodeURIComponent(query)}`);
        setResults(data);
        setFocused(0);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const navigate_to = useCallback((result: SearchResult) => {
    const base = MODULE_ROUTES[result.module] ?? '/';
    navigate(result.module === 'projects' ? `${base}/${result.id}` : base);
    setSearchModalOpen(false);
    setQuery('');
  }, [navigate, setSearchModalOpen]);

  useKeyboard('ArrowDown', () => setFocused(f => Math.min(f + 1, results.length - 1)), [results]);
  useKeyboard('ArrowUp', () => setFocused(f => Math.max(f - 1, 0)), [results]);
  useKeyboard('Enter', () => { if (results[focused]) navigate_to(results[focused]); }, [results, focused, navigate_to]);

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.module]) acc[r.module] = [];
    acc[r.module].push(r);
    return acc;
  }, {});

  if (!searchModalOpen) return null;

  return (
    <div className="modal-backdrop" onClick={() => { setSearchModalOpen(false); setQuery(''); }}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-input-row">
          <Search size={18} color="var(--text-muted)" />
          <input
            ref={inputRef}
            className="search-input"
            placeholder="Search across all modules..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Searching...</span>}
          <kbd style={{ fontSize: 10, color: 'var(--text-faint)', background: 'var(--surface-3)', padding: '2px 6px', borderRadius: 4 }}>ESC</kbd>
        </div>

        <div className="search-results">
          {query.length < 2 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Type at least 2 characters to search
            </div>
          )}
          {query.length >= 2 && results.length === 0 && !loading && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No results for "{query}"
            </div>
          )}
          {Object.entries(grouped).map(([module, items]) => (
            <div key={module} className="search-group">
              <div className="search-group-label">{module}</div>
              {items.map((item) => {
                const globalIdx = results.indexOf(item);
                return (
                  <div
                    key={item.id}
                    className={`search-item ${globalIdx === focused ? 'focused' : ''}`}
                    onClick={() => navigate_to(item)}
                    onMouseEnter={() => setFocused(globalIdx)}
                  >
                    <span style={{ flex: 1 }}>{item.name}</span>
                    {item.subtitle && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.subtitle}</span>}
                    <ArrowRight size={14} color="var(--text-faint)" />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
