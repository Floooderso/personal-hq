import { useEffect } from 'react';

type Handler = (e: KeyboardEvent) => void;

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable;
}

export function useKeyboard(key: string, handler: Handler, deps: unknown[] = []) {
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (key.length === 1 && isInputFocused()) return;
      if (e.key === key) handler(e);
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps]);
}

export function useKeyCombo(key: string, meta: boolean, handler: Handler, deps: unknown[] = []) {
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((meta ? e.ctrlKey || e.metaKey : true) && e.key === key) {
        e.preventDefault();
        handler(e);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, meta, ...deps]);
}
