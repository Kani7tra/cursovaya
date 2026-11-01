// Подвал сайта: навигация, контакты, отправка сообщения на почту администратора
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from '../lib/router';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { collect, rules } from '../lib/format';
import type { Info } from '../lib/types';
import { Field, useToast } from './ui';
import { Logo, navItems } from './Header';

export function Footer() {
  const { user } = useAuth();
  const toast = useToast();
  const [info, setInfo] = useState<Info | null>(null);
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { api.get<Info>('/info').then(setInfo).catch(() => {}); }, []);
  useEffect(() => { if (user) setForm((f) => ({ ...f, name: f.name || user.full_name, email: f.email || user.email })); }, [user]);

  const set = (k: string, v: string) => { setForm({ ...form, [k]: v }); setErrors({ ...errors, [k]: '' }); };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = collect({
      name: rules.required(form.name, 'Имя'),
      email: rules.email(form.email),
      message: form.message.trim().length < 10 ? 'Сообщение должно содержать не менее 10 символов' : form.message.length > 1000 ? 'Не более 1000 символов' : '',
    });
    if (errs) return setErrors(errs);
    const to = info?.admin_email || 'admin@gigakuznya.ru';
    const subject = encodeURIComponent(`Сообщение с сайта ГигаКузня от ${form.name}`);
    const body = encodeURIComponent(`${form.message}\n\n— ${form.name}, ${form.email}`);
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    toast('Открыт почтовый клиент — отправьте письмо администратору');
    setForm({ ...form, message: '' });
  };

  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-col footer-brand">
          <Logo />
          <p>Кузнечная мастерская: изделия ручной ковки на заказ, сезонные предложения и бонусы постоянным заказчикам.</p>
        </div>

        <div className="footer-col">
          <h4>Навигация</h4>
          <ul>
            {navItems(user?.role_id).map((i) => <li key={i.to}><Link to={i.to}>{i.label}</Link></li>)}
            {!user && <li><Link to="/login">Вход</Link></li>}
            {!user && <li><Link to="/register">Регистрация</Link></li>}
          </ul>
        </div>

        <div className="footer-col">
          <h4>Контакты</h4>
          <ul className="contacts">
            <li><span>Телефон</span><a href={`tel:${(info?.phone || '+74951234567').replace(/[^\d+]/g, '')}`}>{info?.phone || '+7 (495) 123-45-67'}</a></li>
            <li><span>E-mail</span><a href={`mailto:${info?.admin_email || 'admin@gigakuznya.ru'}`}>{info?.admin_email || 'admin@gigakuznya.ru'}</a></li>
            <li><span>Адрес</span>{info?.address || 'г. Москва, ул. Кузнечная, д. 7'}</li>
            <li><span>Режим работы</span>Пн–Сб, 10:00–19:00</li>
          </ul>
        </div>

        <form className="footer-col footer-form" onSubmit={submit} noValidate>
          <h4>Написать администратору</h4>
          <Field label="Имя" error={errors.name}>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={128} />
          </Field>
          <Field label="E-mail для ответа" error={errors.email}>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} maxLength={64} />
          </Field>
          <Field label="Сообщение" error={errors.message}>
            <textarea rows={3} value={form.message} onChange={(e) => set('message', e.target.value)} maxLength={1000} />
          </Field>
          <button className="btn btn-primary btn-block" type="submit">Отправить</button>
        </form>
      </div>
      <div className="footer-bottom">
        <div className="container">© {new Date().getFullYear()} ГигаКузня. Курсовой проект, группа П-3-23.</div>
      </div>
    </footer>
  );
}
