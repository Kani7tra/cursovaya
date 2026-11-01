// Главный компонент: шапка с гамбургер-меню, навигация по экранам, уведомления
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ROLES } from './src/api';
import { initials } from './src/format';
import { StoreProvider, useStore, type Route } from './src/store';
import { C } from './src/theme';
import { LoginScreen, RegisterScreen } from './src/screens/Auth';
import { CatalogScreen } from './src/screens/Catalog';
import { ProductScreen } from './src/screens/Product';
import { FavoritesScreen, OrdersScreen, ProfileScreen } from './src/screens/Customer';
import { ChatScreen, DialogsScreen } from './src/screens/Messages';
import { SmithOrdersScreen } from './src/screens/Smith';

const TITLES: Record<string, string> = {
  Login: 'Вход', Register: 'Регистрация', Catalog: 'Каталог', Product: 'Изделие', Favorites: 'Избранное',
  Orders: 'Мои предзаказы', Profile: 'Личный кабинет', Dialogs: 'Сообщения', Chat: 'Переписка', SmithOrders: 'Предзаказы',
};

function renderScreen(r: Route) {
  switch (r.name) {
    case 'Login': return <LoginScreen />;
    case 'Register': return <RegisterScreen />;
    case 'Catalog': return <CatalogScreen />;
    case 'Product': return <ProductScreen id={r.params.id} />;
    case 'Favorites': return <FavoritesScreen />;
    case 'Orders': return <OrdersScreen />;
    case 'Profile': return <ProfileScreen />;
    case 'Dialogs': return <DialogsScreen />;
    case 'Chat': return <ChatScreen partnerId={r.params?.partnerId} toSmith={r.params?.toSmith} />;
    case 'SmithOrders': return <SmithOrdersScreen />;
    default: return null;
  }
}

function menuFor(roleId?: number) {
  if (roleId === ROLES.SMITH) {
    return [['SmithOrders', '📋  Предзаказы'], ['Catalog', '⚒  Каталог'], ['Dialogs', '✉  Сообщения'], ['Profile', '👤  Профиль']];
  }
  return [['Catalog', '⚒  Каталог'], ['Favorites', '♡  Избранное'], ['Orders', '📋  Мои предзаказы'], ['Dialogs', '✉  Сообщения'], ['Profile', '👤  Личный кабинет']];
}

function Header({ onMenu }: { onMenu: () => void }) {
  const { stack, back, user, unread } = useStore();
  const current = stack[stack.length - 1];
  const canBack = stack.length > 1;
  const title = current.name === 'Chat' && current.params?.name ? current.params.name : TITLES[current.name];
  return (
    <View style={{ backgroundColor: C.iron, borderBottomWidth: 3, borderBottomColor: C.ember, height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
      {canBack ? (
        <Pressable onPress={back} hitSlop={10} style={{ padding: 8 }}><Text style={{ color: C.light, fontSize: 24 }}>←</Text></Pressable>
      ) : user ? (
        <Pressable onPress={onMenu} hitSlop={10} style={{ padding: 8 }}>
          <Text style={{ color: C.light, fontSize: 24 }}>☰</Text>
          {unread > 0 ? <View style={{ position: 'absolute', right: 2, top: 6, width: 10, height: 10, borderRadius: 5, backgroundColor: C.ember }} /> : null}
        </Pressable>
      ) : <View style={{ width: 8 }} />}
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', flex: 1, marginLeft: 6 }} numberOfLines={1}>
        {user ? title : <>Гига<Text style={{ color: C.ember }}>Кузня</Text></>}
      </Text>
    </View>
  );
}

function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, unread, reset, logout, stack } = useStore();
  const current = stack[0]?.name;
  if (!user) return null;
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: 'rgba(20,16,13,0.55)' }}>
        <SafeAreaView style={{ width: '78%', maxWidth: 320, backgroundColor: C.iron }}>
          <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: C.iron3 }}>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 16 }}>Гига<Text style={{ color: C.ember }}>Кузня</Text></Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.iron3, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: C.light, fontWeight: '700' }}>{initials(user.full_name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '600' }} numberOfLines={1}>{user.full_name}</Text>
                <Text style={{ color: '#a89a8a', fontSize: 13 }}>{user.role}{user.role_id === ROLES.CUSTOMER ? ` · ★ ${user.bonus_points}` : ''}</Text>
              </View>
            </View>
          </View>
          <View style={{ padding: 10, flex: 1 }}>
            {menuFor(user.role_id).map(([name, label]) => (
              <Pressable key={name} onPress={() => { onClose(); reset(name); }}
                style={{ paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, backgroundColor: current === name ? C.iron3 : 'transparent', flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: current === name ? '#fff' : '#cfc2b2', fontSize: 16, flex: 1 }}>{label}</Text>
                {name === 'Dialogs' && unread > 0 ? <View style={{ backgroundColor: C.ember, borderRadius: 10, paddingHorizontal: 7 }}><Text style={{ color: '#fff', fontWeight: '700' }}>{unread}</Text></View> : null}
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => { onClose(); logout(); }} style={{ padding: 22, borderTopWidth: 1, borderTopColor: C.iron3 }}>
            <Text style={{ color: '#ff9b85', fontSize: 16 }}>Выйти</Text>
          </Pressable>
        </SafeAreaView>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </View>
    </Modal>
  );
}

function Toast() {
  const { toast } = useStore();
  if (!toast) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 40, backgroundColor: C.iron, padding: 14, borderRadius: 12,
      borderLeftWidth: 4, borderLeftColor: toast.kind === 'error' ? C.danger : C.ok, elevation: 6 }}>
      <Text style={{ color: C.light, fontSize: 14 }}>{toast.text}</Text>
    </View>
  );
}

function Shell() {
  const { ready, stack } = useStore();
  const [menu, setMenu] = useState(false);
  const current = stack[stack.length - 1];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.iron }} edges={['top']}>
      <StatusBar style="light" />
      <Header onMenu={() => setMenu(true)} />
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['bottom']}>
        {ready ? <View key={stack.length + current.name} style={{ flex: 1 }}>{renderScreen(current)}</View>
          : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={C.ember} /></View>}
      </SafeAreaView>
      <Drawer open={menu} onClose={() => setMenu(false)} />
      <Toast />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

