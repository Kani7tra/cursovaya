// Администрирование: пользователи и роли, журнал событий
import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { collect, dateTime, rules } from '../../lib/format';
import type { User } from '../../lib/types';
import { PanelLayout } from '../../components/PanelLayout';
import { ErrorBox, Field, Loader, Modal, useLoad, useToast } from '../../components/ui';

const ROLE_NAMES: Record<number, string> = { 1: 'Администратор', 2: 'Кузнец', 3: 'Заказчик' };

export function AdminUsers() {
  const { user: me } = useAuth();
  const toast = useToast();
  const list = useLoad(() => api.get<User[]>('/users'), []);
  const blank = { full_name: '', phone: '', email: '', password: '', new_password: '', role_id: '3', is_blocked: false, bonus_points: '0' };
  const [edit, setEdit] = useState<{ id: number | null; form: typeof blank } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');

  const set = (k: string, v: string | boolean) => { if (edit) { setEdit({ ...edit, form: { ...edit.form, [k]: v } }); setErrors({ ...errors, [k]: '' }); } };

  const openEdit = (u?: User) => {
    setErrors({});
    setEdit(u ? {
      id: u.user_id,
      form: { full_name: u.full_name, phone: u.phone || '', email: u.email, password: '', new_password: '', role_id: String(u.role_id), is_blocked: u.is_blocked, bonus_points: String(u.bonus_points) },
    } : { id: null, form: blank });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    const f = edit.form;
    const errs = collect({
      full_name: rules.fullName(f.full_name),
      phone: rules.phone(f.phone, false),
      email: rules.email(f.email),
      password: edit.id ? '' : rules.password(f.password),
      new_password: edit.id && f.new_password ? rules.password(f.new_password) : '',
      bonus_points: !/^\d+$/.test(f.bonus_points) ? 'Целое неотрицательное число' : '',
    });
    if (errs) return setErrors(errs);
    try {
      if (edit.id) await api.put(`/users/${edit.id}`, { ...f, role_id: Number(f.role_id), bonus_points: Number(f.bonus_points) });
      else await api.post('/users', { ...f, role_id: Number(f.role_id) });
      toast(edit.id ? 'Пользователь обновлён' : 'Пользователь создан');
      setEdit(null); list.reload();
    } catch (err: any) { setErrors({ ...(err.fields || {}), form: err.fields ? '' : err.message }); }
  };

  const toggleBlock = async (u: User) => {
    if (!window.confirm(`${u.is_blocked ? 'Разблокировать' : 'Заблокировать'} пользователя ${u.full_name}?`)) return;
    try { await api.patch(`/users/${u.user_id}/block`); toast(u.is_blocked ? 'Пользователь разблокирован' : 'Пользователь заблокирован'); list.reload(); }
    catch (e: any) { toast(e.message, 'error'); }
  };

  const remove = async (u: User) => {
    if (!window.confirm(`Удалить учётную запись ${u.full_name}? Будут удалены её предзаказы, сообщения и отзывы.`)) return;
    try { await api.del(`/users/${u.user_id}`); toast('Пользователь удалён'); list.reload(); } catch (e: any) { toast(e.message, 'error'); }
  };

  const q = search.trim().toLowerCase();
  const rows = (list.data || []).filter((u) => (!role || String(u.role_id) === role) && (!q || u.full_name.toLowerCase().includes(q) || u.email.includes(q)));

  return (
    <PanelLayout title="Пользователи" actions={<button className="btn btn-primary" onClick={() => openEdit()}>+ Создать пользователя</button>}>
      <div className="toolbar">
        <input type="search" placeholder="Поиск по ФИО или e-mail" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Роль">
          <option value="">Все роли</option>
          {Object.entries(ROLE_NAMES).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
      </div>
      {list.loading ? <Loader /> : list.error ? <ErrorBox text={list.error} /> : (
        <div className="table-wrap card">
          <table className="table">
            <thead><tr><th>ФИО</th><th>E-mail</th><th>Телефон</th><th>Роль</th><th>Баллы</th><th>Состояние</th><th /></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.user_id} className={u.is_blocked ? 'row-muted' : ''}>
                  <td><b>{u.full_name}</b>{u.user_id === me?.user_id && <span className="tag tag-inline">это вы</span>}</td>
                  <td>{u.email}</td>
                  <td>{u.phone || '—'}</td>
                  <td><span className={`role-chip role-${u.role_id}`}>{u.role}</span></td>
                  <td>{u.role_id === 3 ? u.bonus_points : '—'}</td>
                  <td>{u.is_blocked ? <span className="tag tag-inline tag-off">заблокирован</span> : <span className="tag tag-inline tag-on">активен</span>}</td>
                  <td className="actions-cell">
                    <button className="btn btn-sm btn-ghost" onClick={() => openEdit(u)}>Изменить</button>
                    {u.user_id !== me?.user_id && <>
                      <button className="btn btn-sm btn-ghost" onClick={() => toggleBlock(u)}>{u.is_blocked ? 'Разблокировать' : 'Заблокировать'}</button>
                      <button className="btn btn-sm btn-danger-ghost" onClick={() => remove(u)}>Удалить</button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && (
        <Modal title={edit.id ? 'Изменение пользователя' : 'Новый пользователь'} onClose={() => setEdit(null)}>
          <form className="form" onSubmit={save} noValidate>
            {errors.form && <ErrorBox text={errors.form} />}
            <Field label="ФИО" required error={errors.full_name}><input value={edit.form.full_name} maxLength={128} onChange={(e) => set('full_name', e.target.value)} /></Field>
            <div className="row-2">
              <Field label="E-mail" required error={errors.email}><input type="email" value={edit.form.email} maxLength={64} onChange={(e) => set('email', e.target.value)} /></Field>
              <Field label="Телефон" error={errors.phone}><input type="tel" value={edit.form.phone} maxLength={20} onChange={(e) => set('phone', e.target.value)} /></Field>
            </div>
            <div className="row-2">
              <Field label="Роль" required error={errors.role_id}>
                <select value={edit.form.role_id} onChange={(e) => set('role_id', e.target.value)} disabled={edit.id === me?.user_id}>
                  {Object.entries(ROLE_NAMES).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
                </select>
              </Field>
              {edit.id ? (
                <Field label="Бонусные баллы" error={errors.bonus_points} hint="Корректировка при сбоях">
                  <input inputMode="numeric" value={edit.form.bonus_points} onChange={(e) => set('bonus_points', e.target.value.replace(/\D/g, ''))} />
                </Field>
              ) : (
                <Field label="Пароль" required error={errors.password}><input type="password" value={edit.form.password} maxLength={64} onChange={(e) => set('password', e.target.value)} /></Field>
              )}
            </div>
            {edit.id && (
              <Field label="Новый пароль" error={errors.new_password} hint="Оставьте пустым, чтобы не менять">
                <input type="password" value={edit.form.new_password} maxLength={64} autoComplete="new-password" onChange={(e) => set('new_password', e.target.value)} />
              </Field>
            )}
            {edit.id && edit.id !== me?.user_id && (
              <label className="check"><input type="checkbox" checked={edit.form.is_blocked} onChange={(e) => set('is_blocked', e.target.checked)} /> Учётная запись заблокирована</label>
            )}
            <button className="btn btn-primary btn-block">Сохранить</button>
          </form>
        </Modal>
      )}
    </PanelLayout>
  );
}

type Log = { log_id: number; level: string; action: string; details: string | null; created_at: string; full_name: string | null; email: string | null };

export function AdminLogs() {
  const [level, setLevel] = useState('');
  const list = useLoad(() => api.get<Log[]>('/logs' + (level ? `?level=${level}` : '')), [level]);
  return (
    <PanelLayout title="Журнал событий" actions={<button className="btn btn-ghost" onClick={list.reload}>Обновить</button>}>
      <div className="toolbar">
        <div className="chips">
          {[['', 'Все'], ['info', 'Информация'], ['warning', 'Предупреждения'], ['error', 'Ошибки']].map(([v, l]) => (
            <button key={v} className={`chip ${level === v ? 'on' : ''}`} onClick={() => setLevel(v)}>{l}</button>
          ))}
        </div>
      </div>
      {list.loading ? <Loader /> : list.error ? <ErrorBox text={list.error} /> : (
        <div className="table-wrap card">
          <table className="table table-compact">
            <thead><tr><th>Время</th><th>Уровень</th><th>Событие</th><th>Подробности</th><th>Пользователь</th></tr></thead>
            <tbody>
              {list.data?.map((l) => (
                <tr key={l.log_id}>
                  <td className="nowrap">{dateTime(l.created_at)}</td>
                  <td><span className={`level level-${l.level}`}>{l.level === 'error' ? 'ошибка' : l.level === 'warning' ? 'внимание' : 'инфо'}</span></td>
                  <td>{l.action}</td>
                  <td className="muted">{l.details}</td>
                  <td>{l.full_name || <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.data?.length && <p className="muted pad">Записей нет</p>}
        </div>
      )}
    </PanelLayout>
  );
}
