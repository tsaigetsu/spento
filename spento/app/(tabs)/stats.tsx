import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { CATEGORIES, CATEGORY_LIST, type Expense, type Category, loadExpenses } from '@/lib/data';

// --- Constants ---

const PRIMARY_COLOR = '#9644D8';
const THEME_KEY = 'SPENTO_THEME';

const MONTHS_FULL = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

type ChartMode = 'bar' | 'pie';

// --- Types ---

type PriceEntry = { price: number; totalQuantity: number; totalCost: number };
type ProductSummary = {
  productId: string;
  name: string;
  category: Category;
  totalCost: number;
  entries: PriceEntry[];
};
type CategoryGroup = { category: Category; total: number; products: ProductSummary[] };

// --- Aggregation helpers ---

function filterByMonth(expenses: Expense[], year: number, month: number): Expense[] {
  return expenses.filter(e => {
    const d = new Date(e.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

function buildCategoryGroups(expenses: Expense[]): CategoryGroup[] {
  return CATEGORY_LIST.map(cat => {
    const catExpenses = expenses.filter(e => e.category === cat);
    const byProduct: Record<string, Expense[]> = {};
    catExpenses.forEach(e => {
      if (!byProduct[e.productId]) byProduct[e.productId] = [];
      byProduct[e.productId].push(e);
    });
    const products: ProductSummary[] = Object.entries(byProduct)
      .map(([pid, exps]) => {
        const byPrice: Record<string, number> = {};
        exps.forEach(e => {
          const key = e.price.toFixed(2);
          byPrice[key] = (byPrice[key] ?? 0) + e.quantity;
        });
        const entries: PriceEntry[] = Object.entries(byPrice).map(([p, qty]) => {
          const price = parseFloat(p);
          return { price, totalQuantity: qty, totalCost: price * qty };
        });
        const totalCost = entries.reduce((s, en) => s + en.totalCost, 0);
        return { productId: pid, name: exps[0].name, category: cat, totalCost, entries };
      })
      .sort((a, b) => b.totalCost - a.totalCost);
    const total = products.reduce((s, p) => s + p.totalCost, 0);
    return { category: cat, total, products };
  }).filter(g => g.total > 0);
}

function getCategoryTotals(expenses: Expense[]): Record<Category, number> {
  const totals = { Useful: 0, Sweets: 0, Needs: 0, Harmful: 0 } as Record<Category, number>;
  expenses.forEach(e => { totals[e.category] += e.price * e.quantity; });
  return totals;
}

// --- DonutChart (requires react-native-svg) ---

function polarXY(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcD(cx: number, cy: number, r: number, start: number, end: number) {
  if (end - start >= 359.9) {
    const p1 = polarXY(cx, cy, r, 0);
    const p2 = polarXY(cx, cy, r, 180);
    return `M ${p1.x} ${p1.y} A ${r} ${r} 0 1 1 ${p2.x} ${p2.y} A ${r} ${r} 0 1 1 ${p1.x} ${p1.y}`;
  }
  const s = polarXY(cx, cy, r, start);
  const e = polarXY(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

interface DonutChartProps {
  data: Array<{ value: number; color: string }>;
  size?: number;
  stroke?: number;
  bgColor?: string;
}

const DonutChart: React.FC<DonutChartProps> = ({ data, size = 160, stroke = 34, bgColor = '#E0E0E0' }) => {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  let angle = 0;
  const slices = data
    .filter(d => d.value > 0)
    .map(d => {
      const start = angle;
      const sweep = (d.value / total) * 360;
      angle += sweep;
      return { ...d, start, end: angle };
    });

  return (
    <Svg width={size} height={size}>
      {/* Background ring */}
      <Path d={arcD(cx, cy, r, 0, 359.9)} stroke={bgColor} strokeWidth={stroke} fill="none" />
      {/* Colored segments */}
      {slices.map((sl, i) => (
        <Path
          key={i}
          d={arcD(cx, cy, r, sl.start, sl.end)}
          stroke={sl.color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="butt"
        />
      ))}
    </Svg>
  );
};

// --- CategoryBar ---

interface CategoryBarProps {
  totals: Record<Category, number>;
  grandTotal: number;
  textColor: string;
}

const CategoryBar: React.FC<CategoryBarProps> = ({ totals, grandTotal, textColor }) => {
  if (grandTotal === 0) return null;
  return (
    <View style={barS.container}>
      <View style={barS.bar}>
        {CATEGORY_LIST.map(cat => {
          const ratio = totals[cat] / grandTotal;
          if (ratio === 0) return null;
          return <View key={cat} style={{ flex: ratio, backgroundColor: CATEGORIES[cat].color }} />;
        })}
      </View>
      <View style={barS.legend}>
        {CATEGORY_LIST.map(cat => {
          if (totals[cat] === 0) return null;
          const pct = ((totals[cat] / grandTotal) * 100).toFixed(0);
          return (
            <View key={cat} style={barS.legendRow}>
              <View style={[barS.dot, { backgroundColor: CATEGORIES[cat].color }]} />
              <Text style={[barS.legendName, { color: textColor }]}>{CATEGORIES[cat].label}</Text>
              <Text style={[barS.legendAmt, { color: textColor }]}>{totals[cat].toFixed(2)} zł</Text>
              <Text style={barS.legendPct}>{pct}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const barS = StyleSheet.create({
  container: { marginTop: 16 },
  bar: {
    height: 10,
    borderRadius: 5,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: '#E0E0E0',
  },
  legend: { marginTop: 14, gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { flex: 1, fontSize: 14 },
  legendAmt: { fontSize: 14, fontWeight: '600' },
  legendPct: { fontSize: 12, color: '#888', minWidth: 34, textAlign: 'right' },
});

// --- PieView (donut + legend) ---

interface PieViewProps {
  totals: Record<Category, number>;
  grandTotal: number;
  textColor: string;
  isDarkTheme: boolean;
}

const PieView: React.FC<PieViewProps> = ({ totals, grandTotal, textColor, isDarkTheme }) => {
  if (grandTotal === 0) return null;
  const bgColor = isDarkTheme ? '#222' : '#FFF';
  const data = CATEGORY_LIST
    .filter(cat => totals[cat] > 0)
    .map(cat => ({ value: totals[cat], color: CATEGORIES[cat].color }));

  return (
    <View style={pieS.container}>
      <DonutChart data={data} size={160} stroke={36} bgColor={isDarkTheme ? '#333' : '#E8E8E8'} />
      {/* Legend */}
      <View style={pieS.legend}>
        {CATEGORY_LIST.map(cat => {
          if (totals[cat] === 0) return null;
          const pct = ((totals[cat] / grandTotal) * 100).toFixed(0);
          return (
            <View key={cat} style={pieS.legendRow}>
              <View style={[pieS.dot, { backgroundColor: CATEGORIES[cat].color }]} />
              <Text style={[pieS.legendName, { color: textColor }]}>{CATEGORIES[cat].label}</Text>
              <Text style={[pieS.legendAmt, { color: CATEGORIES[cat].color }]}>
                {totals[cat].toFixed(2)} zł
              </Text>
              <Text style={pieS.legendPct}>{pct}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const pieS = StyleSheet.create({
  container: { alignItems: 'center', marginTop: 12, gap: 16 },
  legend: { width: '100%', gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { flex: 1, fontSize: 14 },
  legendAmt: { fontSize: 14, fontWeight: '700' },
  legendPct: { fontSize: 12, color: '#888', minWidth: 34, textAlign: 'right' },
});

// --- ProductCard ---

interface ProductCardProps { summary: ProductSummary; isDarkTheme: boolean }

const ProductCard: React.FC<ProductCardProps> = ({ summary, isDarkTheme }) => {
  const cat = CATEGORIES[summary.category];
  return (
    <View style={[pcS.card, { backgroundColor: isDarkTheme ? '#2C2C2E' : '#FFF' }]}>
      <View style={pcS.header}>
        <View style={[pcS.dot, { backgroundColor: cat.color }]} />
        <Text style={[pcS.name, { color: isDarkTheme ? '#FFF' : '#000' }]} numberOfLines={1}>
          {summary.name}
        </Text>
        <Text style={[pcS.total, { color: cat.color }]}>{summary.totalCost.toFixed(2)} zł</Text>
      </View>
      {summary.entries.map((entry, i) => (
        <View key={i} style={pcS.entry}>
          <Text style={[pcS.entryText, { color: isDarkTheme ? '#8E8E93' : '#6C6C70' }]}>
            {entry.totalQuantity}× @ {entry.price.toFixed(2)} zł = {entry.totalCost.toFixed(2)} zł
          </Text>
        </View>
      ))}
    </View>
  );
};

const pcS = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: { flex: 1, fontSize: 15, fontWeight: '600' },
  total: { fontSize: 15, fontWeight: '700' },
  entry: { paddingLeft: 16, marginTop: 2 },
  entryText: { fontSize: 13 },
});

// --- CategorySection ---

interface CategorySectionProps { group: CategoryGroup; isDarkTheme: boolean }

const CategorySection: React.FC<CategorySectionProps> = ({ group, isDarkTheme }) => {
  const cat = CATEGORIES[group.category];
  return (
    <View style={csS.section}>
      <View style={csS.header}>
        <View style={[csS.dot, { backgroundColor: cat.color }]} />
        <Text style={[csS.name, { color: cat.color }]}>{cat.label}</Text>
        <Text style={[csS.total, { color: isDarkTheme ? '#8E8E93' : '#6C6C70' }]}>
          {group.total.toFixed(2)} zł
        </Text>
      </View>
      {group.products.map(p => (
        <ProductCard key={p.productId} summary={p} isDarkTheme={isDarkTheme} />
      ))}
    </View>
  );
};

const csS = StyleSheet.create({
  section: { marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingHorizontal: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { flex: 1, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  total: { fontSize: 13, fontWeight: '600' },
});

// --- MonthArrow (animated press button) ---

interface MonthArrowProps {
  onPress: () => void;
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  disabled?: boolean;
}

const MonthArrow: React.FC<MonthArrowProps> = ({ onPress, name, color, disabled }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    if (disabled) return;
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.78, useNativeDriver: true, tension: 500, friction: 8 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 9 }),
    ]).start();
    onPress();
  };
  return (
    <TouchableOpacity onPress={press} style={sS.arrow} activeOpacity={1}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={name} size={22} color={color} />
      </Animated.View>
    </TouchableOpacity>
  );
};

// --- Main Stats Screen ---

export default function StatsScreen(): React.JSX.Element {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [chartMode, setChartMode] = useState<ChartMode>('bar');
  const [visibleMode, setVisibleMode] = useState<ChartMode>('bar');
  const chartFadeAnim = useRef(new Animated.Value(1)).current;
  const barBtnScale = useRef(new Animated.Value(1)).current;
  const pieBtnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const load = async () => {
      const [data, theme] = await Promise.all([loadExpenses(), AsyncStorage.getItem(THEME_KEY)]);
      setExpenses(data);
      setIsDarkTheme(theme === 'dark');
    };
    load();
  }, []);

  const switchChart = (mode: ChartMode) => {
    if (mode === chartMode) return;
    setChartMode(mode);
    const btnScale = mode === 'pie' ? pieBtnScale : barBtnScale;
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.85, useNativeDriver: true, tension: 400 }),
      Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
    Animated.timing(chartFadeAnim, { toValue: 0, duration: 130, useNativeDriver: true }).start(() => {
      setVisibleMode(mode);
      Animated.timing(chartFadeAnim, { toValue: 1, duration: 190, useNativeDriver: true }).start();
    });
  };

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const goBack = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const goForward = () => {
    if (isCurrentMonth) return;
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const monthExpenses = filterByMonth(expenses, year, month);
  const categoryTotals = getCategoryTotals(monthExpenses);
  const grandTotal = Object.values(categoryTotals).reduce((s, v) => s + v, 0);
  const categoryGroups = buildCategoryGroups(monthExpenses);

  const bg = isDarkTheme ? '#161616' : '#F5F5F5';
  const cardBg = isDarkTheme ? '#222' : '#FFF';
  const textColor = isDarkTheme ? '#FFF' : '#000';
  const subColor = isDarkTheme ? '#8E8E93' : '#6C6C70';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} />

      <View style={[sS.header, { backgroundColor: isDarkTheme ? '#222' : '#FFF' }]}>
        <Text style={[sS.title, { color: textColor }]}>Статистика</Text>
      </View>

      <ScrollView style={sS.scroll} contentContainerStyle={sS.content} showsVerticalScrollIndicator={false}>

        {/* Month selector */}
        <View style={sS.monthRow}>
          <MonthArrow onPress={goBack} name="chevron-back" color={PRIMARY_COLOR} />
          <Text style={[sS.monthLabel, { color: textColor }]}>{MONTHS_FULL[month]} {year}</Text>
          <MonthArrow
            onPress={goForward}
            name="chevron-forward"
            color={isCurrentMonth ? (isDarkTheme ? '#3A3A3C' : '#C7C7CC') : PRIMARY_COLOR}
            disabled={isCurrentMonth}
          />
        </View>

        {/* Summary card */}
        <View style={[sS.summaryCard, { backgroundColor: cardBg }]}>
          {/* Card header row */}
          <View style={sS.summaryHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[sS.summaryLabel, { color: subColor }]}>Всего потрачено</Text>
              <Text style={[sS.summaryTotal, { color: textColor }]}>{grandTotal.toFixed(2)} zł</Text>
            </View>
            {/* Chart mode toggle */}
            <View style={sS.toggleRow}>
              <TouchableOpacity
                onPress={() => switchChart('bar')}
                activeOpacity={1}
              >
                <Animated.View
                  style={[
                    sS.toggleBtn,
                    chartMode === 'bar' && sS.toggleBtnActive,
                    { transform: [{ scale: barBtnScale }] },
                  ]}
                >
                  <Ionicons name="bar-chart" size={18} color={chartMode === 'bar' ? '#FFF' : subColor} />
                </Animated.View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => switchChart('pie')}
                activeOpacity={1}
              >
                <Animated.View
                  style={[
                    sS.toggleBtn,
                    chartMode === 'pie' && sS.toggleBtnActive,
                    { transform: [{ scale: pieBtnScale }] },
                  ]}
                >
                  <Ionicons name="pie-chart" size={18} color={chartMode === 'pie' ? '#FFF' : subColor} />
                </Animated.View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Chart content — fades on mode switch */}
          <Animated.View style={{ opacity: chartFadeAnim }}>
            {visibleMode === 'bar' ? (
              <CategoryBar totals={categoryTotals} grandTotal={grandTotal} textColor={textColor} />
            ) : (
              <PieView
                totals={categoryTotals}
                grandTotal={grandTotal}
                textColor={textColor}
                isDarkTheme={isDarkTheme}
              />
            )}
          </Animated.View>
        </View>

        {/* Product list */}
        {categoryGroups.length > 0 ? (
          <>
            <Text style={[sS.sectionLabel, { color: subColor }]}>По продуктам</Text>
            {categoryGroups.map(group => (
              <CategorySection key={group.category} group={group} isDarkTheme={isDarkTheme} />
            ))}
          </>
        ) : (
          <View style={sS.emptyState}>
            <Ionicons name="bar-chart-outline" size={64} color={isDarkTheme ? '#444' : '#CCC'} />
            <Text style={[sS.emptyText, { color: subColor }]}>
              Нет данных за {MONTHS_FULL[month].toLowerCase()} {year}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const sS = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    minHeight: 74,
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  title: { fontSize: 20, fontWeight: 'bold' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  arrow: { padding: 8 },
  monthLabel: { fontSize: 17, fontWeight: '600' },
  summaryCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  summaryLabel: { fontSize: 13 },
  summaryTotal: { fontSize: 32, fontWeight: '700', marginTop: 2 },
  toggleRow: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(128,128,128,0.12)',
    borderRadius: 10,
    padding: 4,
  },
  toggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: { backgroundColor: PRIMARY_COLOR },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, textAlign: 'center' },
});
