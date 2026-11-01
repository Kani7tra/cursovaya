// Сезонные цены и скидки
import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { collect, date, money, todayISO } from '../../lib/format';
import type { Product } from '../../lib/types';
import { PanelLayout } from '../../components/PanelLayout';
import { ErrorBox, Field, Loader, Modal, useLoad, useToast } from '../../components/ui';

type Seasonal = { seasonal_price_id: number; product_id: number; product_title: string; base_price: number; seasonal_price: number; start_date: string; end_date: string; is_active: boolean; is_current: boolean };
type Discount = { discount_id: number; title: string; discount_type: 'percent' | 'fixed'; amount: number; product_id: number | null; product_title: string | null; user_id: number | null; user_name: string | null; start_date: string; end_date: string; is_active: boolean; is_current: boolean };

const periodErrors = (start: string, end: string) => ({
  start_date: !start ? 'Укажите дату начала' : '',
  end_date: !end ? 'Укажите дату окончания' : start && end < start ? 'Дата окончания раньше даты начала' : '',
});

function StateTag({ active, current }: { active: boolean; current: boolean }) {
  if (!active) return <span className="tag tag-inline tag-off">выключена</span>;
  return current ? <span className="tag tag-inline tag-on">действует</span> : <span className="tag tag-inline">запланирована / истекла</span>;
}

