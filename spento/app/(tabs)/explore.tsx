import React, { useState, useRef, useEffect, useCallback } from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  textColor: Animated.AnimatedInterpolation<string | number>;
  handleSave: (updatedExpense: Expense) => void;
  handleDelete: (id: string) => void;
  onClose: () => void;
}

const ExpenseItemEdit: React.FC<ExpenseItemEditProps> = React.memo(({
  item,
  isDarkTheme,
  handleSave,
  handleDelete,
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

  const handleDeleteConfirmed = () => {
    Alert.alert(
      'Удаление',
      `Вы уверены, что хотите удалить "${item.name}"?`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Удалить', style: 'destructive', onPress: () => handleDelete(item.id) },
      ]
    );
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
          style={[styles.deleteButton, { backgroundColor: DANGER_COLOR }]}
          onPress={handleDeleteConfirmed}
        >
          <Ionicons name="trash-outline" size={20} color="#FFF" />
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

// --- ExpenseItem (with animated chevron + LayoutAnimation) ---

interface ExpenseItemProps {
  item: Expense;
  isDarkTheme: boolean;
  isAppInEditMode: boolean;
  textColor: Animated.AnimatedInterpolation<string | number>;
  expenseTextColor: Animated.AnimatedInterpolation<string | number>;
  handleSave: (updatedExpense: Expense) => void;
  handleDelete: (id: string) => void;
  expandedItemId: string | null;
  setExpandedItemId: (id: string | null) => void;
}

const ExpenseItem: React.FC<ExpenseItemProps> = React.memo((props) => {
  const {
    item, isDarkTheme, isAppInEditMode,
    textColor, expenseTextColor,
    handleSave, handleDelete,
    expandedItemId, setExpandedItemId,
  } = props;

  const isExpanded = expandedItemId === item.id;
  const chevronAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(chevronAnim, {
      toValue: isExpanded ? 1 : 0,
      useNativeDriver: true,
      tension: 200,
      friction: 12,
    }).start();
  }, [isExpanded, chevronAnim]);

  const chevronRotate = chevronAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  const handleToggleExpand = useCallback(() => {
    if (!isAppInEditMode) return;
    LayoutAnimation.configureNext({
      duration: 260,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'spring', springDamping: 0.75 },
      delete: { type: 'easeInEaseOut', property: 'opacity' },
    });
    setExpandedItemId(isExpanded ? null : item.id);
  }, [isAppInEditMode, isExpanded, item.id, setExpandedItemId]);

  const iconColor = isAppInEditMode ? PRIMARY_COLOR : (isDarkTheme ? '#3A3A3C' : '#FFF');

  return (
    <View style={[styles.expenseItem, { backgroundColor: isDarkTheme ? '#2C2C2E' : '#FFF' }]}>
      <View style={styles.expenseHeaderRow}>
        <ExpenseItemView item={item} textColor={textColor} expenseTextColor={expenseTextColor} />
        <TouchableOpacity onPress={handleToggleExpand} style={styles.toggleButton}>
          <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
            <Ionicons name="chevron-down" size={24} color={iconColor} />
          </Animated.View>
        </TouchableOpacity>
      </View>
      {isExpanded && isAppInEditMode && (
        <ExpenseItemEdit
          item={item}
          isDarkTheme={isDarkTheme}
          textColor={textColor}
          handleSave={handleSave}
          handleDelete={handleDelete}
          onClose={handleToggleExpand}
        />
      )}
    </View>
  );
});
ExpenseItem.displayName = 'ExpenseItem';

// --- Sample data for first launch ---

