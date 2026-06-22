import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Animated,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  LayoutAnimation,
  UIManager,
  Image,
  ActionSheetIOS,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { OcrOverlay } from '@/components/OcrOverlay';
import {
  CATEGORIES,
  CATEGORY_LIST,
  type Expense,
  type Category,
  type AuthUser,
  loadExpenses,
  saveExpenses,
  loadUser,
  generateId,
  SAMPLE_EXPENSES,
} from '@/lib/data';
import { useTheme } from '@/lib/theme-context';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// --- Constants ---

const PRIMARY_COLOR = '#9644D8';
const DANGER_COLOR = '#FF3B30';
const TRANSITION_DURATION = 150;
const THEME_KEY = 'SPENTO_THEME';
const DRAWER_WIDTH = 280;

const DAYS_RU        = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTHS_SHORT   = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_FULL_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

// --- Shared press-scale animation hook ---

function usePressAnimation(downScale = 0.91) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scale, {
      toValue: downScale,
      useNativeDriver: true,
      tension: 400,
      friction: 12,
    }).start();
  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  return { scale, onPressIn, onPressOut };
}

// --- CategoryChip (individual animated chip) ---

interface CategoryChipProps {
  cat: Category;
  selected: boolean;
  onPress: () => void;
}

const CategoryChip: React.FC<CategoryChipProps> = React.memo(({ cat, selected, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevSelected = useRef(selected);

  useEffect(() => {
    if (selected && !prevSelected.current) {
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 0.88, useNativeDriver: true, tension: 600, friction: 8 }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 180, friction: 7 }),
      ]).start();
    }
    prevSelected.current = selected;
  }, [selected, scaleAnim]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 70, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
      <Animated.View
        style={[
          cpStyles.chip,
          { borderColor: CATEGORIES[cat].color, transform: [{ scale: scaleAnim }] },
          selected && { backgroundColor: CATEGORIES[cat].color },
        ]}
      >
        <Text style={[cpStyles.chipText, { color: selected ? '#FFF' : CATEGORIES[cat].color }]}>
          {CATEGORIES[cat].label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
});
CategoryChip.displayName = 'CategoryChip';

// --- CategoryPicker ---

interface CategoryPickerProps {
  value: Category;
  onChange: (cat: Category) => void;
}

const CategoryPicker: React.FC<CategoryPickerProps> = React.memo(({ value, onChange }) => (
  <View style={cpStyles.grid}>
    {CATEGORY_LIST.map(cat => (
      <CategoryChip
        key={cat}
        cat={cat}
        selected={value === cat}
        onPress={() => onChange(cat)}
      />
    ))}
  </View>
));
CategoryPicker.displayName = 'CategoryPicker';

const cpStyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
});

// --- AddExpenseModal ---

interface AddExpenseModalProps {
  visible: boolean;
  isDarkTheme: boolean;
  existingExpenses: Expense[];
  onClose: () => void;
  onSave: (expense: Omit<Expense, 'id'>) => void;
}

const AddExpenseModal: React.FC<AddExpenseModalProps> = React.memo(({
  visible,
  isDarkTheme,
  existingExpenses,
  onClose,
  onSave,
}) => {
  const insets = useSafeAreaInsets();
  const [internalVisible, setInternalVisible] = useState(false);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [category, setCategory] = useState<Category>('Useful');

  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
      Animated.spring(sheetAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 70,
        friction: 12,
      }).start();
    } else {
      Animated.timing(sheetAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setInternalVisible(false));
    }
  }, [visible, sheetAnim]);

  const translateY = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] });
  const backdropOpacity = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const canSave = name.trim().length > 0 && parseFloat(price) > 0;

  const handleSave = () => {
    if (!canSave) return;
    const trimmedName = name.trim();
    const existing = existingExpenses.find(
      e => e.name.toLowerCase() === trimmedName.toLowerCase()
    );
    const productId = existing?.productId ?? `p_${generateId()}`;
    onSave({
      productId,
      name: trimmedName,
      price: parseFloat(parseFloat(price).toFixed(2)),
      quantity: Math.max(1, parseInt(quantity, 10) || 1),
      category,
      date: new Date().toISOString(),
    });
    setName(''); setPrice(''); setQuantity('1'); setCategory('Useful');
    onClose();
  };

  const bg = isDarkTheme ? '#1E1E1E' : '#FFF';
  const inputBg = isDarkTheme ? '#2C2C2E' : '#F2F2F7';
  const inputColor = isDarkTheme ? '#FFF' : '#000';
  const textColor = isDarkTheme ? '#FFF' : '#000';
  const subColor = isDarkTheme ? '#8E8E93' : '#6C6C70';

  return (
    <Modal visible={internalVisible} transparent animationType="none" onRequestClose={onClose}>
      {/* Animated backdrop */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)', opacity: backdropOpacity }]}
        pointerEvents="none"
      />
      {/* KAV wraps everything — tap above sheet closes modal, sheet stays above keyboard */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={amStyles.kavOuter}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[amStyles.sheet, { backgroundColor: bg, transform: [{ translateY }] }]}>
          <View style={amStyles.handle} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[amStyles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) }]}
          >
            <Text style={[amStyles.sheetTitle, { color: textColor }]}>Новый расход</Text>

            <Text style={[amStyles.label, { color: subColor }]}>Название</Text>
            <TextInput
              style={[amStyles.input, { backgroundColor: inputBg, color: inputColor }]}
              value={name}
              onChangeText={setName}
              placeholder="Молоко, мясо..."
              placeholderTextColor={subColor}
              returnKeyType="next"
              autoFocus
            />

            <View style={amStyles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[amStyles.label, { color: subColor }]}>Цена (zł)</Text>
                <TextInput
                  style={[amStyles.input, { backgroundColor: inputBg, color: inputColor }]}
                  value={price}
                  onChangeText={t => setPrice(t.replace(/[^0-9.]/g, ''))}
                  placeholder="0.00"
                  placeholderTextColor={subColor}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={[amStyles.label, { color: subColor }]}>Количество</Text>
                <TextInput
                  style={[amStyles.input, { backgroundColor: inputBg, color: inputColor }]}
                  value={quantity}
                  onChangeText={t => setQuantity(t.replace(/[^0-9]/g, ''))}
                  placeholder="1"
                  placeholderTextColor={subColor}
                  keyboardType="number-pad"
                  returnKeyType="done"
                />
              </View>
            </View>

            <Text style={[amStyles.label, { color: subColor }]}>Категория</Text>
            <CategoryPicker value={category} onChange={setCategory} />

            <View style={amStyles.btnRow}>
              <TouchableOpacity
                style={[amStyles.btn, amStyles.cancelBtn, { borderColor: isDarkTheme ? '#3A3A3C' : '#C7C7CC' }]}
                onPress={onClose}
              >
                <Text style={[amStyles.cancelText, { color: subColor }]}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[amStyles.btn, amStyles.saveBtn, { backgroundColor: PRIMARY_COLOR, opacity: canSave ? 1 : 0.4 }]}
                onPress={handleSave}
                disabled={!canSave}
              >
                <Text style={amStyles.saveText}>Добавить</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
});
AddExpenseModal.displayName = 'AddExpenseModal';

