import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { api } from '../../utils/api';
import type { Tag } from '../../types';

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export function TagInput({ value, onChange, placeholder = 'Add tag…' }: Props) {
  const [input, setInput] = useState('');
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<Tag[]>('/tags').then(setAllTags).catch(() => {});
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = allTags.filter(t =>
    t.name.toLowerCase().includes(input.toLowerCase()) &&
    !value.includes(t.name)
  );

  function addTag(name: string) {
    const trimmed = name.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
      // Create tag in DB if it doesn't exist
      if (!allTags.find(t => t.name.toLowerCase() === trimmed.toLowerCase())) {
        api.post<Tag>('/tags', { name: trimmed }).then(t => setAllTags(prev => [...prev, t])).catch(() => {});
      }
    }
    setInput('');
    setShowDropdown(false);
    setFocusedIndex(0);
  }

  function removeTag(name: string) {
    onChange(value.filter(t => t !== name));
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (showDropdown && filtered[focusedIndex]) {
        addTag(filtered[focusedIndex].name);
      } else if (input.trim()) {
        addTag(input);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  }

  const tagColor = (name: string) => allTags.find(t => t.name === name)?.color ?? '#6b6b68';

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div
        className="tag-input-wrapper"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map(tag => (
          <span key={tag} className="tag-chip" style={{ borderColor: tagColor(tag) + '40', color: tagColor(tag) }}>
            {tag}
            <button className="tag-chip-remove" onClick={e => { e.stopPropagation(); removeTag(tag); }}>
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="tag-input-field"
          value={input}
          onChange={e => { setInput(e.target.value); setShowDropdown(true); setFocusedIndex(0); }}
          onKeyDown={handleKey}
          onFocus={() => setShowDropdown(true)}
          placeholder={value.length === 0 ? placeholder : ''}
        />
      </div>

      {showDropdown && (input || filtered.length > 0) && (
        <div className="tag-dropdown">
          {filtered.map((tag, i) => (
            <div
              key={tag.id}
              className={`tag-dropdown-item${i === focusedIndex ? ' focused' : ''}`}
              onMouseDown={e => { e.preventDefault(); addTag(tag.name); }}
            >
              <span className="tag-color-dot" style={{ background: tag.color }} />
              {tag.name}
            </div>
          ))}
          {input.trim() && !allTags.find(t => t.name.toLowerCase() === input.trim().toLowerCase()) && (
            <div
              className={`tag-dropdown-item${filtered.length === focusedIndex ? ' focused' : ''}`}
              onMouseDown={e => { e.preventDefault(); addTag(input); }}
              style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}
            >
              Create "{input.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