const SAMPLE_EXPENSES: Expense[] = (() => {
  const now = new Date().toISOString();
  return [
    { id: generateId(), productId: 'p_cheese', name: 'Сыр', price: 5.50, quantity: 1, category: 'Useful', date: now },
    { id: generateId(), productId: 'p_brownie', name: 'Мюллер брауни', price: 3.95, quantity: 2, category: 'Sweets', date: now },
    { id: generateId(), productId: 'p_cigs', name: 'Сигареты', price: 10.00, quantity: 1, category: 'Harmful', date: now },
    { id: generateId(), productId: 'p_mcdonalds', name: 'Макдональдс', price: 15.00, quantity: 1, category: 'Needs', date: now },
  ];
})();

// --- Main App Component ---

export default function App(): React.JSX.Element {
  const { isDark: isDarkTheme, setDark } = useTheme();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const animValue = useRef(new Animated.Value(isDarkTheme ? 1 : 0)).current;
  const [isEditMode, setIsEditMode] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);

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

  const openMenu = () => {
    animateHeaderBtn(menuBtnScale);
    setMenuVisible(true);
  };

  const handleSaveExpense = useCallback((updatedExpense: Expense) => {
    setExpenses(prev => prev.map(e => e.id === updatedExpense.id ? updatedExpense : e));
    setExpandedItemId(null);
  }, []);

  const handleDeleteExpense = useCallback((id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    setExpandedItemId(null);
  }, []);

  const handleAddExpense = useCallback((newData: Omit<Expense, 'id'>) => {
    setExpenses(prev => [{ ...newData, id: generateId() }, ...prev]);
  }, []);

  const handleAddCamera = () => {
    Alert.alert('Скоро', 'Сканирование чеков будет доступно с ИИ-интеграцией.');
  };

  const handleEditModeToggle = useCallback(() => {
    setIsEditMode(prev => {
      if (prev) setExpandedItemId(null);
      return !prev;
    });
  }, []);

  const renderExpense = useCallback(({ item }: { item: Expense }) => (
    <ExpenseItem
      item={item}
      isDarkTheme={isDarkTheme}
      isAppInEditMode={isEditMode}
      textColor={textColor}
      expenseTextColor={expenseTextColor}
      handleSave={handleSaveExpense}
      handleDelete={handleDeleteExpense}
      expandedItemId={expandedItemId}
      setExpandedItemId={setExpandedItemId}
    />
  ), [isEditMode, isDarkTheme, expandedItemId, handleSaveExpense, handleDeleteExpense, textColor, expenseTextColor]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: isDarkTheme ? '#161616' : '#F5F5F5' }}>
      <StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} />
      <Animated.View style={{ flex: 1, backgroundColor }}>

        <Animated.View style={[styles.header, { backgroundColor: headerColor }]}>
          <TouchableOpacity onPress={openMenu} activeOpacity={1}>
            <Animated.View style={{ transform: [{ scale: menuBtnScale }] }}>
              <Ionicons name="menu" size={28} color={isDarkTheme ? '#FFF' : '#000'} />
            </Animated.View>
          </TouchableOpacity>

          <Animated.Text style={[styles.title, { color: textColor as any }]}>Spento</Animated.Text>

          <TouchableOpacity onPress={toggleTheme} activeOpacity={1}>
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
            data={expenses}
            keyExtractor={item => item.id}
            renderItem={renderExpense}
            style={styles.list}
            keyboardDismissMode="interactive"
          />
        )}

        <View style={styles.buttonRow}>
          <CircleButton
            iconName={isEditMode ? 'close' : 'pencil'}
            onPress={handleEditModeToggle}
            color={isEditMode ? DANGER_COLOR : PRIMARY_COLOR}
          />
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
    minHeight: 80,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  title: { fontSize: 20, fontWeight: 'bold' },
  list: { flex: 1, padding: 16 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyText: { fontSize: 16, textAlign: 'center' },
  expenseItem: {
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  expenseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  expenseName: { fontSize: 16, fontWeight: '500' },
  expenseDetails: { fontSize: 14, marginTop: 2 },
  toggleButton: { padding: 8 },
  inlineEditContainer: {
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
    paddingTop: 8,
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
  saveButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 15,
  },
  saveButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
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
});
