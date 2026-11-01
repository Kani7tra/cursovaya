// Общие элементы интерфейса мобильного приложения
import type { ReactNode } from 'react';
import {
  ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { C, STATUS_COLORS } from './theme';
import { money } from './format';
import type { Product } from './api';

type BtnKind = 'primary' | 'ghost' | 'dark' | 'danger';

export function Btn({ title, onPress, kind = 'primary', small, disabled, style }: {
  title: string; onPress: () => void; kind?: BtnKind; small?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.btn, (s as any)[`btn_${kind}`], small && s.btnSmall, (pressed || disabled) && { opacity: 0.7 }, style]}
    >
      <Text style={[s.btnText, (s as any)[`btnText_${kind}`], small && { fontSize: 13 }]}>{title}</Text>
    </Pressable>
  );
}

export function Input({ label, error, hint, required, ...props }: TextInputProps & { label: string; error?: string; hint?: string; required?: boolean }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}{required ? <Text style={{ color: C.ember }}> *</Text> : null}</Text>
      <TextInput placeholderTextColor={C.muted} {...props} style={[s.input, props.multiline && s.textarea, !!error && s.inputError, props.style]} />
      {error ? <Text style={s.error}>{error}</Text> : hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export const Card = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[s.card, style]}>{children}</View>
);

export const Loader = () => <View style={{ padding: 40 }}><ActivityIndicator size="large" color={C.ember} /></View>;

export function Empty({ icon = '⚒', title, text, action }: { icon?: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}><Text style={{ fontSize: 34 }}>{icon}</Text></View>
      <Text style={s.emptyTitle}>{title}</Text>
      {text ? <Text style={s.emptyText}>{text}</Text> : null}
      {action}
    </View>
  );
}

export function ErrorBox({ text }: { text: string }) {
  return <View style={s.errorBox}><Text style={{ color: C.danger }}>{text}</Text></View>;
}

export function StatusBadge({ status }: { status: string }) {
  const [bg, fg] = STATUS_COLORS[status] || [C.info, C.ink2];
  return <View style={[s.badge, { backgroundColor: bg }]}><Text style={[s.badgeText, { color: fg }]}>{status}</Text></View>;
}

export function Tag({ text, bg = C.info, color = C.ink2 }: { text: string; bg?: string; color?: string }) {
  return <View style={[s.badge, { backgroundColor: bg, alignSelf: 'flex-start' }]}><Text style={[s.badgeText, { color }]}>{text}</Text></View>;
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipOn]}>
      <Text style={[s.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Stars({ value, onChange, size = 16 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Text key={n} onPress={onChange ? () => onChange(n) : undefined}
          style={{ fontSize: size, color: n <= Math.round(value) ? C.gold : '#d9cdbd', paddingHorizontal: onChange ? 4 : 0 }}>★</Text>
      ))}
    </View>
  );
}

export function Price({ p, large }: { p: Pick<Product, 'base_price' | 'price'>; large?: boolean }) {
  return (
    <View>
      <Text style={[s.price, large && { fontSize: 28 }]}>{money(p.price)}</Text>
      {p.price < p.base_price ? <Text style={s.priceOld}>{money(p.base_price)}</Text> : null}
    </View>
  );
}

export function Photo({ uri, style }: { uri: string | null; style?: any }) {
  return uri
    ? <Image source={{ uri }} style={[{ backgroundColor: C.iron2 }, style]} resizeMode="cover" />
    : <View style={[{ backgroundColor: C.iron2, alignItems: 'center', justifyContent: 'center' }, style]}><Text style={{ fontSize: 34, color: C.muted }}>⚒</Text></View>;
}

// Нижняя «шторка» (модальное окно)
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetBackdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}><Text style={{ fontSize: 20, color: C.ink2 }}>✕</Text></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, paddingBottom: 34 }}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export const Row = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>{children}</View>
);

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  pad: { padding: 16 },
  h1: { fontSize: 24, fontWeight: '700', color: C.ink, marginBottom: 12 },
  h2: { fontSize: 19, fontWeight: '700', color: C.ink, marginBottom: 10 },
  h3: { fontSize: 16, fontWeight: '600', color: C.ink },
  text: { fontSize: 15, color: C.ink2, lineHeight: 21 },
  muted: { fontSize: 13, color: C.muted },
  btn: { paddingVertical: 13, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  btnSmall: { paddingVertical: 7, paddingHorizontal: 12 },
  btn_primary: { backgroundColor: C.ember },
  btn_dark: { backgroundColor: C.iron },
  btn_ghost: { backgroundColor: 'transparent', borderColor: C.line2 },
  btn_danger: { backgroundColor: 'transparent', borderColor: C.dangerSoft },
  btnText: { fontSize: 15, fontWeight: '700' },
  btnText_primary: { color: '#fff' },
  btnText_dark: { color: C.light },
  btnText_ghost: { color: C.ink },
  btnText_danger: { color: C.danger },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: C.ink2, marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: C.ink },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  inputError: { borderColor: C.danger },
  error: { color: C.danger, fontSize: 12.5, marginTop: 4 },
  hint: { color: C.muted, fontSize: 12.5, marginTop: 4 },
  card: { backgroundColor: C.paper, borderRadius: 14, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  empty: { alignItems: 'center', padding: 40, gap: 8 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.ink, textAlign: 'center' },
  emptyText: { fontSize: 14, color: C.muted, textAlign: 'center', marginBottom: 8 },
  errorBox: { backgroundColor: C.dangerSoft, padding: 12, borderRadius: 10, marginBottom: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.line2, backgroundColor: C.paper, marginRight: 6 },
  chipOn: { backgroundColor: C.iron, borderColor: C.iron },
  chipText: { fontSize: 13, color: C.ink },
  price: { fontSize: 17, fontWeight: '800', color: C.ink },
  priceOld: { fontSize: 12.5, color: C.muted, textDecorationLine: 'line-through' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(20,16,13,0.55)' },
  sheet: { backgroundColor: C.paper, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%' },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: C.ink, flex: 1, marginRight: 10 },
  calc: { backgroundColor: C.bg, borderRadius: 10, padding: 12, gap: 6, marginBottom: 14 },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