const amStyles = StyleSheet.create({
  kavOuter: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C7C7CC',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '500', marginTop: 14, marginBottom: 6 },
  input: { borderRadius: 10, padding: 13, fontSize: 16 },
  row: { flexDirection: 'row' },
  btnRow: { flexDirection: 'row', marginTop: 24, gap: 12 },
  btn: { flex: 1, paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  cancelBtn: { borderWidth: 1 },
  saveBtn: {},
  cancelText: { fontSize: 16, fontWeight: '500' },
  saveText: { fontSize: 16, color: '#FFF', fontWeight: '600' },
});

// --- BurgerMenu ---

interface BurgerMenuProps {
  visible: boolean;
  isDarkTheme: boolean;
  user: AuthUser | null;
  onClose: () => void;
}

const BurgerMenu: React.FC<BurgerMenuProps> = ({ visible, isDarkTheme, user, onClose }) => {
  const [modalVisible, setModalVisible] = useState(visible);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 13,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setModalVisible(false));
    }
  }, [visible, slideAnim, backdropAnim]);

  const menuBg = isDarkTheme ? '#1C1C1E' : '#FFF';
  const textColor = isDarkTheme ? '#FFF' : '#000';
  const subColor = isDarkTheme ? '#8E8E93' : '#6C6C70';
  const divColor = isDarkTheme ? '#2C2C2E' : '#F0F0F0';

  const displayName = user
    ? user.showNick ? `@${user.nick}` : `${user.firstName} ${user.lastName}`
    : 'Гость';
  const avatarChar = user ? user.nick[0].toUpperCase() : 'Г';

  const topItems = [
    { icon: 'person-circle-outline' as const, label: 'Профиль' },
    { icon: 'help-circle-outline' as const, label: 'Вопросы' },
    { icon: 'card-outline' as const, label: 'Подписки' },
  ];

  return (
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={onClose}>
      {/* Animated backdrop */}
      <Animated.View
        style={[bmStyles.backdrop, { opacity: backdropAnim }]}
        pointerEvents="none"
      />
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Sliding drawer */}
      <Animated.View
        style={[bmStyles.drawer, { backgroundColor: menuBg, transform: [{ translateX: slideAnim }] }]}
      >
        {/* Use hook-based insets instead of SafeAreaView to avoid inset recalc inside Modal */}
        <DrawerContent
          menuBg={menuBg}
          textColor={textColor}
          subColor={subColor}
          divColor={divColor}
          displayName={displayName}
          avatarChar={avatarChar}
          user={user}
          topItems={topItems}
          onClose={onClose}
        />
      </Animated.View>
    </Modal>
  );
};
BurgerMenu.displayName = 'BurgerMenu';

interface DrawerContentProps {
  menuBg: string; textColor: string; subColor: string; divColor: string;
  displayName: string; avatarChar: string; user: AuthUser | null;
  topItems: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string }[];
  onClose: () => void;
}

