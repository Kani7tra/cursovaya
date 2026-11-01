// Обмен сообщениями: заказчик ↔ кузнец
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { navigate, useRoute } from '../lib/router';
import { ROLES, useAuth } from '../lib/auth';
import { date, initials, time } from '../lib/format';
import { Empty, Loader, Modal, useLoad, useToast } from '../components/ui';

type Dialog = { partner_id: number; full_name: string; role: string; last_message: string; send_at: string; unread: number };
type Message = { message_id: number; sender_id: number; message_text: string; send_at: string; is_read: boolean };
type Partner = { user_id: number; full_name: string };

export default function Messages() {
  const { user, refreshUnread } = useAuth();
  const toast = useToast();
  const { search } = useRoute();
  const dialogs = useLoad(() => api.get<Dialog[]>('/messages/dialogs'), []);
  const [partnerId, setPartnerId] = useState<number | null>(search.get('with') ? Number(search.get('with')) : null);
  const [chat, setChat] = useState<{ partner: Partner; messages: Message[] } | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [picker, setPicker] = useState<Partner[] | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // ?to=smith — открыть диалог с кузнецом из карточки изделия
  useEffect(() => {
    if (search.get('to') === 'smith') {
      api.get<Partner[]>('/messages/partners').then((list) => { if (list[0]) setPartnerId(list[0].user_id); });
    }
  }, []); // eslint-disable-line

  const loadChat = (id: number, silent = false) =>
    api.get<{ partner: Partner; messages: Message[] }>(`/messages/${id}`).then((c) => {
      setChat(c);
      if (!silent) { dialogs.reload(); refreshUnread(); }
    }).catch((e) => toast(e.message, 'error'));

  useEffect(() => {
    if (!partnerId) return;
    loadChat(partnerId);
    const t = window.setInterval(() => loadChat(partnerId, true), 10000);
    return () => window.clearInterval(t);
  }, [partnerId]); // eslint-disable-line

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [chat?.messages.length]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return setError('Введите текст сообщения');
    if (t.length > 2000) return setError('Не более 2000 символов');
    try {
      const m = await api.post<Message>('/messages', { receiver_id: partnerId, message_text: t });
      setChat((c) => c && { ...c, messages: [...c.messages, m] });
      setText(''); setError('');
      dialogs.reload();
    } catch (err: any) { setError(err.message); }
  };

  const newDialog = async () => {
    try { setPicker(await api.get<Partner[]>('/messages/partners')); } catch (e: any) { toast(e.message, 'error'); }
  };

  const open = (id: number) => { setPartnerId(id); navigate(`/messages?with=${id}`, true); };

  return (
    <div className="container page">
      <div className="page-head">
        <h1>Сообщения</h1>
        <button className="btn btn-primary" onClick={newDialog}>+ Новый диалог</button>
      </div>
      <div className={`chat ${partnerId ? 'chat-open' : ''}`}>
        <aside className="chat-list card">
          {dialogs.loading && !dialogs.data ? <Loader /> : dialogs.data && dialogs.data.length ? dialogs.data.map((d) => (
            <button key={d.partner_id} className={`dialog ${d.partner_id === partnerId ? 'active' : ''}`} onClick={() => open(d.partner_id)}>
              <span className="avatar small">{initials(d.full_name)}</span>
              <span className="dialog-body">
                <span className="dialog-top"><b>{d.full_name}</b><small>{date(d.send_at)}</small></span>
                <span className="dialog-last">{d.last_message}</span>
              </span>
              {d.unread > 0 && <span className="badge">{d.unread}</span>}
            </button>
          )) : <p className="muted pad">Диалогов пока нет</p>}
        </aside>

        <section className="chat-window card">
          {!partnerId || !chat ? (
            <Empty icon="✉" title="Выберите диалог" text={user?.role_id === ROLES.CUSTOMER ? 'Задайте кузнецу вопрос по изделию или заказу.' : 'Ответьте заказчику или начните новый диалог.'} />
          ) : (
            <>
              <div className="chat-head">
                <button className="icon-btn back" onClick={() => { setPartnerId(null); navigate('/messages', true); }} aria-label="Назад">←</button>
                <span className="avatar small">{initials(chat.partner.full_name)}</span>
                <b>{chat.partner.full_name}</b>
              </div>
              <div className="chat-messages">
                {chat.messages.length === 0 && <p className="muted center">Напишите первое сообщение</p>}
                {chat.messages.map((m) => (
                  <div key={m.message_id} className={`bubble ${m.sender_id === user?.user_id ? 'out' : 'in'}`}>
                    <p>{m.message_text}</p>
                    <small>{date(m.send_at)} {time(m.send_at)}{m.sender_id === user?.user_id && (m.is_read ? ' · прочитано' : '')}</small>
                  </div>
                ))}
                <div ref={bottom} />
              </div>
              <form className="chat-form" onSubmit={send}>
                <textarea rows={2} placeholder="Введите сообщение…" value={text} maxLength={2000}
                  onChange={(e) => { setText(e.target.value); setError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e as unknown as FormEvent); } }} />
                <button className="btn btn-primary">Отправить</button>
              </form>
              {error && <div className="field-error pad-x">{error}</div>}
            </>
          )}
        </section>
      </div>

      {picker && (
        <Modal title="Новый диалог" onClose={() => setPicker(null)}>
          {picker.length === 0 ? <p className="muted">Нет доступных собеседников</p> : (
            <div className="picker">
              {picker.map((p) => (
                <button key={p.user_id} className="dialog" onClick={() => { setPicker(null); open(p.user_id); }}>
                  <span className="avatar small">{initials(p.full_name)}</span><b>{p.full_name}</b>
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
