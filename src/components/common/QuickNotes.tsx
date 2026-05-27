import { useEffect, useRef, useState, useCallback } from 'react';
import { X, FileText } from 'lucide-react';
import { useUIStore } from '../../store';
import { api } from '../../utils/api';

export function QuickNotes() {
  const { quickNotesOpen, setQuickNotesOpen } = useUIStore();
  const [content, setContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (quickNotesOpen && !loaded.current) {
      api.get<{ content: string }>('/notes').then(n => {
        setContent(n.content);
        loaded.current = true;
      }).catch(() => {});
    }
  }, [quickNotesOpen]);

  const save = useCallback((text: string) => {
    setSaveStatus('saving');
    api.put('/notes', { content: text }).then(() => setSaveStatus('saved')).catch(() => {});
    setTimeout(() => setSaveStatus('idle'), 1500);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setContent(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(val), 800);
  }

  if (!quickNotesOpen) return null;

  return (
    <div className="quick-notes-panel">
      <div className="quick-notes-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <FileText size={13} color="var(--text-muted)" />
          <span className="quick-notes-title">Quick Notes</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="quick-notes-hint">Shift+N</span>
          <button
            onClick={() => setQuickNotesOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <textarea
        className="quick-notes-textarea"
        value={content}
        onChange={handleChange}
        placeholder="Scratch space for transient thoughts…"
        autoFocus
      />
      <div className="quick-notes-footer">
        <span className="quick-notes-status">
          {saveStatus === 'saving' ? 'saving…' : saveStatus === 'saved' ? 'saved' : ''}
        </span>
      </div>
    </div>
  );
}