const DrawerContent: React.FC<DrawerContentProps> = ({
  textColor, subColor, divColor, displayName, avatarChar, user, topItems, onClose,
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleProfilePress = () => {
    onClose();
    // small delay lets the drawer close animation start before navigating
    setTimeout(() => router.push('/profile' as never), 180);
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top || 20, paddingBottom: insets.bottom || 12 }}>
      <View style={bmStyles.userSection}>
        {user?.photoUri ? (
          <Image source={{ uri: user.photoUri }} style={bmStyles.avatarImg} />
        ) : (
          <View style={[bmStyles.avatar, { backgroundColor: PRIMARY_COLOR }]}>
            <Text style={bmStyles.avatarChar}>{avatarChar}</Text>
          </View>
        )}
        <Text style={[bmStyles.userName, { color: textColor }]} numberOfLines={1}>
          {displayName}
        </Text>
        {user && !user.showNick && (
          <Text style={[bmStyles.userNick, { color: subColor }]}>@{user.nick}</Text>
        )}
      </View>

      <View style={[bmStyles.divider, { backgroundColor: divColor }]} />

      {/* "Профиль" opens the profile screen; others show a stub */}
      {topItems.map(item => (
        <MenuItemRow
          key={item.label}
          icon={item.icon}
          label={item.label}
          textColor={textColor}
          onPress={
            item.label === 'Профиль'
              ? handleProfilePress
              : () => { onClose(); Alert.alert('Скоро', `«${item.label}» будет доступно в следующем обновлении.`); }
          }
        />
      ))}

      <View style={{ flex: 1 }} />

      <View style={[bmStyles.divider, { backgroundColor: divColor }]} />

      <MenuItemRow
        icon="information-circle-outline"
        label="Помощь"
        textColor={subColor}
        onPress={() => {
          onClose();
          Alert.alert('Помощь', 'По вопросам поддержки: support@spento.app');
        }}
      />
    </View>
  );
};

// Animated menu item with press scale
interface MenuItemRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  textColor: string;
  onPress: () => void;
}

const MenuItemRow: React.FC<MenuItemRowProps> = ({ icon, label, textColor, onPress }) => {
  const { scale, onPressIn, onPressOut } = usePressAnimation(0.95);
  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
    >
      <Animated.View style={[bmStyles.menuItem, { transform: [{ scale }] }]}>
        <Ionicons name={icon} size={22} color={PRIMARY_COLOR} />
        <Text style={[bmStyles.menuItemText, { color: textColor }]}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const bmStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  userSection: { paddingHorizontal: 20, paddingVertical: 20 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginBottom: 10,
  },
  avatarChar: { color: '#FFF', fontSize: 22, fontWeight: '700' },
  userName: { fontSize: 16, fontWeight: '700' },
  userNick: { fontSize: 13, marginTop: 2 },
  divider: { height: 1 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  menuItemText: { fontSize: 16 },
});

// --- CircleButton (animated press) ---

interface CircleButtonProps {
  iconName: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  color?: string;
}

const CircleButton: React.FC<CircleButtonProps> = React.memo(({ iconName, onPress, color = PRIMARY_COLOR }) => {
  const { scale, onPressIn, onPressOut } = usePressAnimation(0.88);
  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
    >
      <Animated.View style={[styles.circleButton, { backgroundColor: color, transform: [{ scale }] }]}>
        <Ionicons name={iconName} size={24} color="#FFF" />
      </Animated.View>
    </TouchableOpacity>
  );
});
CircleButton.displayName = 'CircleButton';

// --- PrimaryButton (animated press) ---

interface PrimaryButtonProps {
  iconName: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  title: string;
}

const PrimaryButton: React.FC<PrimaryButtonProps> = React.memo(({ iconName, onPress, title }) => {
  const { scale, onPressIn, onPressOut } = usePressAnimation(0.96);
  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
      style={{ flex: 1, marginHorizontal: 12 }}
    >
      <Animated.View style={[styles.addButton, { backgroundColor: PRIMARY_COLOR, transform: [{ scale }] }]}>
        <Ionicons name={iconName} size={20} color="#FFF" style={{ marginRight: 8 }} />
        <Text style={styles.addButtonText}>{title}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
});
PrimaryButton.displayName = 'PrimaryButton';

// --- ExpenseItemView ---

interface ExpenseItemViewProps {
  item: Expense;
  textColor: Animated.AnimatedInterpolation<string | number>;
  expenseTextColor: Animated.AnimatedInterpolation<string | number>;
}

const ExpenseItemView: React.FC<ExpenseItemViewProps> = React.memo(({ item, textColor, expenseTextColor }) => {
  const cat = CATEGORIES[item.category];
  const total = (item.price * item.quantity).toFixed(2);
  return (
    <View style={{ flex: 1 }}>
      <Animated.Text style={[styles.expenseName, { color: textColor as any }]}>
        {item.name}
        {item.quantity > 1 && (
          <Text style={{ color: PRIMARY_COLOR, fontSize: 13 }}> ×{item.quantity}</Text>
        )}
      </Animated.Text>
      <Animated.Text style={[styles.expenseDetails, { color: expenseTextColor as any }]}>
        <Text style={{ color: cat.color }}>{cat.label}</Text>
        {'  '}
        {item.quantity > 1
          ? `${item.quantity} × ${item.price.toFixed(2)} = ${total} zł`
          : `${item.price.toFixed(2)} zł`}
      </Animated.Text>
    </View>
  );
});
ExpenseItemView.displayName = 'ExpenseItemView';

// --- ExpenseItemEdit ---

interface ExpenseItemEditProps {
  item: Expense;
  isDarkTheme: boolean;
  handleSave: (updatedExpense: Expense) => void;
  onClose: () => void;
}

