// Карточка изделия, быстрое оформление предзаказа, отзывы
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { api, ROLES, type Product, type Quote } from '../api';
import { date, isoAfter, money, parseRuDate, ruFromIso } from '../format';
import { useLoad, useStore } from '../store';
import { C } from '../theme';
import { Btn, Card, Chip, Empty, ErrorBox, Input, Loader, Photo, Price, Row, Sheet, Stars, s } from '../ui';

export function ProductScreen({ id }: { id: number }) {
  const { user, notify, push } = useStore();
  const { data: p, error, loading, reload, setData } = useLoad(() => api.get<Product>(`/products/${id}`), [id]);
  const [preorder, setPreorder] = useState(false);
  const [review, setReview] = useState(false);

  if (loading && !p) return <Loader />;
  if (error || !p) return <Empty icon="⚠" title="Изделие не найдено" text={error} />;

  const isCustomer = user?.role_id === ROLES.CUSTOMER;
  const mine = p.reviews?.find((r) => r.user_id === user?.user_id);

  const toggleFav = async () => {
    try {
      if (p.is_favorite) await api.del(`/favorites/${p.product_id}`);
      else await api.post('/favorites', { product_id: p.product_id });
      setData({ ...p, is_favorite: !p.is_favorite });
      notify(p.is_favorite ? 'Удалено из избранного' : 'Добавлено в избранное');
    } catch (e: any) { notify(e.message, 'error'); }
  };

  const removeReview = () => Alert.alert('Удалить отзыв?', '', [
    { text: 'Отмена', style: 'cancel' },
    { text: 'Удалить', style: 'destructive', onPress: async () => {
      try { await api.del(`/reviews/${mine!.review_id}`); notify('Отзыв удалён'); reload(); } catch (e: any) { notify(e.message, 'error'); }
    } },
  ]);

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 30 }}>
      <Photo uri={p.photo} style={{ width: '100%', aspectRatio: 1 }} />
      <View style={s.pad}>
        <Text style={s.muted}>{p.type} · {p.material}</Text>
        <Text style={[s.h1, { marginTop: 4, marginBottom: 6 }]}>{p.title}</Text>
        <Row style={{ marginBottom: 14 }}>
          {p.reviews_count > 0 ? <><Stars value={p.rating} /><Text style={s.muted}>{p.rating} · отзывов: {p.reviews_count}</Text></> : <Text style={s.muted}>Отзывов пока нет</Text>}
        </Row>

        <Card style={{ padding: 16, gap: 10 }}>
          <Price p={p} large />
          {p.is_seasonal && p.season ? (
            <View style={{ backgroundColor: C.blueSoft, padding: 10, borderRadius: 8 }}>
              <Text style={{ color: C.blue }}>❄ Сезонное предложение до {date(p.season.end_date)} (базовая цена {money(p.base_price)})</Text>
            </View>
          ) : null}
          {p.discount ? (
            <View style={{ backgroundColor: C.emberSoft, padding: 10, borderRadius: 8 }}>
              <Text style={{ color: C.ember }}>Скидка «{p.discount.title}»: −{money(p.discount.saved)}</Text>
            </View>
          ) : null}
          {isCustomer ? (
            <>
              <Btn title="Оформить предзаказ" onPress={() => setPreorder(true)} />
              <Row>
                <Btn title={p.is_favorite ? '♥ В избранном' : '♡ В избранное'} kind="ghost" onPress={toggleFav} style={{ flex: 1 }} />
                <Btn title="Написать кузнецу" kind="ghost" onPress={() => push('Chat', { toSmith: true })} style={{ flex: 1 }} />
              </Row>
            </>
          ) : null}
        </Card>

        {p.description ? <View style={{ marginTop: 18 }}><Text style={s.h2}>Описание</Text><Text style={s.text}>{p.description}</Text></View> : null}

        <View style={{ marginTop: 20 }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={[s.h2, { marginBottom: 0 }]}>Отзывы ({p.reviews?.length || 0})</Text>
            {isCustomer && !mine ? <Btn title="Написать" small onPress={() => setReview(true)} /> : null}
          </Row>
          {p.reviews?.map((r) => (
            <Card key={r.review_id} style={{ padding: 14, marginBottom: 10, borderColor: r.user_id === user?.user_id ? C.ember : C.line }}>
              <Row style={{ justifyContent: 'space-between' }}><Text style={s.h3}>{r.full_name}</Text><Text style={s.muted}>{date(r.created_at)}</Text></Row>
              <Stars value={r.rating} size={14} />
              {r.comment ? <Text style={[s.text, { marginTop: 4 }]}>{r.comment}</Text> : null}
              {r.user_id === user?.user_id ? (
                <Row style={{ marginTop: 8 }}>
                  <Btn title="Изменить" kind="ghost" small onPress={() => setReview(true)} />
                  <Btn title="Удалить" kind="danger" small onPress={removeReview} />
                </Row>
              ) : null}
            </Card>
          ))}
        </View>
      </View>

      {preorder ? <PreorderSheet product={p} onClose={() => setPreorder(false)} /> : null}
      {review ? <ReviewSheet productId={p.product_id} existing={mine} onClose={() => setReview(false)} onSaved={reload} /> : null}
    </ScrollView>
  );
}

