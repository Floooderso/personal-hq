import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { useKeyboard } from '../../hooks/useKeyboard';

interface Props {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  open: boolean;
  onClose: () => void;
}

export function SlideOver({ title, children, footer, open, onClose }: Props) {
  useKeyboard('Escape', () => { if (open) onClose(); }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="slideover-backdrop" onClick={onClose} />
      <div className="slideover-panel">
        <div className="slideover-header">
          <h2 className="slideover-title">{title}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon">
            <X size={18} />
          </button>
        </div>
        <div className="slideover-body">{children}</div>
        {footer && <div className="slideover-footer">{footer}</div>}
      </div>
    </>
  );
}

