import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import * as Haptics from 'expo-haptics';

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
  const [activeTab, setActiveTab] = useState(0);
  const [visitedTabs, setVisitedTabs] = useState<Set<number>>(new Set([0]));
  const [isDark, setIsDark] = useState(false);
  const pagerRef = useRef<PagerView>(null);
  const insets = useSafeAreaInsets();

  // Tab bar width comes from layout event so the indicator is pixel-perfect
  const tabBarWidth = useRef(Dimensions.get('window').width);
  const tabW = tabBarWidth.current / N;

  // Indicator X: animated by onPageScroll (follows swipe in real-time)
  const indicatorX = useRef(new Animated.Value(tabW / 2 - INDICATOR_W / 2)).current;

  // --- Theme ---
  useEffect(() => {
    const load = async () => {
      const stored = await AsyncStorage.getItem(THEME_KEY);
      if (stored) {
        setIsDark(stored === 'dark');
      } else {
        setIsDark(Appearance.getColorScheme() === 'dark');
      }
    };
    load();

    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      AsyncStorage.getItem(THEME_KEY).then(stored => {
        if (!stored) setIsDark(colorScheme === 'dark');
      });
    });
    return () => sub.remove();
  }, []);

  // --- Navigation ---
  const goTo = useCallback((index: number) => {
    pagerRef.current?.setPage(index);
    setActiveTab(index);
    setVisitedTabs(prev => new Set([...prev, index]));
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  // --- Real-time indicator tracking via PagerView scroll ---
  const handlePageScroll = useCallback((position: number, offset: number) => {
    const tw = tabBarWidth.current / N;
    indicatorX.setValue((position + offset) * tw + tw / 2 - INDICATOR_W / 2);
  }, [indicatorX]);

  const handlePageSelected = useCallback((index: number) => {
    setActiveTab(index);
    setVisitedTabs(prev => new Set([...prev, index]));
  }, []);

  // Colors
  const tabBarBg    = isDark ? '#1C1C1E' : '#FFF';
  const tabBarBorder = isDark ? '#2C2C2E' : '#E0E0E0';
  const inactiveColor = isDark ? '#6E6E73' : '#8E8E93';

  return (
    <View style={s.root}>
      <PagerView
        ref={pagerRef}
        style={s.pager}
        initialPage={0}
        onPageScroll={e => handlePageScroll(e.nativeEvent.position, e.nativeEvent.offset)}
        onPageSelected={e => handlePageSelected(e.nativeEvent.position)}
        overScrollMode="never"
      >
        <View key="0" collapsable={false} style={s.page}>
          <ExploreScreen />
        </View>
        <View key="1" collapsable={false} style={s.page}>
          {visitedTabs.has(1) && <StatsScreen />}
        </View>
        <View key="2" collapsable={false} style={s.page}>
          {visitedTabs.has(2) && <TopScreen />}
        </View>
      </PagerView>

      {/* Custom bottom tab bar */}
      <View
        style={[s.tabBar, { paddingBottom: insets.bottom || 8, backgroundColor: tabBarBg, borderTopColor: tabBarBorder }]}
        onLayout={e => {
          tabBarWidth.current = e.nativeEvent.layout.width;
          // Reposition indicator after real width is known
          const tw = tabBarWidth.current / N;
          indicatorX.setValue(activeTab * tw + tw / 2 - INDICATOR_W / 2);
        }}
      >
        {/* Sliding indicator — driven by onPageScroll in real-time */}
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
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  pager: { flex: 1 },
  page: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
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
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  tabLabelActive: {
    fontWeight: '600',
  },
});
