// Каталог изделий: поиск, фильтры по типу, материалу, сезону; избранное
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { api, qs, type Product } from '../api';
import { useLoad, useStore } from '../store';
import { C } from '../theme';
import { Btn, Chip, Empty, ErrorBox, Loader, Photo, Price, Row, Sheet, Stars, Tag, s } from '../ui';

export function ProductTile({ p, width, onFav }: { p: Product; width: number; onFav?: (fav: boolean) => void }) {
  const { push, notify } = useStore();
  const toggle = async () => {
    try {
      if (p.is_favorite) await api.del(`/favorites/${p.product_id}`);
      else await api.post('/favorites', { product_id: p.product_id });
      onFav?.(!p.is_favorite);
      notify(p.is_favorite ? 'Удалено из избранного' : 'Добавлено в избранное');
    } catch (e: any) { notify(e.message, 'error'); }
  };
  return (
    <Pressable onPress={() => push('Product', { id: p.product_id })} style={[s.card, { width, marginBottom: 12 }]}>
      <View>
        <Photo uri={p.photo} style={{ width: '100%', aspectRatio: 1 }} />
        <View style={{ position: 'absolute', left: 8, top: 8, gap: 4 }}>
          {p.is_seasonal ? <Tag text="Сезонное" bg={C.blueSoft} color={C.blue} /> : null}
          {p.discount ? <Tag text="Скидка" bg={C.ember} color="#fff" /> : null}
        </View>
        {onFav ? (
          <Pressable onPress={toggle} hitSlop={8} style={{ position: 'absolute', right: 8, top: 8, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,253,249,0.92)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 17, color: p.is_favorite ? C.ember : C.ink2 }}>{p.is_favorite ? '♥' : '♡'}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={{ padding: 10, gap: 3 }}>
        <Text style={s.muted} numberOfLines={1}>{p.type}</Text>
        <Text style={[s.h3, { fontSize: 14.5 }]} numberOfLines={2}>{p.title}</Text>
        {p.reviews_count > 0 ? <Row style={{ gap: 4 }}><Stars value={p.rating} size={12} /><Text style={s.muted}>{p.rating}</Text></Row> : null}
        <Price p={p} />
      </View>
    </Pressable>
  );
}

export function CatalogScreen() {
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState('');
  const [f, setF] = useState({ search: '', type: '', material: '', seasonal: '', sort: 'new' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filters = useLoad(() => api.get<{ types: string[]; materials: string[] }>('/products/filters'), []);
  const list = useLoad(() => api.get<Product[]>('/products' + qs(f)), [f.search, f.type, f.material, f.seasonal, f.sort]);
  const tileW = (width - 16 * 2 - 12) / 2;
  const active = [f.type, f.material, f.seasonal].filter(Boolean).length;

  const patch = (id: number, fav: boolean) => list.setData((d) => d && d.map((x) => (x.product_id === id ? { ...x, is_favorite: fav } : x)));

  return (
    <View style={s.screen}>
      <View style={{ padding: 16, paddingBottom: 8, gap: 10 }}>
        <Row>
          <TextInput value={search} onChangeText={setSearch} placeholder="Поиск изделий…" placeholderTextColor={C.muted}
            returnKeyType="search" onSubmitEditing={() => setF({ ...f, search: search.trim() })} maxLength={100}
            style={[s.input, { flex: 1 }]} />
          <Btn title={active ? `Фильтры (${active})` : 'Фильтры'} kind="dark" small onPress={() => setFiltersOpen(true)} style={{ paddingVertical: 12 }} />
        </Row>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[['new', 'Новые'], ['price_asc', 'Дешевле'], ['price_desc', 'Дороже'], ['rating', 'Рейтинг']].map(([v, l]) => (
            <Chip key={v} label={l} active={f.sort === v} onPress={() => setF({ ...f, sort: v })} />
          ))}
        </ScrollView>
      </View>

      {list.loading && !list.data ? <Loader /> : list.error ? <View style={s.pad}><ErrorBox text={list.error} /><Btn title="Повторить" onPress={list.reload} /></View> : (
        <FlatList
          data={list.data || []}
          keyExtractor={(p) => String(p.product_id)}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={list.loading} onRefresh={list.reload} colors={[C.ember]} />}
          renderItem={({ item }) => <ProductTile p={item} width={tileW} onFav={(fav) => patch(item.product_id, fav)} />}
          ListHeaderComponent={<Text style={[s.muted, { marginBottom: 8 }]}>Найдено изделий: {list.data?.length ?? 0}</Text>}
          ListEmptyComponent={<Empty icon="🔍" title="Ничего не найдено" text="Измените условия поиска" action={
            <Btn title="Сбросить фильтры" onPress={() => { setSearch(''); setF({ search: '', type: '', material: '', seasonal: '', sort: 'new' }); }} />} />}
        />
      )}

      <Sheet visible={filtersOpen} title="Фильтры" onClose={() => setFiltersOpen(false)}>
        <Text style={s.label}>Тип изделия</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          <Chip label="Все" active={!f.type} onPress={() => setF({ ...f, type: '' })} />
          {filters.data?.types.map((t) => <Chip key={t} label={t} active={f.type === t} onPress={() => setF({ ...f, type: t })} />)}
        </View>
        <Text style={s.label}>Материал</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          <Chip label="Все" active={!f.material} onPress={() => setF({ ...f, material: '' })} />
          {filters.data?.materials.map((m) => <Chip key={m} label={m} active={f.material === m} onPress={() => setF({ ...f, material: m })} />)}
        </View>
        <Text style={s.label}>Сезон</Text>
        <View style={{ flexDirection: 'row', marginBottom: 20 }}>
          <Chip label="Все изделия" active={!f.seasonal} onPress={() => setF({ ...f, seasonal: '' })} />
          <Chip label="Сезонные предложения" active={f.seasonal === '1'} onPress={() => setF({ ...f, seasonal: '1' })} />
        </View>
        <Btn title="Показать" onPress={() => setFiltersOpen(false)} />
        {active ? <Btn title="Сбросить" kind="ghost" style={{ marginTop: 8 }} onPress={() => setF({ ...f, type: '', material: '', seasonal: '' })} /> : null}
      </Sheet>
    </View>
  );
}