const ExpenseItemEdit: React.FC<ExpenseItemEditProps> = React.memo(({
  item,
  isDarkTheme,
  handleSave,
  onClose,
}) => {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(item.price));
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [category, setCategory] = useState<Category>(item.category);

  const isDirty =
    name.trim() !== item.name ||
    parseFloat(price) !== item.price ||
    (parseInt(quantity, 10) || 1) !== item.quantity ||
    category !== item.category;

  const handleSaveInline = () => {
    if (!name.trim() || isNaN(parseFloat(price))) return;
    handleSave({
      ...item,
      name: name.trim(),
      price: parseFloat(parseFloat(price).toFixed(2)),
      quantity: Math.max(1, parseInt(quantity, 10) || 1),
      category,
    });
  };

  const inputBg = isDarkTheme ? '#3A3A3C' : '#F2F2F7';
  const inputColor = isDarkTheme ? '#FFF' : '#000';
  const subColor = isDarkTheme ? '#8E8E93' : '#6C6C70';

  return (
    <View style={styles.inlineEditContainer}>
      <Text style={[styles.inlineLabel, { color: subColor }]}>Название</Text>
      <TextInput
        style={[styles.input, { backgroundColor: inputBg, color: inputColor }]}
        value={name}
        onChangeText={setName}
        returnKeyType="done"
      />
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.inlineLabel, { color: subColor }]}>Цена (zł)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: inputColor }]}
            value={price}
            onChangeText={t => setPrice(t.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />
        </View>
        <View style={{ width: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.inlineLabel, { color: subColor }]}>Количество</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: inputColor }]}
            value={quantity}
            onChangeText={t => setQuantity(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            returnKeyType="done"
          />
        </View>
      </View>
      <Text style={[styles.inlineLabel, { color: subColor }]}>Категория</Text>
      <CategoryPicker value={category} onChange={setCategory} />
      <View style={styles.inlineButtonRow}>
        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: isDarkTheme ? '#3A3A3C' : '#E0E0E0' }]}
          onPress={onClose}
        >
          <Text style={[styles.cancelButtonText, { color: isDarkTheme ? '#8E8E93' : '#6C6C70' }]}>Отмена</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: PRIMARY_COLOR, opacity: isDirty ? 1 : 0.4 }]}
          onPress={handleSaveInline}
          disabled={!isDirty}
        >
          <Text style={styles.saveButtonText}>Сохранить</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});
ExpenseItemEdit.displayName = 'ExpenseItemEdit';

// --- Day-grouping utilities ---

type ListRow =
  | { type: 'dayHeader'; key: string; label: string; dayTotal: number }
  | { type: 'expense';   key: string; expense: Expense };

function formatDayLabel(dayStr: string): string {
  const now = new Date();
  const todayStr  = now.toISOString().slice(0, 10);
  const yestStr   = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  if (dayStr === todayStr) return 'Сегодня';
  if (dayStr === yestStr)  return 'Вчера';
  const d = new Date(dayStr + 'T12:00:00'); // noon to avoid tz shift
  const dow = DAYS_RU[d.getDay()];
  const mon = MONTHS_SHORT[d.getMonth()];
  return d.getFullYear() === now.getFullYear()
    ? `${dow}, ${d.getDate()} ${mon}`
    : `${dow}, ${d.getDate()} ${mon} ${d.getFullYear()}`;
}

function groupByDay(expenses: Expense[]): ListRow[] {
  const sorted = [...expenses].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const rows: ListRow[] = [];
  let lastDay = '';
  for (const expense of sorted) {
    const day = expense.date.slice(0, 10);
    if (day !== lastDay) {
      const dayExpenses = sorted.filter(e => e.date.slice(0, 10) === day);
      const dayTotal = dayExpenses.reduce((s, e) => s + e.price * e.quantity, 0);
      rows.push({ type: 'dayHeader', key: `hdr_${day}`, label: formatDayLabel(day), dayTotal });
      lastDay = day;
    }
    rows.push({ type: 'expense', key: expense.id, expense });
  }
  return rows;
}

// --- DayHeader ---

interface DayHeaderProps { label: string; dayTotal: number; isDarkTheme: boolean; }
const DayHeader: React.FC<DayHeaderProps> = ({ label, dayTotal, isDarkTheme }) => (
  <View style={styles.dayHeader}>
    <Text style={[styles.dayHeaderLabel, { color: isDarkTheme ? '#8E8E93' : '#6C6C70' }]}>
      {label}
    </Text>
    <Text style={[styles.dayHeaderTotal, { color: isDarkTheme ? '#636366' : '#9E9EA0' }]}>
      {dayTotal.toFixed(2)} zł
    </Text>
  </View>
);

// --- ArchiveModal ---

interface ArchiveModalProps {
  visible: boolean;
  onClose: () => void;
  expenses: Expense[];
  isDarkTheme: boolean;
}