// ---------- Быстрый предзаказ с сохранёнными контактными данными ----------
function PreorderSheet({ product, onClose }: { product: Product; onClose: () => void }) {
  const { user, notify, refreshUser, reset, push } = useStore();
  const [dateText, setDateText] = useState(ruFromIso(isoAfter(14)));
  const [comment, setComment] = useState('');
  const [points, setPoints] = useState(0);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<Quote>(`/preorders/quote?product_id=${product.product_id}&points=${points}`).then(setQuote).catch((e) => setErrors({ form: e.message }));
  }, [product.product_id, points]);

  const maxPoints = quote ? Math.min(quote.available_points, 30) : 0;

  const submit = async () => {
    const iso = parseRuDate(dateText);
    if (!iso) return setErrors({ date: 'Введите дату в формате ДД.ММ.ГГГГ' });
    if (iso <= isoAfter(0)) return setErrors({ date: 'Дата должна быть позже сегодняшнего дня' });
    if (comment.length > 1000) return setErrors({ comment: 'Не более 1000 символов' });
    setBusy(true);
    try {
      const r = await api.post<{ preorder_id: number }>('/preorders', { product_id: product.product_id, desired_date: iso, comment, points_used: points });
      notify(`Предзаказ №${r.preorder_id} оформлен`);
      refreshUser();
      onClose();
      reset('Orders');
    } catch (e: any) {
      setErrors({ form: e.fields?.desired_date || e.message });
    } finally { setBusy(false); }
  };

  return (
    <Sheet visible title={`Предзаказ: ${product.title}`} onClose={onClose}>
      {errors.form ? <ErrorBox text={errors.form} /> : null}
      <View style={[s.calc, { backgroundColor: C.info }]}>
        <Text style={s.label}>Контактные данные (из профиля)</Text>
        <Text style={s.text}>{user?.full_name}</Text>
        <Text style={s.text}>{user?.phone} · {user?.email}</Text>
        <Text style={{ color: C.ember, marginTop: 4 }} onPress={() => { onClose(); push('Profile'); }}>Изменить в профиле</Text>
      </View>
      <Text style={s.label}>Желаемая дата получения <Text style={{ color: C.ember }}>*</Text></Text>
      <Row style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        {[7, 14, 30].map((d) => <Chip key={d} label={`через ${d} дн.`} active={dateText === ruFromIso(isoAfter(d))} onPress={() => { setDateText(ruFromIso(isoAfter(d))); setErrors({}); }} />)}
      </Row>
      <Input label="Дата (ДД.ММ.ГГГГ)" value={dateText} error={errors.date} keyboardType="numbers-and-punctuation" maxLength={10}
        onChangeText={(t) => { setDateText(t); setErrors({}); }} />
      <Input label="Комментарий" value={comment} error={errors.comment} multiline maxLength={1000}
        hint="Размеры, гравировка, цвет покрытия" onChangeText={setComment} />
      {quote && quote.available_points > 0 ? (
        <View style={s.field}>
          <Text style={s.label}>Списать баллы: {points} (доступно {quote.available_points}, максимум {maxPoints})</Text>
          <Row>
            <Btn title="−5" kind="ghost" small onPress={() => setPoints(Math.max(0, points - 5))} />
            <Btn title="+5" kind="ghost" small onPress={() => setPoints(Math.min(maxPoints, points + 5))} />
            <Btn title="Максимум" kind="ghost" small onPress={() => setPoints(maxPoints)} />
            <Btn title="0" kind="ghost" small onPress={() => setPoints(0)} />
          </Row>
          <Text style={s.hint}>1 балл = 1 % скидки</Text>
        </View>
      ) : null}
      {quote ? (
        <View style={s.calc}>
          <View style={s.calcRow}><Text style={s.text}>Цена изделия</Text><Text style={s.text}>{money(quote.price)}</Text></View>
          {quote.discount ? <View style={s.calcRow}><Text style={[s.text, { flex: 1 }]}>Скидка «{quote.discount.title}»</Text><Text style={s.text}>−{money(quote.discount.saved)}</Text></View> : null}
          {quote.points_used > 0 ? <View style={s.calcRow}><Text style={s.text}>Баллы ({quote.points_used} %)</Text><Text style={s.text}>−{money(quote.points_saved)}</Text></View> : null}
          <View style={[s.calcRow, { borderTopWidth: 1, borderTopColor: C.line2, paddingTop: 8 }]}>
            <Text style={[s.h3, { fontSize: 17 }]}>Итого</Text><Text style={[s.h3, { fontSize: 17 }]}>{money(quote.final_price)}</Text>
          </View>
        </View>
      ) : <Loader />}
      <Btn title={busy ? 'Оформляем…' : 'Подтвердить предзаказ'} onPress={submit} disabled={busy || !quote} />
    </Sheet>
  );
}

function ReviewSheet({ productId, existing, onClose, onSaved }: {
  productId: number; existing?: { review_id: number; rating: number; comment: string | null }; onClose: () => void; onSaved: () => void;
}) {
  const { notify } = useStore();
  const [rating, setRating] = useState(existing?.rating || 5);
  const [comment, setComment] = useState(existing?.comment || '');
  const [error, setError] = useState('');

  const save = async () => {
    if (comment.length > 1000) return setError('Не более 1000 символов');
    try {
      if (existing) await api.put(`/reviews/${existing.review_id}`, { rating, comment });
      else await api.post(`/products/${productId}/reviews`, { rating, comment });
      notify('Отзыв сохранён');
      onSaved();
      onClose();
    } catch (e: any) { setError(e.message); }
  };

  return (
    <Sheet visible title={existing ? 'Изменение отзыва' : 'Новый отзыв'} onClose={onClose}>
      {error ? <ErrorBox text={error} /> : null}
      <Text style={s.label}>Оценка</Text>
      <View style={{ marginBottom: 14 }}><Stars value={rating} onChange={setRating} size={34} /></View>
      <Input label="Текст отзыва" value={comment} multiline maxLength={1000} hint={`${comment.length}/1000`} onChangeText={setComment} />
      <Btn title="Сохранить" onPress={save} />
    </Sheet>
  );
}
