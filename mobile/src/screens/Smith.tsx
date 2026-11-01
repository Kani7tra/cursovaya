// Кузнец: обработка предзаказов удалённо (смена статуса, связь с заказчиком)
import { useState } from 'react';
import { Alert, FlatList, Linking, RefreshControl, ScrollView, Text, View } from 'react-native';
import { api, type Preorder } from '../api';
import { date, dateTime, money } from '../format';
import { useLoad, useStore } from '../store';
import { C, STATUSES } from '../theme';
import { Btn, Card, Chip, Empty, ErrorBox, Loader, Row, Sheet, StatusBadge, s } from '../ui';

export function SmithOrdersScreen() {
  const { notify, push } = useStore();
  const [status, setStatus] = useState('');
  const list = useLoad(() => api.get<Preorder[]>('/preorders' + (status ? `?status=${encodeURIComponent(status)}` : '')), [status]);
  const [view, setView] = useState<Preorder | null>(null);

  const change = (o: Preorder, st: string) => {
    const doIt = async () => {
      try {
        await api.patch(`/preorders/${o.preorder_id}/status`, { status: st });
        notify(`№${o.preorder_id}: «${st}». Заказчик уведомлён`);
        setView(null);
        list.reload();
      } catch (e: any) { notify(e.message, 'error'); }
    };
    if (['Отгружен', 'Отменён'].includes(st)) {
      Alert.alert(`Статус «${st}»?`, 'Предзаказ будет завершён.', [{ text: 'Нет', style: 'cancel' }, { text: 'Да', onPress: doIt }]);
    } else doIt();
  };

  const closed = (o: Preorder) => ['Отгружен', 'Отменён'].includes(o.status);

  return (
    <View style={s.screen}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 16, paddingBottom: 6 }}>
        {['', ...STATUSES].map((st) => <Chip key={st || 'all'} label={st || 'Все'} active={status === st} onPress={() => setStatus(st)} />)}
      </ScrollView>
      {list.loading && !list.data ? <Loader /> : (
        <FlatList
          data={list.data || []}
          keyExtractor={(o) => String(o.preorder_id)}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={list.loading} onRefresh={list.reload} colors={[C.ember]} />}
          ListEmptyComponent={list.error ? <ErrorBox text={list.error} /> : <Empty icon="📋" title="Предзаказов нет" />}
          renderItem={({ item: o }) => (
            <Card style={{ padding: 14, marginBottom: 10, gap: 6 }}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.muted}>№{o.preorder_id} · {dateTime(o.created_at)}</Text>
                  <Text style={s.h3}>{o.product_title}</Text>
                  <Text style={s.text}>{o.full_name}</Text>
                </View>
                <StatusBadge status={o.status} />
              </Row>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={s.muted}>К дате: {date(o.desired_date)}</Text>
                <Text style={[s.text, { fontWeight: '700' }]}>{money(o.final_price)}</Text>
              </Row>
              <Btn title="Обработать" kind="dark" small onPress={() => setView(o)} />
            </Card>
          )}
        />
      )}

      <Sheet visible={!!view} title={view ? `Предзаказ №${view.preorder_id}` : ''} onClose={() => setView(null)}>
        {view ? (
          <>
            <View style={{ gap: 6, marginBottom: 14 }}>
              <Row><Text style={s.muted}>Статус:</Text><StatusBadge status={view.status} /></Row>
              <Text style={s.text}>Изделие: <Text style={{ fontWeight: '700' }}>{view.product_title}</Text></Text>
              <Text style={s.text}>Заказчик: {view.full_name}</Text>
              <Text style={s.text}>Телефон: {view.phone || '—'}</Text>
              <Text style={s.text}>E-mail: {view.email}</Text>
              <Text style={s.text}>Желаемая дата: {date(view.desired_date)}</Text>
              <Text style={s.text}>Сумма: {money(view.final_price)}{view.points_used ? ` (баллов: ${view.points_used})` : ''}</Text>
              <Text style={s.text}>Комментарий: {view.comment || '—'}</Text>
            </View>
            {!closed(view) ? (
              <>
                <Text style={s.label}>Изменить статус</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {STATUSES.filter((st) => st !== view.status).map((st) => <Chip key={st} label={`→ ${st}`} onPress={() => change(view, st)} />)}
                </View>
              </>
            ) : <Text style={[s.muted, { marginBottom: 14 }]}>Предзаказ завершён.</Text>}
            <Row>
              <Btn title="Написать" kind="ghost" style={{ flex: 1 }} onPress={() => { const id = view.user_id; const name = view.full_name; setView(null); push('Chat', { partnerId: id, name }); }} />
              {view.phone ? <Btn title="Позвонить" kind="ghost" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${view.phone}`)} /> : null}
            </Row>
          </>
        ) : null}
      </Sheet>
    </View>
  );
}
