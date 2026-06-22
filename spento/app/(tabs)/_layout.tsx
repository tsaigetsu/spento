import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Dimensions,
  Appearance,
  PanResponder,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { ThemeCtx } from '@/lib/theme-context';
import { ExpensesCtx } from '@/lib/expenses-context';
import { type Expense, loadExpenses, SAMPLE_EXPENSES } from '@/lib/data';
import ExploreScreen from './explore';
import StatsScreen from './stats';
import TopScreen from './top';

const PRIMARY = '#9644D8';
const INDICATOR_W = 28;
const THEME_KEY = 'SPENTO_THEME';

const TABS = [
  { key: 'explore', title: 'Расходы',    icon: 'list-outline'     as const, iconActive: 'list'       as const },
  { key: 'stats',   title: 'Статистика', icon: 'bar-chart-outline' as const, iconActive: 'bar-chart'  as const },
  { key: 'top',     title: 'Топ',        icon: 'trophy-outline'   as const, iconActive: 'trophy'     as const },
] as const;

const N = TABS.length;

export default function TabLayout() {
  const [activeTab, setActiveTab]           = useState(0);
  const [isDark, setIsDark]                 = useState(false);
  const [sharedExpenses, setSharedExpenses] = useState<Expense[]>([]);
  const [ready, setReady]                   = useState(false);
  const [tabBarHeight, setTabBarHeight]     = useState(56);

  const pagerRef    = useRef<PagerView>(null);
  const insets      = useSafeAreaInsets();
  const activeTabRef = useRef(0);
  const openMenuRef  = useRef<(() => void) | null>(null) as { current: (() => void) | null };

  const tabBarWidth = useRef(Dimensions.get('window').width);
  const tabW        = tabBarWidth.current / N;
  const indicatorX  = useRef(new Animated.Value(tabW / 2 - INDICATOR_W / 2)).current;

  // Swipe right from left edge → open burger menu (only on tab 0, below header area)
  const leftEdgePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, { dx, dy }) => {
        if (activeTabRef.current === 0 && dx > 40 && Math.abs(dx) > Math.abs(dy)) {
          openMenuRef.current?.();
        }
      },
    })
  ).current;

  // ── Load theme + expenses ────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(THEME_KEY),
      loadExpenses(),
    ]).then(([stored, savedExpenses]) => {
      setIsDark(stored === 'dark' || (!stored && Appearance.getColorScheme() === 'dark'));
      setSharedExpenses(savedExpenses.length > 0 ? savedExpenses : SAMPLE_EXPENSES);
      setReady(true);
    });

    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      AsyncStorage.getItem(THEME_KEY).then(stored => {
        if (!stored) setIsDark(colorScheme === 'dark');
      });
    });
    return () => sub.remove();
  }, []);

  const setDark = useCallback((v: boolean) => setIsDark(v), []);

  const goTo = useCallback((index: number) => {
    pagerRef.current?.setPage(index);
    setActiveTab(index);
    activeTabRef.current = index;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handlePageScroll = useCallback((position: number, offset: number) => {
    const tw = tabBarWidth.current / N;
    indicatorX.setValue((position + offset) * tw + tw / 2 - INDICATOR_W / 2);
  }, [indicatorX]);

  const handlePageSelected = useCallback((index: number) => {
    setActiveTab(index);
    activeTabRef.current = index;
  }, []);

  const tabBarBg      = isDark ? '#1C1C1E' : '#FFF';
  const tabBarBorder  = isDark ? '#2C2C2E' : '#E0E0E0';
  const inactiveColor = isDark ? '#6E6E73' : '#8E8E93';

  if (!ready) return null;

  const overlayBottom = tabBarHeight + (insets.bottom || 0);

  return (
    <ThemeCtx.Provider value={{ isDark, setDark }}>
      <ExpensesCtx.Provider value={sharedExpenses}>
        <View style={s.root}>

          <PagerView
            ref={pagerRef}
            style={s.pager}
            initialPage={0}
            scrollEnabled={true}
            onPageScroll={e => handlePageScroll(e.nativeEvent.position, e.nativeEvent.offset)}
            onPageSelected={e => handlePageSelected(e.nativeEvent.position)}
            overScrollMode="never"
          >
            <View key="0" collapsable={false} style={s.page}>
              <ExploreScreen onExpensesChange={setSharedExpenses} openMenuRef={openMenuRef} />
            </View>
            <View key="1" collapsable={false} style={s.page}>
              <StatsScreen />
            </View>
            <View key="2" collapsable={false} style={s.page}>
              <TopScreen />
            </View>
          </PagerView>

          <View
            style={[s.tabBar, { paddingBottom: insets.bottom || 8, backgroundColor: tabBarBg, borderTopColor: tabBarBorder }]}
            onLayout={e => {
              tabBarWidth.current = e.nativeEvent.layout.width;
              setTabBarHeight(e.nativeEvent.layout.height);
              const tw = tabBarWidth.current / N;
              indicatorX.setValue(activeTab * tw + tw / 2 - INDICATOR_W / 2);
            }}
          >
            <Animated.View
              style={[s.indicator, { transform: [{ translateX: indicatorX }] }]}
              pointerEvents="none"
            />
            {TABS.map((tab, i) => {
              const isActive = activeTab === i;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={s.tabItem}
                  onPress={() => goTo(i)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isActive ? tab.iconActive : tab.icon}
                    size={24}
                    color={isActive ? PRIMARY : inactiveColor}
                  />
                  <Text style={[s.tabLabel, { color: isActive ? PRIMARY : inactiveColor }, isActive && s.tabLabelActive]}>
                    {tab.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Left-edge overlay: swipe right below header → burger menu */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: insets.top + 60,
              bottom: overlayBottom,
              width: 44,
              zIndex: 10,
            }}
            {...leftEdgePan.panHandlers}
          />

        </View>
      </ExpensesCtx.Provider>
    </ThemeCtx.Provider>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1 },
  pager: { flex: 1 },
  page:  { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: INDICATOR_W,
    height: 3,
    borderRadius: 2,
    backgroundColor: PRIMARY,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingBottom: 4,
  },
  tabLabel:       { fontSize: 11, fontWeight: '500' },
  tabLabelActive: { fontWeight: '600' },
});