export function SmithSeasonal() {
  const toast = useToast();
  const list = useLoad(() => api.get<Seasonal[]>('/seasonal-prices'), []);
  const products = useLoad(() => api.get<Product[]>('/products?sort=title'), []);
  const blank = { product_id: '', seasonal_price: '', start_date: todayISO(), end_date: todayISO(90), is_active: true };
  const [edit, setEdit] = useState<{ id: number | null; form: typeof blank } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string | boolean) => { if (edit) { setEdit({ ...edit, form: { ...edit.form, [k]: v } }); setErrors({ ...errors, [k]: '' }); } };
  const base = products.data?.find((p) => String(p.product_id) === edit?.form.product_id)?.base_price;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    const f = edit.form;
    const price = Number(String(f.seasonal_price).replace(',', '.'));
    const errs = collect({
      product_id: !f.product_id ? 'Выберите изделие' : '',
      seasonal_price: !f.seasonal_price ? 'Укажите сезонную цену' : isNaN(price) || price < 1 ? 'Цена должна быть числом не меньше 1' : '',
      ...periodErrors(f.start_date, f.end_date),
    });
    if (errs) return setErrors(errs);
    try {
      if (edit.id) await api.put(`/seasonal-prices/${edit.id}`, f); else await api.post('/seasonal-prices', f);
      toast('Сезонная цена сохранена'); setEdit(null); list.reload();
    } catch (err: any) { setErrors({ ...(err.fields || {}), form: err.fields ? '' : err.message }); }
  };

  const remove = async (s: Seasonal) => {
    if (!window.confirm('Удалить сезонную цену?')) return;
    try { await api.del(`/seasonal-prices/${s.seasonal_price_id}`); toast('Удалено'); list.reload(); } catch (e: any) { toast(e.message, 'error'); }
  };

  const toggle = async (s: Seasonal) => {
    try {
      await api.put(`/seasonal-prices/${s.seasonal_price_id}`, { ...s, is_active: !s.is_active });
      toast(s.is_active ? 'Сезонная цена выключена' : 'Сезонная цена активирована'); list.reload();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  return (
    <PanelLayout title="Сезонные цены" actions={<button className="btn btn-primary" onClick={() => { setErrors({}); setEdit({ id: null, form: blank }); }}>+ Сезонная цена</button>}>
      <div className="alert alert-info">В период действия активной сезонной цены заказчик видит её вместо базовой с пометкой «Сезонное предложение».</div>
      {list.loading ? <Loader /> : list.error ? <ErrorBox text={list.error} /> : (
        <div className="table-wrap card">
          <table className="table">
            <thead><tr><th>Изделие</th><th>Базовая</th><th>Сезонная</th><th>Период</th><th>Состояние</th><th /></tr></thead>
            <tbody>
              {list.data?.map((s) => (
                <tr key={s.seasonal_price_id}>
                  <td><b>{s.product_title}</b></td>
                  <td>{money(s.base_price)}</td>
                  <td><b>{money(s.seasonal_price)}</b> <span className={s.seasonal_price < s.base_price ? 'down' : 'up'}>{s.seasonal_price < s.base_price ? '▼' : '▲'}{Math.abs(Math.round((s.seasonal_price / s.base_price - 1) * 100))}%</span></td>
                  <td>{date(s.start_date)} — {date(s.end_date)}</td>
                  <td><StateTag active={s.is_active} current={s.is_current} /></td>
                  <td className="nowrap">
                    <button className="btn btn-sm btn-ghost" onClick={() => toggle(s)}>{s.is_active ? 'Выключить' : 'Активировать'}</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => { setErrors({}); setEdit({ id: s.seasonal_price_id, form: { product_id: String(s.product_id), seasonal_price: String(s.seasonal_price), start_date: s.start_date, end_date: s.end_date, is_active: s.is_active } }); }}>Изменить</button>
                    <button className="btn btn-sm btn-danger-ghost" onClick={() => remove(s)}>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.data?.length && <p className="muted pad">Сезонных цен пока нет</p>}
        </div>
      )}
      {edit && (
        <Modal title={edit.id ? 'Изменение сезонной цены' : 'Новая сезонная цена'} onClose={() => setEdit(null)}>
          <form className="form" onSubmit={save} noValidate>
            {errors.form && <ErrorBox text={errors.form} />}
            <Field label="Изделие" required error={errors.product_id}>
              <select value={edit.form.product_id} onChange={(e) => set('product_id', e.target.value)}>
                <option value="">— выберите —</option>
                {products.data?.map((p) => <option key={p.product_id} value={p.product_id}>{p.title}</option>)}
              </select>
            </Field>
            <Field label="Сезонная цена, ₽" required error={errors.seasonal_price} hint={base ? `Базовая цена: ${money(base)}` : undefined}>
              <input inputMode="decimal" value={edit.form.seasonal_price} onChange={(e) => set('seasonal_price', e.target.value.replace(/[^\d.,]/g, ''))} />
            </Field>
            <div className="row-2">
              <Field label="Дата начала" required error={errors.start_date}><input type="date" value={edit.form.start_date} onChange={(e) => set('start_date', e.target.value)} /></Field>
              <Field label="Дата окончания" required error={errors.end_date}><input type="date" min={edit.form.start_date} value={edit.form.end_date} onChange={(e) => set('end_date', e.target.value)} /></Field>
            </div>
            <label className="check"><input type="checkbox" checked={edit.form.is_active} onChange={(e) => set('is_active', e.target.checked)} /> Активна</label>
            <button className="btn btn-primary btn-block">Сохранить</button>
          </form>
        </Modal>
      )}
    </PanelLayout>
  );
}

export function SmithDiscounts() {
  const toast = useToast();
  const list = useLoad(() => api.get<Discount[]>('/discounts'), []);
  const products = useLoad(() => api.get<Product[]>('/products?sort=title'), []);
  const customers = useLoad(() => api.get<{ user_id: number; full_name: string }[]>('/customers'), []);
  const blank = { title: '', discount_type: 'percent', amount: '', product_id: '', user_id: '', start_date: todayISO(), end_date: todayISO(30), is_active: true };
  const [edit, setEdit] = useState<{ id: number | null; form: typeof blank } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string | boolean) => { if (edit) { setEdit({ ...edit, form: { ...edit.form, [k]: v } }); setErrors({ ...errors, [k]: '' }); } };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    const f = edit.form;
    const amount = Number(String(f.amount).replace(',', '.'));
    const errs = collect({
      title: !f.title.trim() ? 'Укажите название скидки' : '',
      amount: !f.amount ? 'Укажите размер скидки' : isNaN(amount) || amount <= 0 ? 'Размер должен быть больше нуля'
        : f.discount_type === 'percent' && amount > 100 ? 'Процент не может быть больше 100' : '',
      ...periodErrors(f.start_date, f.end_date),
    });
    if (errs) return setErrors(errs);
    try {
      if (edit.id) await api.put(`/discounts/${edit.id}`, f); else await api.post('/discounts', f);
      toast('Скидка сохранена'); setEdit(null); list.reload();
    } catch (err: any) { setErrors({ ...(err.fields || {}), form: err.fields ? '' : err.message }); }
  };

  const remove = async (d: Discount) => {
    if (!window.confirm(`Удалить скидку «${d.title}»?`)) return;
    try { await api.del(`/discounts/${d.discount_id}`); toast('Скидка удалена'); list.reload(); } catch (e: any) { toast(e.message, 'error'); }
  };

  const toggle = async (d: Discount) => {
    try {
      await api.put(`/discounts/${d.discount_id}`, { ...d, is_active: !d.is_active });
      toast(d.is_active ? 'Скидка выключена' : 'Скидка активирована'); list.reload();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const openEdit = (d?: Discount) => {
    setErrors({});
    setEdit(d ? {
      id: d.discount_id,
      form: { title: d.title, discount_type: d.discount_type, amount: String(d.amount), product_id: d.product_id ? String(d.product_id) : '', user_id: d.user_id ? String(d.user_id) : '', start_date: d.start_date, end_date: d.end_date, is_active: d.is_active },
    } : { id: null, form: blank });
  };

  return (
    <PanelLayout title="Скидки" actions={<button className="btn btn-primary" onClick={() => openEdit()}>+ Создать скидку</button>}>
      <div className="alert alert-info">Скидка может действовать на все изделия или на одно, для всех заказчиков или персонально. При оформлении предзаказа автоматически применяется самая выгодная активная скидка.</div>
      {list.loading ? <Loader /> : list.error ? <ErrorBox text={list.error} /> : (
        <div className="table-wrap card">
          <table className="table">
            <thead><tr><th>Название</th><th>Размер</th><th>Изделие</th><th>Заказчик</th><th>Период</th><th>Состояние</th><th /></tr></thead>
            <tbody>
              {list.data?.map((d) => (
                <tr key={d.discount_id}>
                  <td><b>{d.title}</b></td>
                  <td>{d.discount_type === 'percent' ? `${d.amount} %` : money(d.amount)}</td>
                  <td>{d.product_title || <span className="muted">все изделия</span>}</td>
                  <td>{d.user_name || <span className="muted">все заказчики</span>}</td>
                  <td>{date(d.start_date)} — {date(d.end_date)}</td>
                  <td><StateTag active={d.is_active} current={d.is_current} /></td>
                  <td className="nowrap">
                    <button className="btn btn-sm btn-ghost" onClick={() => toggle(d)}>{d.is_active ? 'Выключить' : 'Активировать'}</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => openEdit(d)}>Изменить</button>
                    <button className="btn btn-sm btn-danger-ghost" onClick={() => remove(d)}>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.data?.length && <p className="muted pad">Скидок пока нет</p>}
        </div>
      )}
      {edit && (
        <Modal title={edit.id ? 'Изменение скидки' : 'Новая скидка'} onClose={() => setEdit(null)}>
          <form className="form" onSubmit={save} noValidate>
            {errors.form && <ErrorBox text={errors.form} />}
            <Field label="Название" required error={errors.title}><input value={edit.form.title} maxLength={128} onChange={(e) => set('title', e.target.value)} /></Field>
            <div className="row-2">
              <Field label="Тип скидки" required>
                <select value={edit.form.discount_type} onChange={(e) => set('discount_type', e.target.value)}>
                  <option value="percent">Процентная, %</option>
                  <option value="fixed">Фиксированная, ₽</option>
                </select>
              </Field>
              <Field label="Размер" required error={errors.amount}>
                <input inputMode="decimal" value={edit.form.amount} onChange={(e) => set('amount', e.target.value.replace(/[^\d.,]/g, ''))} />
              </Field>
            </div>
            <Field label="Изделие" hint="Оставьте пустым — скидка на все изделия">
              <select value={edit.form.product_id} onChange={(e) => set('product_id', e.target.value)}>
                <option value="">Все изделия</option>
                {products.data?.map((p) => <option key={p.product_id} value={p.product_id}>{p.title}</option>)}
              </select>
            </Field>
            <Field label="Заказчик" hint="Оставьте пустым — скидка для всех заказчиков">
              <select value={edit.form.user_id} onChange={(e) => set('user_id', e.target.value)}>
                <option value="">Все заказчики</option>
                {customers.data?.map((c) => <option key={c.user_id} value={c.user_id}>{c.full_name}</option>)}
              </select>
            </Field>
            <div className="row-2">
              <Field label="Дата начала" required error={errors.start_date}><input type="date" value={edit.form.start_date} onChange={(e) => set('start_date', e.target.value)} /></Field>
              <Field label="Дата окончания" required error={errors.end_date}><input type="date" min={edit.form.start_date} value={edit.form.end_date} onChange={(e) => set('end_date', e.target.value)} /></Field>
            </div>
            <label className="check"><input type="checkbox" checked={edit.form.is_active} onChange={(e) => set('is_active', e.target.checked)} /> Активна</label>
            <button className="btn btn-primary btn-block">Сохранить</button>
          </form>
        </Modal>
      )}
    </PanelLayout>
  );
}