const ArchiveModal: React.FC<ArchiveModalProps> = ({ visible, onClose, expenses, isDarkTheme }) => {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const bg      = isDarkTheme ? '#161616' : '#F5F5F5';
  const cardBg  = isDarkTheme ? '#2C2C2E' : '#FFF';
  const textClr = isDarkTheme ? '#FFF'    : '#1C1C1E';
  const subClr  = isDarkTheme ? '#8E8E93' : '#6C6C70';

  const months = useMemo(() => {
    const map = new Map<string, { label: string; total: number; count: number; items: Expense[] }>();
    for (const e of expenses) {
      const key = e.date.slice(0, 7);
      const d   = new Date(e.date + 'T12:00:00');
      if (!map.has(key)) {
        map.set(key, { label: `${MONTHS_FULL_RU[d.getMonth()]} ${d.getFullYear()}`, total: 0, count: 0, items: [] });
      }
      const m = map.get(key)!;
      m.total += e.price * e.quantity;
      m.count += 1;
      m.items.push(e);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, val]) => ({ key, ...val }));
  }, [expenses]);

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const archiveMonths   = months.filter(m => m.key < currentMonthKey);

  const selectedData = selectedMonth ? months.find(m => m.key === selectedMonth) : null;
  const archiveRows  = useMemo(
    () => selectedData ? groupByDay(selectedData.items) : [],
    [selectedData]
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: bg }}>
        {/* Archive header */}
        <View style={[archS.header, { backgroundColor: cardBg }]}>
          <TouchableOpacity
            onPress={selectedMonth ? () => setSelectedMonth(null) : onClose}
            style={{ padding: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons name={selectedMonth ? 'chevron-back' : 'close'} size={24} color={PRIMARY_COLOR} />
          </TouchableOpacity>
          <Text style={[archS.title, { color: textClr }]}>
            {selectedData ? selectedData.label : 'Архив'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {!selectedMonth ? (
          /* Month list */
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {archiveMonths.length === 0 ? (
              <Text style={[archS.empty, { color: subClr }]}>Нет архивных данных</Text>
            ) : archiveMonths.map(m => (
              <TouchableOpacity
                key={m.key}
                onPress={() => setSelectedMonth(m.key)}
                style={[archS.monthCard, { backgroundColor: cardBg }]}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[archS.monthLabel, { color: textClr }]}>{m.label}</Text>
                  <Text style={[archS.monthSub, { color: subClr }]}>{m.count} позиций</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[archS.monthTotal, { color: PRIMARY_COLOR }]}>
                    {m.total.toFixed(2)} zł
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={subClr} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          /* Month detail grouped by day */
          <FlatList
            data={archiveRows}
            keyExtractor={row => row.key}
            renderItem={({ item }) => {
              if (item.type === 'dayHeader') {
                return <DayHeader label={item.label} dayTotal={item.dayTotal} isDarkTheme={isDarkTheme} />;
              }
              const e = item.expense;
              const cat = CATEGORIES[e.category];
              return (
                <View style={[archS.expenseCard, { backgroundColor: cardBg }]}>
                  <View style={[archS.catDot, { backgroundColor: cat.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[archS.expName, { color: textClr }]}>{e.name}</Text>
                    <Text style={[archS.expSub, { color: subClr }]}>{cat.label} · ×{e.quantity}</Text>
                  </View>
                  <Text style={[archS.expPrice, { color: textClr }]}>
                    {(e.price * e.quantity).toFixed(2)} zł
                  </Text>
                </View>
              );
            }}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const archS = StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minHeight: 56, justifyContent: 'space-between' },
  title:       { fontSize: 18, fontWeight: '700' },
  empty:       { textAlign: 'center', marginTop: 60, fontSize: 16 },
  monthCard:   { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 16, marginBottom: 10 },
  monthLabel:  { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  monthSub:    { fontSize: 13 },
  monthTotal:  { fontSize: 16, fontWeight: '700' },
  expenseCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  catDot:      { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  expName:     { fontSize: 15, fontWeight: '500' },
  expSub:      { fontSize: 13, marginTop: 2 },
  expPrice:    { fontSize: 15, fontWeight: '600' },
});

// --- ExpenseItem (double-tap to reveal actions) ---

const REVEAL_WIDTH  = 140;
const REVEAL_OFFSET = REVEAL_WIDTH + 10; // extra 10px gap between card and buttons

interface ExpenseItemProps {
  item: Expense;
  isDarkTheme: boolean;
  textColor: Animated.AnimatedInterpolation<string | number>;
  expenseTextColor: Animated.AnimatedInterpolation<string | number>;
  handleSave: (updatedExpense: Expense) => void;
  handleDelete: (item: Expense) => void; // full item for undo support
}

const ExpenseItem: React.FC<ExpenseItemProps> = React.memo(({
  item, isDarkTheme, textColor, expenseTextColor, handleSave, handleDelete,
}) => {
  const swipeX   = useRef(new Animated.Value(0)).current;
  const editAnim = useRef(new Animated.Value(0)).current;
  const [revealed, setRevealed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const lastTap  = useRef(0);

  // ── Snap helpers ────────────────────────────────────────────────────────────
  const snapOpen = () => {
    setRevealed(true);
    Animated.spring(swipeX, { toValue: -REVEAL_OFFSET, useNativeDriver: true, tension: 200, friction: 18 }).start();
  };

  const snapClose = () => {
    setRevealed(false);
    Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, tension: 200, friction: 18 }).start();
  };

  // ── Tap: single tap closes if revealed; double-tap reveals ──────────────────
  const handleTap = () => {
    if (isEditing) return;
    if (revealed) { snapClose(); return; }
    const now = Date.now();
    if (now - lastTap.current < 350) {
      lastTap.current = 0;
      snapOpen();
    } else {
      lastTap.current = now;
    }
  };

  // ── Delete: fly off left → parent handles list collapse + undo toast ─────────
  const handleDeletePress = () => {
    Animated.timing(swipeX, { toValue: -600, useNativeDriver: true, duration: 240 })
      .start(() => handleDelete(item));
  };

  // ── Edit: snap back, then spring-expand the form ────────────────────────────
  const handleEditPress = () => {
    setRevealed(false);
    Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, tension: 200, friction: 18 }).start(() => {
      editAnim.setValue(0);
      setIsEditing(true);
      Animated.spring(editAnim, {
        toValue: 1,
        useNativeDriver: false,
        tension: 90,
        friction: 11,
      }).start();
    });
  };

  const handleCloseEdit = () => {
    Animated.timing(editAnim, {
      toValue: 0,
      duration: 210,
      useNativeDriver: false,
    }).start(() => setIsEditing(false));
  };

  const dotColor = isDarkTheme ? '#48484A' : '#C7C7CC';

  return (
    <View style={styles.swipeContainer}>
      {/* Action buttons revealed on tap */}
      <View style={styles.swipeActions}>
        <TouchableOpacity style={[styles.swipeActionBtn, { backgroundColor: '#636366' }]} onPress={handleEditPress}>
          <Ionicons name="pencil" size={18} color="#FFF" />
          <Text style={styles.swipeActionLabel}>Изменить</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.swipeActionBtn, { backgroundColor: DANGER_COLOR }]} onPress={handleDeletePress}>
          <Ionicons name="trash" size={18} color="#FFF" />
          <Text style={styles.swipeActionLabel}>Удалить</Text>
        </TouchableOpacity>
      </View>

      {/* Sliding card */}
      <Animated.View
        style={[styles.swipeCard, { backgroundColor: isDarkTheme ? '#2C2C2E' : '#FFF', transform: [{ translateX: swipeX }] }]}
      >
        <TouchableOpacity activeOpacity={0.85} onPress={handleTap} style={styles.swipeCardContent}>
          <ExpenseItemView item={item} textColor={textColor} expenseTextColor={expenseTextColor} />
          {!isEditing && (
            <Ionicons
              name={revealed ? 'chevron-forward' : 'ellipsis-horizontal'}
              size={15}
              color={revealed ? PRIMARY_COLOR : dotColor}
            />
          )}
        </TouchableOpacity>

        {isEditing && (
          <Animated.View style={{
            maxHeight: editAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 600] }),
            opacity: editAnim.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: 'clamp' }),
            overflow: 'hidden',
          }}>
            <ExpenseItemEdit
              item={item}
              isDarkTheme={isDarkTheme}
              handleSave={(updated) => { handleSave(updated); handleCloseEdit(); }}
              onClose={handleCloseEdit}
            />
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
});
ExpenseItem.displayName = 'ExpenseItem';

