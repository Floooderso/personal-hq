import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { useKeyboard } from '../../hooks/useKeyboard';

interface Props {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  open: boolean;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ title, children, footer, open, onClose, size = 'md' }: Props) {
  useKeyboard('Escape', () => { if (open) onClose(); }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const widths = { sm: 380, md: 480, lg: 640 };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ width: widths[size] }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="modal-header">
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>{title}</h2>
            <button onClick={onClose} className="btn btn-ghost btn-icon">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
