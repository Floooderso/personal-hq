import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import {
  CreditCard, Server, FolderKanban, Share2, Zap, Receipt,
  LayoutDashboard, Settings, RefreshCw, ArrowRight, Plus, Search, BookOpen,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUIStore } from '../../store';
import { api } from '../../utils/api';
import type { SearchResult } from '../../types';

type Tab = 'commands' | 'search';

interface Command {
  label: string;
  sub?: string;
  icon: React.ElementType;
  action: () => void;
  kbd?: string;
}

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, setSyncCenterOpen, toggleQuickNotes } = useUIStore();
  const [tab, setTab] = useState<Tab>('commands');
  const [query, setQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  function close() { setCommandPaletteOpen(false); setQuery(''); setFocusedIndex(0); }

  const COMMANDS: Command[] = [
    { label: 'Go to Dashboard', icon: LayoutDashboard, action: () => { navigate('/'); close(); } },
    { label: 'Go to Subscriptions', icon: CreditCard, action: () => { navigate('/subscriptions'); close(); } },
    { label: 'Go to Services', icon: Server, action: () => { navigate('/services'); close(); } },
    { label: 'Go to Projects', icon: FolderKanban, action: () => { navigate('/projects'); close(); } },
    { label: 'Go to Social Media', icon: Share2, action: () => { navigate('/social'); close(); } },
    { label: 'Go to Automations', icon: Zap, action: () => { navigate('/automations'); close(); } },
    { label: 'Go to Finances', icon: Receipt, action: () => { navigate('/finances'); close(); } },
    { label: 'Go to Activity Log', icon: BookOpen, action: () => { navigate('/log'); close(); } },
    { label: 'New Subscription', sub: 'Create', icon: Plus, action: () => { navigate('/subscriptions?new=1'); close(); } },
    { label: 'New Service', sub: 'Create', icon: Plus, action: () => { navigate('/services?new=1'); close(); } },
    { label: 'New Project', sub: 'Create', icon: Plus, action: () => { navigate('/projects?new=1'); close(); } },
    { label: 'New Invoice', sub: 'Create', icon: Plus, action: () => { navigate('/finances?new=1'); close(); } },
    { label: 'Sync All', sub: 'Sync Center', icon: RefreshCw, action: () => { setSyncCenterOpen(true); close(); } },
    { label: 'Quick Notes', sub: 'Shift+N', icon: Receipt, action: () => { toggleQuickNotes(); close(); } },
    { label: 'Settings', icon: Settings, action: () => { navigate('/settings'); close(); } },
  ];

  const filtered = query
    ? COMMANDS.filter(c => c.label.toLowerCase().includes(query.toLowerCase()) || (c.sub ?? '').toLowerCase().includes(query.toLowerCase()))
    : COMMANDS;

  // Group commands
  const navCmds = filtered.filter(c => c.label.startsWith('Go to'));
  const actionCmds = filtered.filter(c => !c.label.startsWith('Go to'));

  useEffect(() => {
    if (commandPaletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setTab('commands');
      setQuery('');
      setFocusedIndex(0);
    }
  }, [commandPaletteOpen]);

  useEffect(() => {
    if (tab === 'search' && query.length >= 2) {
      const t = setTimeout(() => {
        api.get<SearchResult[]>(`/search?q=${encodeURIComponent(query)}`).then(setSearchResults).catch(() => {});
      }, 200);
      return () => clearTimeout(t);
    } else {
      setSearchResults([]);
    }
  }, [query, tab]);

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    const listLen = tab === 'commands' ? filtered.length : searchResults.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIndex(i => Math.min(i + 1, listLen - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (tab === 'commands' && filtered[focusedIndex]) filtered[focusedIndex].action();
      else if (tab === 'search' && searchResults[focusedIndex]) {
        navigate(`/${searchResults[focusedIndex].module}/${searchResults[focusedIndex].id}`);
        close();
      }
    } else if (e.key === 'Escape') { close(); }
    else if (e.key === 'Tab') { e.preventDefault(); setTab(t => t === 'commands' ? 'search' : 'commands'); setFocusedIndex(0); }
  }

  // Keep focused index in bounds when list changes
  useEffect(() => { setFocusedIndex(0); }, [query, tab]);

  if (!commandPaletteOpen) return null;

  const MODULE_ICONS: Record<string, React.ElementType> = {
    subscriptions: CreditCard, services: Server, projects: FolderKanban,
    social: Share2, automations: Zap, finances: Receipt,
  };

  const currentModule = location.pathname.split('/')[1] || 'dashboard';

  return (
    <div className="cmd-backdrop" onClick={close}>
      <div className="cmd-panel" onClick={e => e.stopPropagation()}>
        <div className="cmd-input-row">
          {tab === 'commands' ? <ArrowRight size={16} color="var(--text-muted)" /> : <Search size={16} color="var(--text-muted)" />}
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder={tab === 'commands' ? 'Type a command…' : 'Search across all records…'}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
          />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>Tab to switch</span>
        </div>

        <div className="cmd-tabs">
          <button className={`cmd-tab${tab === 'commands' ? ' active' : ''}`} onClick={() => { setTab('commands'); setFocusedIndex(0); }}>Commands</button>
          <button className={`cmd-tab${tab === 'search' ? ' active' : ''}`} onClick={() => { setTab('search'); setFocusedIndex(0); }}>Search</button>
          {currentModule && <span style={{ marginLeft: 'auto', padding: '7px 14px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{currentModule}</span>}
        </div>

        <div className="cmd-results">
          {tab === 'commands' && (
            <>
              {navCmds.length > 0 && (
                <>
                  <div className="cmd-section-label">Navigate</div>
                  {navCmds.map((cmd, i) => {
                    const Icon = cmd.icon;
                    const globalI = i;
                    return (
                      <div key={cmd.label} className={`cmd-item${focusedIndex === globalI ? ' focused' : ''}`} onClick={cmd.action} onMouseEnter={() => setFocusedIndex(globalI)}>
                        <div className="cmd-item-icon"><Icon size={14} /></div>
                        <div className="cmd-item-text">
                          <div className="cmd-item-label">{cmd.label}</div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
              {actionCmds.length > 0 && (
                <>
                  <div className="cmd-section-label">Actions</div>
                  {actionCmds.map((cmd, i) => {
                    const Icon = cmd.icon;
                    const globalI = navCmds.length + i;
                    return (
                      <div key={cmd.label} className={`cmd-item${focusedIndex === globalI ? ' focused' : ''}`} onClick={cmd.action} onMouseEnter={() => setFocusedIndex(globalI)}>
                        <div className="cmd-item-icon"><Icon size={14} /></div>
                        <div className="cmd-item-text">
                          <div className="cmd-item-label">{cmd.label}</div>
                          {cmd.sub && <div className="cmd-item-sub">{cmd.sub}</div>}
                        </div>
                        {cmd.kbd && <span className="cmd-item-kbd">{cmd.kbd}</span>}
                      </div>
                    );
                  })}
                </>
              )}
              {filtered.length === 0 && <div className="cmd-empty">No commands match "{query}"</div>}
            </>
          )}

          {tab === 'search' && (
            <>
              {query.length < 2 && <div className="cmd-empty">Type at least 2 characters to search</div>}
              {query.length >= 2 && searchResults.length === 0 && <div className="cmd-empty">No results for "{query}"</div>}
              {searchResults.map((r, i) => {
                const Icon = MODULE_ICONS[r.module] || LayoutDashboard;
                return (
                  <div
                    key={`${r.module}-${r.id}`}
                    className={`cmd-item${focusedIndex === i ? ' focused' : ''}`}
                    onClick={() => { navigate(`/${r.module}/${r.id}`); close(); }}
                    onMouseEnter={() => setFocusedIndex(i)}
                  >
                    <div className="cmd-item-icon"><Icon size={14} /></div>
                    <div className="cmd-item-text">
                      <div className="cmd-item-label">{r.name}</div>
                      {r.subtitle && <div className="cmd-item-sub">{r.subtitle}</div>}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{r.module}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
