import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Animated,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const PRIMARY_COLOR = '#9644D8';
const THEME_KEY = 'SPENTO_THEME';

// --- Hardcoded leaderboard data ---

type LeaderUser = {
  id: string;
  nick: string;
  firstName: string;
  lastName: string;
  avatarColor: string;
  savingsPct: number;   // % saved compared to previous month
  savedAmount: number;  // zł saved
  prevMonthSpent: number;
  thisMonthSpent: number;
};

const LEADERS: LeaderUser[] = [
  {
    id: '1',
    nick: 'SavingsKing',
    firstName: 'Дмитрий',
    lastName: 'Королёв',
    avatarColor: '#FFB800',
    savingsPct: 47,
    savedAmount: 312.40,
    prevMonthSpent: 664.70,
    thisMonthSpent: 352.30,
  },
  {
    id: '2',
    nick: 'EcoMaster',
    firstName: 'Анна',
    lastName: 'Смирнова',
    avatarColor: '#4CAF50',
    savingsPct: 38,
    savedAmount: 228.90,
    prevMonthSpent: 602.35,
    thisMonthSpent: 373.45,
  },
  {
    id: '3',
    nick: 'BudgetPro',
    firstName: 'Олег',
    lastName: 'Павлов',
    avatarColor: '#2196F3',
    savingsPct: 31,
    savedAmount: 185.00,
    prevMonthSpent: 596.80,
    thisMonthSpent: 411.80,
  },
  {
    id: '4',
    nick: 'Thrifty_X',
    firstName: 'Мария',
    lastName: 'Антонова',
    avatarColor: '#E91E8C',
    savingsPct: 24,
    savedAmount: 119.60,
    prevMonthSpent: 498.35,
    thisMonthSpent: 378.75,
  },
  {
    id: '5',
    nick: 'admin',
    firstName: 'Test',
    lastName: 'Account',
    avatarColor: PRIMARY_COLOR,
    savingsPct: 13,
    savedAmount: 58.20,
    prevMonthSpent: 447.70,
    thisMonthSpent: 389.50,
  },
];

const MEDALS = ['🥇', '🥈', '🥉'];

// --- LeaderCard ---

interface LeaderCardProps {
  user: LeaderUser;
  rank: number;
  isDarkTheme: boolean;
}

const LeaderCard: React.FC<LeaderCardProps> = ({ user, rank, isDarkTheme }) => {
  const cardBg = isDarkTheme ? '#222' : '#FFF';
  const textColor = isDarkTheme ? '#FFF' : '#000';
  const subColor = isDarkTheme ? '#8E8E93' : '#6C6C70';
  const divColor = isDarkTheme ? '#2C2C2E' : '#F0F0F0';
  const scale = useRef(new Animated.Value(1)).current;
  const isTop3 = rank <= 3;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, tension: 300, friction: 10 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 9 }).start();

  return (
    <TouchableOpacity onPressIn={onPressIn} onPressOut={onPressOut} activeOpacity={1}>
    <Animated.View style={[lcS.card, { backgroundColor: cardBg, transform: [{ scale }] }, isTop3 && lcS.cardHighlight]}>
      {/* Rank indicator */}
      <View style={lcS.rankCol}>
        {rank <= 3 ? (
          <Text style={lcS.medal}>{MEDALS[rank - 1]}</Text>
        ) : (
          <Text style={[lcS.rankNum, { color: subColor }]}>#{rank}</Text>
        )}
      </View>

      {/* Avatar */}
      <View style={[lcS.avatar, { backgroundColor: user.avatarColor }]}>
        <Text style={lcS.avatarChar}>{user.nick[0].toUpperCase()}</Text>
      </View>

      {/* Info */}
      <View style={lcS.info}>
        <Text style={[lcS.nick, { color: textColor }]} numberOfLines={1}>@{user.nick}</Text>
        <Text style={[lcS.name, { color: subColor }]} numberOfLines={1}>
          {user.firstName} {user.lastName}
        </Text>
        <View style={[lcS.divider, { backgroundColor: divColor }]} />
        <View style={lcS.statsRow}>
          <View style={lcS.stat}>
            <Text style={[lcS.statLabel, { color: subColor }]}>Сэкономлено</Text>
            <Text style={[lcS.statValue, { color: '#4CAF50' }]}>+{user.savedAmount.toFixed(0)} zł</Text>
          </View>
          <View style={lcS.stat}>
            <Text style={[lcS.statLabel, { color: subColor }]}>Прошлый месяц</Text>
            <Text style={[lcS.statValue, { color: textColor }]}>{user.prevMonthSpent.toFixed(0)} zł</Text>
          </View>
          <View style={lcS.stat}>
            <Text style={[lcS.statLabel, { color: subColor }]}>Этот месяц</Text>
            <Text style={[lcS.statValue, { color: textColor }]}>{user.thisMonthSpent.toFixed(0)} zł</Text>
          </View>
        </View>
      </View>

      {/* Savings badge */}
      <View style={[lcS.badge, { backgroundColor: '#4CAF5020' }]}>
        <Ionicons name="trending-down" size={12} color="#4CAF50" />
        <Text style={lcS.badgeText}>−{user.savingsPct}%</Text>
      </View>
    </Animated.View>
    </TouchableOpacity>
  );
};

