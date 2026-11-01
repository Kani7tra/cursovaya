// Вход, регистрация, настройка адреса сервера
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { getServer, setServer, api } from '../api';
import { collect, rules } from '../format';
import { useStore } from '../store';
import { C } from '../theme';
import { Btn, Card, ErrorBox, Input, Sheet, s } from '../ui';

function Brand() {
  return (
    <View style={{ alignItems: 'center', marginBottom: 22, marginTop: 10 }}>
      <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: C.iron, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 36 }}>⚒</Text>
      </View>
      <Text style={{ fontSize: 30, fontWeight: '800', color: C.ink }}>Гига<Text style={{ color: C.ember }}>Кузня</Text></Text>
      <Text style={s.muted}>кузнечная мастерская</Text>
    </View>
  );
}

export function ServerSettings({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { notify } = useStore();
  const [url, setUrl] = useState(getServer());
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const save = async () => {
    if (!/^(https?:\/\/)?[\w.-]+(:\d+)?\/?$/.test(url.trim())) return setError('Пример адреса: http://192.168.0.105:5000');
    setChecking(true);
    const saved = await setServer(url);
    try {
      await api.get('/info');
      notify(`Сервер ${saved} доступен`);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally { setChecking(false); }
  };

  return (
    <Sheet visible={visible} title="Адрес сервера" onClose={onClose}>
      <Text style={[s.text, { marginBottom: 12 }]}>
        Укажите адрес, который показывает окно сервера на компьютере («в локальной сети»). Телефон и компьютер должны быть подключены к одной Wi-Fi сети.
      </Text>
      <Input label="Адрес сервера" value={url} onChangeText={(t) => { setUrl(t); setError(''); }} error={error}
        autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="http://192.168.0.105:5000" />
      <Btn title={checking ? 'Проверка…' : 'Сохранить и проверить'} onPress={save} disabled={checking} />
    </Sheet>
  );
}

export function LoginScreen() {
  const { login, push } = useStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(false);

  const submit = async () => {
    const errs = collect({ email: rules.email(form.email), password: form.password ? '' : 'Введите пароль' });
    if (errs) return setErrors(errs);
    setBusy(true);
    try { await login(form.email.trim(), form.password); }
    catch (e: any) { setErrors({ form: e.message }); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[s.pad, { flexGrow: 1, justifyContent: 'center' }]} keyboardShouldPersistTaps="handled">
        <Brand />
        <Card style={{ padding: 18 }}>
          <Text style={s.h1}>Вход</Text>
          {errors.form ? <ErrorBox text={errors.form} /> : null}
          <Input label="E-mail" required value={form.email} error={errors.email} autoCapitalize="none" keyboardType="email-address" autoComplete="email"
            onChangeText={(t) => { setForm({ ...form, email: t }); setErrors({}); }} maxLength={64} />
          <Input label="Пароль" required value={form.password} error={errors.password} secureTextEntry
            onChangeText={(t) => { setForm({ ...form, password: t }); setErrors({}); }} maxLength={64} />
          <Btn title={busy ? 'Входим…' : 'Войти'} onPress={submit} disabled={busy} />
          <Pressable onPress={() => push('Register')} style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={s.text}>Нет аккаунта? <Text style={{ color: C.ember, fontWeight: '700' }}>Зарегистрироваться</Text></Text>
          </Pressable>
        </Card>
        <Text style={[s.muted, { textAlign: 'center', marginTop: 14 }]}>Демо: smirnova@mail.ru / client123 (заказчик){'\n'}kuznec@gigakuznya.ru / kuznec123 (кузнец)</Text>
        <Pressable onPress={() => setSettings(true)} style={{ marginTop: 14, alignItems: 'center' }}>
          <Text style={{ color: C.ink2, textDecorationLine: 'underline' }}>⚙ Сервер: {getServer()}</Text>
        </Pressable>
      </ScrollView>
      <ServerSettings visible={settings} onClose={() => setSettings(false)} />
    </KeyboardAvoidingView>
  );
}

export function RegisterScreen() {
  const { register } = useStore();
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', password: '', password_confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) => { setForm({ ...form, [k]: v }); setErrors({ ...errors, [k]: '', form: '' }); };

  const submit = async () => {
    const errs = collect({
      full_name: rules.fullName(form.full_name),
      phone: rules.phone(form.phone),
      email: rules.email(form.email),
      password: rules.password(form.password),
      password_confirm: form.password !== form.password_confirm ? 'Пароли не совпадают' : '',
    });
    if (errs) return setErrors(errs);
    setBusy(true);
    try { await register(form); }
    catch (e: any) { setErrors({ ...(e.fields || {}), form: e.message }); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
        <Card style={{ padding: 18 }}>
          <Text style={s.h1}>Регистрация заказчика</Text>
          {errors.form ? <ErrorBox text={errors.form} /> : null}
          <Input label="ФИО" required value={form.full_name} error={errors.full_name} placeholder="Иванов Иван Иванович" maxLength={128} onChangeText={(t) => set('full_name', t)} />
          <Input label="Телефон" required value={form.phone} error={errors.phone} placeholder="+79001234567" keyboardType="phone-pad" maxLength={20} onChangeText={(t) => set('phone', t)} />
          <Input label="E-mail" required value={form.email} error={errors.email} placeholder="name@mail.ru" autoCapitalize="none" keyboardType="email-address" maxLength={64} onChangeText={(t) => set('email', t)} />
          <Input label="Пароль" required value={form.password} error={errors.password} hint="Не менее 6 символов, буквы и цифры" secureTextEntry maxLength={64} onChangeText={(t) => set('password', t)} />
          <Input label="Повтор пароля" required value={form.password_confirm} error={errors.password_confirm} secureTextEntry maxLength={64} onChangeText={(t) => set('password_confirm', t)} />
          <Btn title={busy ? 'Создаём…' : 'Зарегистрироваться'} onPress={submit} disabled={busy} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