// --- Main App Component ---

interface PendingDelete { item: Expense; idx: number; }

interface AppProps {
  onExpensesChange?: (e: Expense[]) => void;
  openMenuRef?: { current: (() => void) | null };
}

export default function App({ onExpensesChange, openMenuRef }: AppProps = {}): React.JSX.Element {
  const { isDark: isDarkTheme, setDark } = useTheme();
  const onExpensesChangeRef = useRef(onExpensesChange);
  useEffect(() => { onExpensesChangeRef.current = onExpensesChange; });

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const animValue = useRef(new Animated.Value(isDarkTheme ? 1 : 0)).current;
  const [showAddModal, setShowAddModal] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Undo toast
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [undoCountdown, setUndoCountdown] = useState(5);
  const toastSlide    = useRef(new Animated.Value(100)).current;
  const toastProgress = useRef(new Animated.Value(1)).current;
  const undoTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const expensesRef   = useRef<Expense[]>([]);
  useEffect(() => { expensesRef.current = expenses; }, [expenses]);
  useEffect(() => () => { if (undoTimerRef.current) clearInterval(undoTimerRef.current); }, []);

  // Animated header button scales
  const menuBtnScale = useRef(new Animated.Value(1)).current;
  const themeBtnScale = useRef(new Animated.Value(1)).current;

  const animateHeaderBtn = (scale: Animated.Value) => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.82, useNativeDriver: true, tension: 400, friction: 10 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 9 }),
    ]).start();
  };

  useEffect(() => {
    const init = async () => {
      try {
        const [savedExpenses, savedUser] = await Promise.all([
          loadExpenses(),
          loadUser(),
        ]);
        setUser(savedUser);
        setExpenses(savedExpenses.length > 0 ? savedExpenses : SAMPLE_EXPENSES);
      } catch {
        setExpenses(SAMPLE_EXPENSES);
      } finally {
        setLoaded(true);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveExpenses(expenses);
    onExpensesChangeRef.current?.(expenses);
  }, [expenses, loaded]);

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: isDarkTheme ? 1 : 0,
      duration: TRANSITION_DURATION,
      useNativeDriver: false,
    }).start();
  }, [isDarkTheme, animValue]);

  const backgroundColor = animValue.interpolate({ inputRange: [0, 1], outputRange: ['#F5F5F5', '#161616'] });
  const headerColor = animValue.interpolate({ inputRange: [0, 1], outputRange: ['#FFF', '#222'] });
  const textColor = animValue.interpolate({ inputRange: [0, 1], outputRange: ['#000', '#FFF'] });
  const expenseTextColor = animValue.interpolate({ inputRange: [0, 1], outputRange: ['#555', '#CCC'] });

  const toggleTheme = () => {
    animateHeaderBtn(themeBtnScale);
    const next = !isDarkTheme;
    setDark(next);
    AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
  };

  const openMenu = useCallback(() => {
    animateHeaderBtn(menuBtnScale);
    setMenuVisible(true);
  }, [menuBtnScale]);

  useEffect(() => {
    if (openMenuRef) openMenuRef.current = openMenu;
  }, [openMenu, openMenuRef]);

  const handleSaveExpense = useCallback((updatedExpense: Expense) => {
    setExpenses(prev => prev.map(e => e.id === updatedExpense.id ? updatedExpense : e));
  }, []);

  const handleDeleteExpense = useCallback((expense: Expense) => {
    const idx = expensesRef.current.findIndex(e => e.id === expense.id);
    LayoutAnimation.configureNext({
      duration: 380,
      update: { type: 'spring', springDamping: 0.62 },
      delete: { type: 'easeInEaseOut', property: 'opacity', duration: 180 },
    });
    setExpenses(prev => prev.filter(e => e.id !== expense.id));
    setPendingDelete({ item: expense, idx });

    toastSlide.setValue(100);
    toastProgress.setValue(1);
    Animated.spring(toastSlide, { toValue: 0, useNativeDriver: true, tension: 150, friction: 12 }).start();
    Animated.timing(toastProgress, { toValue: 0, useNativeDriver: false, duration: 5000 }).start();

    setUndoCountdown(5);
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    undoTimerRef.current = setInterval(() => {
      setUndoCountdown(c => {
        if (c <= 1) {
          clearInterval(undoTimerRef.current!);
          undoTimerRef.current = null;
          Animated.timing(toastSlide, { toValue: 100, useNativeDriver: true, duration: 220 })
            .start(() => setPendingDelete(null));
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, [toastSlide, toastProgress]);

  const handleUndoDelete = useCallback(() => {
    if (!pendingDelete) return;
    if (undoTimerRef.current) { clearInterval(undoTimerRef.current); undoTimerRef.current = null; }
    toastProgress.stopAnimation();
    Animated.timing(toastSlide, { toValue: 100, useNativeDriver: true, duration: 200 })
      .start(() => { setPendingDelete(null); setUndoCountdown(5); });
    LayoutAnimation.configureNext({
      duration: 300,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'spring', springDamping: 0.72 },
    });
    setExpenses(prev => {
      const arr = [...prev];
      arr.splice(Math.min(pendingDelete.idx, arr.length), 0, pendingDelete.item);
      return arr;
    });
  }, [pendingDelete, toastSlide, toastProgress]);

  const handleAddExpense = useCallback((newData: Omit<Expense, 'id'>) => {
    setExpenses(prev => [{ ...newData, id: generateId() }, ...prev]);
  }, []);

  const [ocrVisible,   setOcrVisible]   = useState(false);
  const [ocrImageUri,  setOcrImageUri]  = useState<string | null>(null);

  const launchCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Нет доступа', 'Разрешите доступ к камере в настройках.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setOcrImageUri(result.assets[0].uri);
      setOcrVisible(true);
    }
  }, []);

  const launchGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Нет доступа', 'Разрешите доступ к галерее в настройках.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setOcrImageUri(result.assets[0].uri);
      setOcrVisible(true);
    }
  }, []);

  const handleAddCamera = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Отмена', 'Камера', 'Галерея'], cancelButtonIndex: 0 },
        btn => { if (btn === 1) launchCamera(); if (btn === 2) launchGallery(); },
      );
    } else {
      Alert.alert('Добавить расход', 'Выберите источник', [
        { text: 'Камера',  onPress: launchCamera },
        { text: 'Галерея', onPress: launchGallery },
        { text: 'Отмена', style: 'cancel' },
      ]);
    }
  }, [launchCamera, launchGallery]);

  const handleOcrConfirm = useCallback((newItems: Omit<Expense, 'id'>[], _receiptId?: string) => {
    setOcrVisible(false);
    LayoutAnimation.configureNext({
      duration: 320,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'spring', springDamping: 0.70 },
    });
    setExpenses(prev => [
      ...newItems.map(it => ({ ...it, id: generateId() })),
      ...prev,
    ]);
  }, []);

  const [archiveVisible, setArchiveVisible] = useState(false);

  const groupedExpenses = useMemo(() => groupByDay(expenses), [expenses]);

  const renderRow = useCallback(({ item }: { item: ListRow }) => {
    if (item.type === 'dayHeader') {
      return <DayHeader label={item.label} dayTotal={item.dayTotal} isDarkTheme={isDarkTheme} />;
    }
    return (
      <ExpenseItem
        item={item.expense}
        isDarkTheme={isDarkTheme}
        textColor={textColor}
        expenseTextColor={expenseTextColor}
        handleSave={handleSaveExpense}
        handleDelete={handleDeleteExpense}
      />
    );
  }, [isDarkTheme, handleSaveExpense, handleDeleteExpense, textColor, expenseTextColor]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: isDarkTheme ? '#161616' : '#F5F5F5' }}>
      <StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} />
      <Animated.View style={{ flex: 1, backgroundColor }}>

        <Animated.View style={[styles.header, { backgroundColor: headerColor }]}>
          <TouchableOpacity onPress={openMenu} activeOpacity={1} style={{ padding: 8 }}>
            <Animated.View style={{ transform: [{ scale: menuBtnScale }] }}>
              <Ionicons name="menu" size={28} color={isDarkTheme ? '#FFF' : '#000'} />
            </Animated.View>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Animated.Text style={[styles.title, { color: textColor as any }]}>Spento</Animated.Text>
            <View style={styles.freeBadge}>
              <Text style={styles.freeBadgeText}>FREE</Text>
            </View>
          </View>

          <TouchableOpacity onPress={toggleTheme} activeOpacity={1} style={{ padding: 8 }}>
            <Animated.View style={{ transform: [{ scale: themeBtnScale }] }}>
              <Ionicons name={isDarkTheme ? 'sunny' : 'moon'} size={28} color={PRIMARY_COLOR} />
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>

        {expenses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color={isDarkTheme ? '#444' : '#CCC'} />
            <Text style={[styles.emptyText, { color: isDarkTheme ? '#666' : '#AAA' }]}>
              Нет расходов. Нажмите «+» чтобы добавить.
            </Text>
          </View>
        ) : (
          <FlatList
            data={groupedExpenses}
            keyExtractor={row => row.key}
            renderItem={renderRow}
            style={styles.list}
            contentContainerStyle={{ paddingBottom: 100 }}
            keyboardDismissMode="interactive"
            ListFooterComponent={
              <TouchableOpacity
                style={[styles.archiveFooterBtn, { borderColor: isDarkTheme ? '#3A3A3C' : '#D1D1D6' }]}
                onPress={() => setArchiveVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="archive-outline" size={18} color={isDarkTheme ? '#8E8E93' : '#6C6C70'} />
                <Text style={[styles.archiveFooterText, { color: isDarkTheme ? '#8E8E93' : '#6C6C70' }]}>
                  Архив
                </Text>
              </TouchableOpacity>
            }
          />
        )}

        <View style={styles.buttonRow}>
          <PrimaryButton
            iconName="camera"
            onPress={handleAddCamera}
            title="Добавить расход"
          />
          <CircleButton
            iconName="add"
            onPress={() => setShowAddModal(true)}
          />
        </View>

        {/* Undo delete toast */}
        {pendingDelete && (
          <Animated.View
            style={[
              styles.undoToast,
              { backgroundColor: isDarkTheme ? '#2C2C2E' : '#FFF', transform: [{ translateY: toastSlide }] },
            ]}
          >
            <Text style={[styles.undoToastText, { color: isDarkTheme ? '#FFF' : '#1C1C1E' }]} numberOfLines={1}>
              {'Удалено "' + pendingDelete.item.name + '"'}
            </Text>
            <View style={styles.undoToastRight}>
              <Text style={[styles.undoCountdown, { color: isDarkTheme ? '#8E8E93' : '#6C6C70' }]}>
                {undoCountdown}
              </Text>
              <TouchableOpacity style={styles.undoBtn} onPress={handleUndoDelete} activeOpacity={0.75}>
                <Text style={styles.undoBtnText}>Отменить</Text>
              </TouchableOpacity>
            </View>
            <Animated.View
              style={[
                styles.undoProgress,
                { width: toastProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
              ]}
            />
          </Animated.View>
        )}
      </Animated.View>

      <AddExpenseModal
        visible={showAddModal}
        isDarkTheme={isDarkTheme}
        existingExpenses={expenses}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddExpense}
      />

      <BurgerMenu
        visible={menuVisible}
        isDarkTheme={isDarkTheme}
        user={user}
        onClose={() => setMenuVisible(false)}
      />

      <ArchiveModal
        visible={archiveVisible}
        onClose={() => setArchiveVisible(false)}
        expenses={expenses}
        isDarkTheme={isDarkTheme}
      />

      <OcrOverlay
        visible={ocrVisible}
        imageUri={ocrImageUri}
        userId={user?.mongoId}
        isDarkTheme={isDarkTheme}
        onConfirm={handleOcrConfirm}
        onCancel={() => setOcrVisible(false)}
      />
    </SafeAreaView>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 60,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  title: { fontSize: 20, fontWeight: 'bold' },
  list: { flex: 1 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyText: { fontSize: 16, textAlign: 'center' },
  expenseName: { fontSize: 16, fontWeight: '500' },
  expenseDetails: { fontSize: 14, marginTop: 2 },
  // Swipe-to-reveal item styles
  swipeContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  swipeActions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: REVEAL_WIDTH,
    flexDirection: 'row',
    gap: 6,
  },
  swipeActionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 12,
  },
  swipeActionLabel: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  swipeCard: {
    borderRadius: 12,
  },
  swipeCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inlineEditContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  inlineLabel: { fontSize: 12, fontWeight: '500', marginTop: 8, marginBottom: 4 },
  input: { borderRadius: 8, padding: 10, fontSize: 16 },
  inlineButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 15,
    marginBottom: 10,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 8,
  },
  cancelButtonText: { fontWeight: '600', fontSize: 14 },
  saveButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  buttonRow: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  circleButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: '#FFF', fontWeight: '600', fontSize: 16 },

  // FREE badge in header
  freeBadge: {
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  freeBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  // Archive footer button
  archiveFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 40,
    marginTop: 16,
    marginBottom: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  archiveFooterText: { fontSize: 15, fontWeight: '500' },

  // Day group header
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  dayHeaderLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  dayHeaderTotal: { fontSize: 13, fontWeight: '500' },

  // Undo delete toast
  undoToast: {
    position: 'absolute',
    bottom: 84,
    left: 16,
    right: 16,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  undoToastText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  undoToastRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 8,
  },
  undoCountdown: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 16,
    textAlign: 'center',
  },
  undoBtn: {
    backgroundColor: '#636366',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  undoBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  undoProgress: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
    backgroundColor: PRIMARY_COLOR,
  },
});
