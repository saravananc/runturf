import type { PurchaseResult, ShopView } from '@runturf/shared';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { track } from '../analytics';
import { get, post } from '../api';
import { Btn, Card, Empty, Loading, ScreenTitle } from '../components/ui';
import { colors, font, space, type } from '../theme';

export function ShopScreen() {
  const [shop, setShop] = useState<ShopView | null>(null);
  const [error, setError] = useState('');
  const [buying, setBuying] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError('');
      setShop(await get<ShopView>('/shop'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load shop');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function buy(code: string) {
    setBuying(code);
    try {
      const res = await post<PurchaseResult>(`/shop/${code}/buy`);
      track('shop_item_purchased', { code });
      // Optimistically reflect the new balance/owned, then refetch.
      setShop((s) =>
        s
          ? {
              coins: res.coins,
              items: s.items.map((i) => (i.code === code ? res.item : i)),
            }
          : s,
      );
    } catch (err) {
      Alert.alert('Purchase failed', err instanceof Error ? err.message : 'Network error');
    } finally {
      setBuying(null);
    }
  }

  if (!shop && !error) return <Loading />;

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.content}>
      <View style={s.header}>
        <ScreenTitle title="Shop" subtitle="Spend coins on perks for your next run" />
        {shop && <Text style={s.coins}>🪙 {shop.coins}</Text>}
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      <View style={{ gap: space(2.5) }}>
        {shop?.items.length === 0 && <Empty title="Nothing in stock yet" />}
        {shop?.items.map((item) => {
          const affordable = shop.coins >= item.cost;
          return (
            <Card key={item.code} style={s.row}>
              <Text style={s.icon}>{item.icon}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={s.nameRow}>
                  <Text style={s.name}>{item.name}</Text>
                  {item.owned > 0 && <Text style={s.owned}>×{item.owned}</Text>}
                </View>
                <Text style={s.desc}>{item.description}</Text>
              </View>
              <Btn
                label={`🪙 ${item.cost}`}
                size="sm"
                disabled={!affordable || buying === item.code}
                onPress={() => buy(item.code)}
              />
            </Card>
          );
        })}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.base },
  content: { padding: space(4), paddingBottom: space(10) },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  coins: { fontFamily: font.bold, fontSize: 15, color: colors.gold },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3.5) },
  icon: { fontSize: 30 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  name: { fontFamily: font.bold, fontSize: type.body, color: colors.ink },
  owned: { fontFamily: font.extrabold, fontSize: type.label, color: colors.volt },
  desc: { fontFamily: font.regular, fontSize: type.caption, color: colors.ink2, marginTop: 2 },
  error: {
    fontFamily: font.medium,
    fontSize: type.small,
    color: colors.ember,
    textAlign: 'center',
    marginBottom: space(3),
  },
});
