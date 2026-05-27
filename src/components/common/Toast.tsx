import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { useToastStore } from '../../store';

const icons = {
  success: <CheckCircle size={16} color="var(--green)" />,
  error: <XCircle size={16} color="var(--red)" />,
  info: <Info size={16} color="var(--primary)" />,
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {icons[t.type]}
          <span style={{ flex: 1 }}>{t.message}</span>
          <button onClick={() => removeToast(t.id)} className="btn btn-ghost btn-sm btn-icon" style={{ padding: '2px' }}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const { addToast } = useToastStore();
  return {
    success: (msg: string) => addToast('success', msg),
    error: (msg: string) => addToast('error', msg),
    info: (msg: string) => addToast('info', msg),
  };
}