const lcS = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    alignItems: 'flex-start',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  cardHighlight: {
    borderWidth: 1,
    borderColor: 'rgba(150, 68, 216, 0.2)',
  },
  rankCol: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    paddingTop: 2,
  },
  medal: { fontSize: 18 },
  rankNum: { fontSize: 14, fontWeight: '700' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarChar: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  info: { flex: 1 },
  nick: { fontSize: 15, fontWeight: '700' },
  name: { fontSize: 13, marginTop: 2 },
  divider: { height: 1, marginVertical: 10 },
  statsRow: { flexDirection: 'row', gap: 0 },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 10, marginBottom: 2 },
  statValue: { fontSize: 13, fontWeight: '600' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
    marginTop: 2,
  },
  badgeText: { color: '#4CAF50', fontSize: 12, fontWeight: '700' },
});

// --- TopScreen ---

export default function TopScreen(): React.JSX.Element {
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(t => setIsDarkTheme(t === 'dark'));
  }, []);

  const bg = isDarkTheme ? '#161616' : '#F5F5F5';
  const cardBg = isDarkTheme ? '#222' : '#FFF';
  const textColor = isDarkTheme ? '#FFF' : '#000';
  const subColor = isDarkTheme ? '#8E8E93' : '#6C6C70';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} />

      <View style={[tS.header, { backgroundColor: isDarkTheme ? '#222' : '#FFF' }]}>
        <Text style={[tS.title, { color: textColor }]}>Топ экономии</Text>
      </View>

      <ScrollView style={tS.scroll} contentContainerStyle={tS.content} showsVerticalScrollIndicator={false}>

        {/* Period note */}
        <View style={[tS.periodCard, { backgroundColor: cardBg }]}>
          <Ionicons name="calendar-outline" size={16} color={PRIMARY_COLOR} />
          <Text style={[tS.periodText, { color: subColor }]}>
            Относительно прошлого месяца
          </Text>
        </View>

        {/* Leaderboard */}
        {LEADERS.map((user, i) => (
          <LeaderCard key={user.id} user={user} rank={i + 1} isDarkTheme={isDarkTheme} />
        ))}

        <Text style={[tS.footnote, { color: isDarkTheme ? '#3A3A3C' : '#C7C7CC' }]}>
          Данные обновляются ежемесячно
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const tS = StyleSheet.create({
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
  periodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  periodText: { fontSize: 13 },
  footnote: { textAlign: 'center', fontSize: 12, marginTop: 12 },
});
