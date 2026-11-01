// Страницы входа и регистрации
import { useState, type FormEvent } from 'react';
import { Link, navigate, useRoute } from '../lib/router';
import { ROLES, useAuth } from '../lib/auth';
import { collect, rules } from '../lib/format';
import type { User } from '../lib/types';
import { ErrorBox, Field, useToast } from '../components/ui';

const homeFor = (u: User) => (u.role_id === ROLES.ADMIN ? '/admin/users' : u.role_id === ROLES.SMITH ? '/smith/orders' : '/catalog');

export function Login() {
  const { login } = useAuth();
  const { search } = useRoute();
  const toast = useToast();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = collect({ email: rules.email(form.email), password: rules.required(form.password, 'Пароль') });
    if (errs) return setErrors(errs);
    setBusy(true);
    try {
      const u = await login(form.email.trim(), form.password);
      toast(`Добро пожаловать, ${u.full_name.split(' ')[1] || u.full_name}!`);
      navigate(search.get('next') || homeFor(u), true);
    } catch (err: any) {
      setErrors({ ...(err.fields || {}), form: err.message });
    } finally { setBusy(false); }
  };

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit} noValidate>
        <h1>Вход</h1>
        <p className="muted">Войдите, чтобы оформлять предзаказы и копить баллы</p>
        {errors.form && <ErrorBox text={errors.form} />}
        <Field label="E-mail" required error={errors.email}>
          <input type="email" autoComplete="email" value={form.email} maxLength={64}
            onChange={(e) => { setForm({ ...form, email: e.target.value }); setErrors({}); }} />
        </Field>
        <Field label="Пароль" required error={errors.password}>
          <input type="password" autoComplete="current-password" value={form.password} maxLength={64}
            onChange={(e) => { setForm({ ...form, password: e.target.value }); setErrors({}); }} />
        </Field>
        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? 'Входим…' : 'Войти'}</button>
        <p className="auth-switch">Нет аккаунта? <Link to="/register">Зарегистрироваться</Link></p>
        <details className="demo">
          <summary>Демо-учётные записи</summary>
          <ul>
            <li><code>smirnova@mail.ru</code> / <code>client123</code> — заказчик</li>
            <li><code>kuznec@gigakuznya.ru</code> / <code>kuznec123</code> — кузнец</li>
            <li><code>admin@gigakuznya.ru</code> / <code>admin123</code> — администратор</li>
          </ul>
        </details>
      </form>
    </div>
  );
}

export function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', password: '', password_confirm: '' });
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string) => { setForm({ ...form, [k]: v }); setErrors({ ...errors, [k]: '', form: '' }); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = collect({
      full_name: rules.fullName(form.full_name),
      phone: rules.phone(form.phone),
      email: rules.email(form.email),
      password: rules.password(form.password),
      password_confirm: form.password !== form.password_confirm ? 'Пароли не совпадают' : '',
      agree: agree ? '' : 'Необходимо согласие на обработку персональных данных',
    });
    if (errs) return setErrors(errs);
    setBusy(true);
    try {
      await register(form);
      toast('Регистрация прошла успешно');
      navigate('/catalog', true);
    } catch (err: any) {
      setErrors({ ...(err.fields || {}), form: err.message });
    } finally { setBusy(false); }
  };

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit} noValidate>
        <h1>Регистрация</h1>
        <p className="muted">Создайте личный кабинет заказчика</p>
        {errors.form && <ErrorBox text={errors.form} />}
        <Field label="ФИО" required error={errors.full_name}>
          <input value={form.full_name} maxLength={128} autoComplete="name" placeholder="Иванов Иван Иванович" onChange={(e) => set('full_name', e.target.value)} />
        </Field>
        <Field label="Телефон" required error={errors.phone}>
          <input type="tel" value={form.phone} maxLength={20} autoComplete="tel" placeholder="+79001234567" onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="E-mail" required error={errors.email}>
          <input type="email" value={form.email} maxLength={64} autoComplete="email" placeholder="name@mail.ru" onChange={(e) => set('email', e.target.value)} />
        </Field>
        <div className="row-2">
          <Field label="Пароль" required error={errors.password} hint="Не менее 6 символов, буквы и цифры">
            <input type="password" value={form.password} maxLength={64} autoComplete="new-password" onChange={(e) => set('password', e.target.value)} />
          </Field>
          <Field label="Повтор пароля" required error={errors.password_confirm}>
            <input type="password" value={form.password_confirm} maxLength={64} autoComplete="new-password" onChange={(e) => set('password_confirm', e.target.value)} />
          </Field>
        </div>
        <label className={`check ${errors.agree ? 'has-error' : ''}`}>
          <input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); setErrors({ ...errors, agree: '' }); }} />
          Согласен(на) на обработку персональных данных
        </label>
        {errors.agree && <span className="field-error">{errors.agree}</span>}
        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? 'Создаём…' : 'Зарегистрироваться'}</button>
        <p className="auth-switch">Уже есть аккаунт? <Link to="/login">Войти</Link></p>
      </form>
    </div>
  );
}
