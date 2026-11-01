// Избранное, мои предзаказы, профиль / личный кабинет
import { useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { api, getServer, ROLES, type Preorder, type Product, type User } from '../api';
import { collect, date, dateTime, money, rules } from '../format';
import { useLoad, useStore } from '../store';
import { C, STATUSES } from '../theme';
import { Btn, Card, Chip, Empty, ErrorBox, Input, Loader, Row, StatusBadge, s } from '../ui';
import { ProductTile } from './Catalog';
import { ServerSettings } from './Auth';

export function FavoritesScreen() {
  const { width } = useWindowDimensions();
  const { reset } = useStore();
  const list = useLoad(() => api.get<Product[]>('/favorites'), []);
  const tileW = (width - 16 * 2 - 12) / 2;
  if (list.loading && !list.data) return <Loader />;
  return (
    <FlatList
      style={s.screen}
      data={list.data || []}
      keyExtractor={(p) => String(p.product_id)}
      numColumns={2}
      columnWrapperStyle={{ justifyContent: 'space-between' }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={list.loading} onRefresh={list.reload} colors={[C.ember]} />}
      renderItem={({ item }) => (
        <ProductTile p={{ ...item, rating: 0, reviews_count: 0 }} width={tileW}
          onFav={(fav) => !fav && list.setData((d) => d && d.filter((x) => x.product_id !== item.product_id))} />
      )}
      ListEmptyComponent={list.error ? <ErrorBox text={list.error} /> : (
        <Empty icon="♡" title="В избранном пусто" text="Нажмите ♡ на карточке изделия" action={<Btn title="В каталог" onPress={() => reset('Catalog')} />} />
      )}
    />
  );
}

const PROGRESS = STATUSES.slice(0, 5);

export function OrdersScreen() {
  const { notify, refreshUser, push, reset } = useStore();
  const list = useLoad(() => api.get<Preorder[]>('/preorders/my'), []);
  const [filter, setFilter] = useState('');

  const cancel = (o: Preorder) => Alert.alert(`Отменить предзаказ №${o.preorder_id}?`, o.product_title, [
    { text: 'Нет', style: 'cancel' },
    { text: 'Отменить', style: 'destructive', onPress: async () => {
      try { await api.patch(`/preorders/${o.preorder_id}/cancel`); notify('Предзаказ отменён'); list.reload(); refreshUser(); }
      catch (e: any) { notify(e.message, 'error'); }
    } },
  ]);

  const rows = (list.data || []).filter((o) => !filter || o.status === filter);

  return (
    <View style={s.screen}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 16, paddingBottom: 6 }}>
        {['', ...STATUSES].map((st) => <Chip key={st || 'all'} label={st || 'Все'} active={filter === st} onPress={() => setFilter(st)} />)}
      </ScrollView>
      {list.loading && !list.data ? <Loader /> : (
        <FlatList
          data={rows}
          keyExtractor={(o) => String(o.preorder_id)}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={list.loading} onRefresh={list.reload} colors={[C.ember]} />}
          ListEmptyComponent={list.error ? <ErrorBox text={list.error} /> : (
            <Empty icon="📋" title={filter ? 'Нет предзаказов с таким статусом' : 'Предзаказов пока нет'} action={<Btn title="Выбрать изделие" onPress={() => reset('Catalog')} />} />
          )}
          renderItem={({ item: o }) => {
            const step = PROGRESS.indexOf(o.status);
            return (
              <Card style={{ padding: 14, marginBottom: 12, gap: 10 }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.muted}>№{o.preorder_id} от {dateTime(o.created_at)}</Text>
                    <Text style={s.h3} onPress={() => push('Product', { id: o.product_id })}>{o.product_title}</Text>
                  </View>
                  <StatusBadge status={o.status} />
                </Row>
                {o.status !== 'Отменён' ? (
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {PROGRESS.map((st, i) => <View key={st} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= step ? C.ember : C.line2 }} />)}
                  </View>
                ) : null}
                <Row style={{ justifyContent: 'space-between' }}>
                  <View><Text style={s.muted}>Желаемая дата</Text><Text style={s.text}>{date(o.desired_date)}</Text></View>
                  <View style={{ alignItems: 'flex-end' }}><Text style={s.muted}>Сумма</Text><Text style={[s.text, { fontWeight: '700' }]}>{money(o.final_price)}</Text></View>
                </Row>
                {o.points_used > 0 ? <Text style={s.muted}>Списано баллов: {o.points_used}</Text> : null}
                {o.comment ? <Text style={s.muted}>Комментарий: {o.comment}</Text> : null}
                <Row>
                  <Btn title="Написать кузнецу" kind="ghost" small onPress={() => push('Chat', { toSmith: true })} />
                  {o.status === 'Новый' ? <Btn title="Отменить" kind="danger" small onPress={() => cancel(o)} /> : null}
                </Row>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

export function ProfileScreen() {
  const { user, setUser, notify, logout, reset } = useStore();
  const isCustomer = user?.role_id === ROLES.CUSTOMER;
  const orders = useLoad(() => (isCustomer ? api.get<Preorder[]>('/preorders/my') : Promise.resolve([] as Preorder[])), [isCustomer]);
  const [form, setForm] = useState({ full_name: user?.full_name || '', phone: user?.phone || '', email: user?.email || '' });
  const [pwd, setPwd] = useState({ old_password: '', new_password: '', new_password_confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pwdErrors, setPwdErrors] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState(false);
  if (!user) return null;

  const save = async () => {
    const errs = collect({ full_name: rules.fullName(form.full_name), phone: rules.phone(form.phone), email: rules.email(form.email) });
    if (errs) return setErrors(errs);
    try { setUser(await api.put<User>('/profile', form)); setErrors({}); notify('Данные сохранены'); }
    catch (e: any) { setErrors({ ...(e.fields || {}), form: e.message }); }
  };

  const savePwd = async () => {
    const errs = collect({
      old_password: pwd.old_password ? '' : 'Введите текущий пароль',
      new_password: rules.password(pwd.new_password),
      new_password_confirm: pwd.new_password !== pwd.new_password_confirm ? 'Пароли не совпадают' : '',
    });
    if (errs) return setPwdErrors(errs);
    try { await api.put('/profile/password', pwd); setPwd({ old_password: '', new_password: '', new_password_confirm: '' }); setPwdErrors({}); notify('Пароль изменён'); }
    catch (e: any) { setPwdErrors({ ...(e.fields || {}), form: e.message }); }
  };

  const list = orders.data || [];
  const active = list.filter((o) => !['Отгружен', 'Отменён'].includes(o.status)).length;
  const done = list.filter((o) => o.status === 'Отгружен').length;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
      {isCustomer ? (
        <>
          <View style={{ backgroundColor: C.iron, borderRadius: 14, padding: 18, marginBottom: 12 }}>
            <Text style={{ color: '#cfc2b2', fontSize: 13 }}>Бонусные баллы</Text>
            <Text style={{ color: '#ffb26b', fontSize: 36, fontWeight: '800' }}>★ {user.bonus_points}</Text>
            <Text style={{ color: '#cfc2b2', fontSize: 12.5 }}>1 балл = 1 % скидки, до 30 % заказа. 10 баллов за каждые 1000 ₽.</Text>
          </View>
          <Row style={{ marginBottom: 18 }}>
            <Pressable style={[s.card, { flex: 1, padding: 14 }]} onPress={() => reset('Orders')}>
              <Text style={s.muted}>Активные заказы</Text><Text style={{ fontSize: 26, fontWeight: '800', color: C.ink }}>{active}</Text>
            </Pressable>
            <View style={[s.card, { flex: 1, padding: 14 }]}>
              <Text style={s.muted}>Выполнено</Text><Text style={{ fontSize: 26, fontWeight: '800', color: C.ink }}>{done}</Text>
            </View>
          </Row>
        </>
      ) : null}

      <Card style={{ padding: 16, marginBottom: 14 }}>
        <Text style={s.h2}>Личные данные</Text>
        <Text style={[s.muted, { marginBottom: 10 }]}>Роль: {user.role}</Text>
        {errors.form ? <ErrorBox text={errors.form} /> : null}
        <Input label="ФИО" required value={form.full_name} error={errors.full_name} maxLength={128} onChangeText={(t) => setForm({ ...form, full_name: t })} />
        <Input label="Телефон" required value={form.phone} error={errors.phone} keyboardType="phone-pad" maxLength={20} onChangeText={(t) => setForm({ ...form, phone: t })} />
        <Input label="E-mail" required value={form.email} error={errors.email} autoCapitalize="none" keyboardType="email-address" maxLength={64} onChangeText={(t) => setForm({ ...form, email: t })} />
        <Btn title="Сохранить" onPress={save} />
      </Card>

      <Card style={{ padding: 16, marginBottom: 14 }}>
        <Text style={s.h2}>Смена пароля</Text>
        {pwdErrors.form ? <ErrorBox text={pwdErrors.form} /> : null}
        <Input label="Текущий пароль" value={pwd.old_password} error={pwdErrors.old_password} secureTextEntry maxLength={64} onChangeText={(t) => setPwd({ ...pwd, old_password: t })} />
        <Input label="Новый пароль" value={pwd.new_password} error={pwdErrors.new_password} hint="Не менее 6 символов, буквы и цифры" secureTextEntry maxLength={64} onChangeText={(t) => setPwd({ ...pwd, new_password: t })} />
        <Input label="Повтор нового пароля" value={pwd.new_password_confirm} error={pwdErrors.new_password_confirm} secureTextEntry maxLength={64} onChangeText={(t) => setPwd({ ...pwd, new_password_confirm: t })} />
        <Btn title="Изменить пароль" kind="dark" onPress={savePwd} />
      </Card>

      <Btn title={`⚙ Сервер: ${getServer()}`} kind="ghost" onPress={() => setSettings(true)} style={{ marginBottom: 10 }} />
      <Btn title="Выйти из аккаунта" kind="danger" onPress={logout} />
      <ServerSettings visible={settings} onClose={() => setSettings(false)} />
    </ScrollView>
  );
}
