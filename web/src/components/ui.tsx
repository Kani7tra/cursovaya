// Общие элементы интерфейса
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { STATUS_CLASS } from '../lib/format';

// ---------- Поле формы с подписью и ошибкой ----------
type FieldProps = { label: string; error?: string; hint?: string; required?: boolean; children: ReactNode; className?: string };
export function Field({ label, error, hint, required, children, className }: FieldProps) {
  return (
    <label className={`field ${error ? 'has-error' : ''} ${className || ''}`}>
      <span className="field-label">{label}{required && <i className="req">*</i>}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

// ---------- Модальное окно ----------
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ---------- Всплывающие уведомления ----------
type Toast = { id: number; text: string; kind: 'ok' | 'error' };
const ToastContext = createContext<(text: string, kind?: 'ok' | 'error') => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>)}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);

// ---------- Звёзды рейтинга ----------
export function Stars({ value, onChange, size = 'md' }: { value: number; onChange?: (v: number) => void; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`stars stars-${size} ${onChange ? 'stars-input' : ''}`} aria-label={`Оценка ${value} из 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        onChange
          ? <button type="button" key={n} className={n <= value ? 'on' : ''} onClick={() => onChange(n)} aria-label={`${n} из 5`}>★</button>
          : <span key={n} className={n <= Math.round(value) ? 'on' : ''}>★</span>
      ))}
    </span>
  );
}

export const StatusBadge = ({ status }: { status: string }) => (
  <span className={`status ${STATUS_CLASS[status] || ''}`}>{status}</span>
);

export const Loader = () => <div className="loader"><span /><span /><span /></div>;

export function Empty({ icon = '⚒', title, text, action }: { icon?: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function ErrorBox({ text }: { text: string }) {
  return <div className="alert alert-error">{text}</div>;
}

// Хук загрузки данных с повторным запросом
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    loader().then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}
