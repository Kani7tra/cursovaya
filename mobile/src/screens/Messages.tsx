// Сообщения: список диалогов и переписка
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { date, initials, time } from '../format';
import { useLoad, useStore } from '../store';
import { C } from '../theme';
import { Btn, Empty, ErrorBox, Loader, Row, Sheet, s } from '../ui';

type Dialog = { partner_id: number; full_name: string; last_message: string; send_at: string; unread: number };
type Message = { message_id: number; sender_id: number; message_text: string; send_at: string; is_read: boolean };
type Partner = { user_id: number; full_name: string };

const Avatar = ({ name }: { name: string }) => (
  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.iron3, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: C.light, fontWeight: '700' }}>{initials(name)}</Text>
  </View>
);

export function DialogsScreen() {
  const { push, notify } = useStore();
  const list = useLoad(() => api.get<Dialog[]>('/messages/dialogs'), []);
  const [partners, setPartners] = useState<Partner[] | null>(null);

  const openNew = async () => {
    try { setPartners(await api.get<Partner[]>('/messages/partners')); } catch (e: any) { notify(e.message, 'error'); }
  };

  return (
    <View style={s.screen}>
      {list.loading && !list.data ? <Loader /> : (
        <FlatList
          data={list.data || []}
          keyExtractor={(d) => String(d.partner_id)}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={list.loading} onRefresh={list.reload} colors={[C.ember]} />}
          ListHeaderComponent={<Btn title="+ Новый диалог" onPress={openNew} style={{ marginBottom: 12 }} />}
          ListEmptyComponent={list.error ? <ErrorBox text={list.error} /> : <Empty icon="✉" title="Диалогов пока нет" text="Начните новый диалог" />}
          renderItem={({ item: d }) => (
            <Pressable onPress={() => push('Chat', { partnerId: d.partner_id, name: d.full_name })} style={[s.card, { padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
              <Avatar name={d.full_name} />
              <View style={{ flex: 1 }}>
                <Row style={{ justifyContent: 'space-between' }}><Text style={s.h3} numberOfLines={1}>{d.full_name}</Text><Text style={s.muted}>{date(d.send_at)}</Text></Row>
                <Text style={s.muted} numberOfLines={1}>{d.last_message}</Text>
              </View>
              {d.unread > 0 ? <View style={{ backgroundColor: C.ember, borderRadius: 10, minWidth: 20, paddingHorizontal: 6, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{d.unread}</Text></View> : null}
            </Pressable>
          )}
        />
      )}
      <Sheet visible={!!partners} title="Новый диалог" onClose={() => setPartners(null)}>
        {partners?.length === 0 ? <Text style={s.muted}>Нет доступных собеседников</Text> : null}
        {partners?.map((p) => (
          <Pressable key={p.user_id} onPress={() => { setPartners(null); push('Chat', { partnerId: p.user_id, name: p.full_name }); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
            <Avatar name={p.full_name} /><Text style={s.h3}>{p.full_name}</Text>
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

export function ChatScreen({ partnerId: initialId, toSmith }: { partnerId?: number; toSmith?: boolean }) {
  const { user, refreshUnread, notify } = useStore();
  const [partnerId, setPartnerId] = useState<number | null>(initialId || null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const listRef = useRef<FlatList<Message>>(null);

  // Переход «Написать кузнецу»: берём первого доступного кузнеца
  useEffect(() => {
    if (toSmith && !partnerId) {
      api.get<Partner[]>('/messages/partners').then((l) => (l[0] ? setPartnerId(l[0].user_id) : setError('Кузнец не найден'))).catch((e) => setError(e.message));
    }
  }, [toSmith, partnerId]);

  useEffect(() => {
    if (!partnerId) return;
    const load = () => api.get<{ messages: Message[] }>(`/messages/${partnerId}`).then((r) => { setMessages(r.messages); refreshUnread(); }).catch((e) => setError(e.message));
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [partnerId, refreshUnread]);

  const send = async () => {
    const t = text.trim();
    if (!t) return setError('Введите текст сообщения');
    try {
      const m = await api.post<Message>('/messages', { receiver_id: partnerId, message_text: t });
      setMessages((list) => [...(list || []), m]);
      setText(''); setError('');
    } catch (e: any) { notify(e.message, 'error'); }
  };

  if (!messages) return error ? <View style={s.pad}><ErrorBox text={error} /></View> : <Loader />;

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => String(m.message_id)}
        contentContainerStyle={{ padding: 14, gap: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={<Text style={[s.muted, { textAlign: 'center', marginTop: 30 }]}>Напишите первое сообщение</Text>}
        renderItem={({ item: m }) => {
          const out = m.sender_id === user?.user_id;
          return (
            <View style={{ alignSelf: out ? 'flex-end' : 'flex-start', maxWidth: '82%', backgroundColor: out ? C.iron : '#fff', padding: 10, borderRadius: 14,
              borderBottomRightRadius: out ? 4 : 14, borderBottomLeftRadius: out ? 14 : 4 }}>
              <Text style={{ color: out ? C.light : C.ink, fontSize: 15 }}>{m.message_text}</Text>
              <Text style={{ color: out ? '#a89a8a' : C.muted, fontSize: 11, marginTop: 3 }}>{date(m.send_at)} {time(m.send_at)}{out && m.is_read ? ' · прочитано' : ''}</Text>
            </View>
          );
        }}
      />
      {error ? <Text style={[s.error, { paddingHorizontal: 14 }]}>{error}</Text> : null}
      <Row style={{ padding: 10, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.paper }}>
        <TextInput value={text} onChangeText={(t) => { setText(t); setError(''); }} placeholder="Сообщение…" placeholderTextColor={C.muted}
          multiline maxLength={2000} style={[s.input, { flex: 1, maxHeight: 110 }]} />
        <Btn title="➤" onPress={send} style={{ paddingHorizontal: 16 }} />
      </Row>
    </KeyboardAvoidingView>
  );
}
