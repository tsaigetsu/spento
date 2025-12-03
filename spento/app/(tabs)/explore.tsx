import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Animated,
  Appearance,
  TextInput,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- Типы и Константы ---

type Expense = {
  id: string;
  name: string;
  price: number; 
  category: 'Ingridients' | 'Sweets' | 'Habbits' | 'Happiness';
};

const PRIMARY_COLOR = '#9644D8FF';
const DANGER_COLOR = '#FF3B30';
const TRANSITION_DURATION = 150;
const STORAGE_KEY = 'SPENTO_THEME';

// --- ПЕРЕИСПОЛЬЗУЕМЫЕ КОМПОНЕНТЫ КНОПОК ---

interface CircleButtonProps {
  iconName: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  color?: string;
}

const CircleButton: React.FC<CircleButtonProps> = React.memo(({ iconName, onPress, color = PRIMARY_COLOR }) => (
  <TouchableOpacity
    style={[styles.circleButton, { backgroundColor: color }]}
    onPress={onPress}
  >
    <Ionicons name={iconName} size={24} color="#FFF" />
  </TouchableOpacity>
));

// Добавление displayName для отладки
CircleButton.displayName = 'CircleButton';


interface PrimaryButtonProps {
  iconName: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  title: string;
}

const PrimaryButton: React.FC<PrimaryButtonProps> = React.memo(({ iconName, onPress, title }) => (
  <TouchableOpacity style={[styles.addButton, { backgroundColor: PRIMARY_COLOR }]} onPress={onPress}>
    <Ionicons name={iconName} size={20} color="#FFF" style={{ marginRight: 8 }} />
    <Text style={styles.addButtonText}>{title}</Text>
  </TouchableOpacity>
));

// Добавление displayName для отладки
PrimaryButton.displayName = 'PrimaryButton';


// --- 1. МАЛЕНЬКАЯ ПЛАШКА: Компонент отображения (Нередактируемая часть) ---

interface ExpenseItemViewProps {
  item: Expense;
  textColor: Animated.AnimatedInterpolation<string | number>;
  expenseTextColor: Animated.AnimatedInterpolation<string | number>;
}

const ExpenseItemView: React.FC<ExpenseItemViewProps> = React.memo(({
  item,
  textColor,
  expenseTextColor,
}) => (
  <View style={{ flex: 1 }}>
    <Animated.Text style={[styles.expenseName, { color: textColor as any }]}>
      {item.name}
    </Animated.Text>
    <Animated.Text style={[styles.expenseDetails, { color: expenseTextColor as any }]}>
      {item.category} — **zł{item.price.toFixed(2)}** </Animated.Text>
  </View>
));

// Добавление displayName для отладки
ExpenseItemView.displayName = 'ExpenseItemView';


// --- 2. БОЛЬШАЯ ПЛАШКА: Компонент редактирования ---

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
  textColor,
  handleSave,
  handleDelete,
}) => {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(item.price)); 
  const [category, setCategory] = useState(item.category);

  const isDirty = name !== item.name || String(parseFloat(price).toFixed(2)) !== item.price.toFixed(2) || category !== item.category;

  const handleSaveInline = () => {
    if (!name.trim() || isNaN(parseFloat(price))) return;
    
    // ИММУТАБЕЛЬНОСТЬ: Создаем новый объект
    const newExpenseData: Expense = {
        ...item,
        name: name.trim(),
        price: parseFloat(parseFloat(price).toFixed(2)), 
        category: category as Expense['category'],
    };
    handleSave(newExpenseData);
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
  
  const inputBackground = isDarkTheme ? '#333' : '#2C2C2EFF';
  const inputColor = isDarkTheme ? '#FFF' : '#000';

  return (
    <View style={styles.inlineEditContainer}>
      
      <Text style={[styles.inlineLabel, { color: textColor as any }]}>Название</Text>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputColor }]}
        value={name}
        onChangeText={setName}
        returnKeyType="done"
      />

      <Text style={[styles.inlineLabel, { color: textColor as any }]}>Цена (zł)</Text>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputColor }]}
        value={price}
        onChangeText={(text) => setPrice(text.replace(/[^0-9.]/g, ''))} 
        keyboardType="numeric"
        returnKeyType="done"
      />

      <Text style={[styles.inlineLabel, { color: textColor as any }]}>Категория</Text>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputColor }]}
        value={category}
        onChangeText={setCategory}
        returnKeyType="done"
      />

      <View style={styles.inlineButtonRow}>
        <TouchableOpacity
          style={[styles.deleteButton, { backgroundColor: DANGER_COLOR }]}
          onPress={handleDeleteConfirmed}
        >
          <Ionicons name="trash-outline" size={20} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: PRIMARY_COLOR, opacity: isDirty ? 1 : 0.5 }]}
          onPress={handleSaveInline}
          disabled={!isDirty}
        >
          <Text style={styles.saveButtonText}>Сохранить</Text>
        </TouchableOpacity>

      </View>
    </View>
  );
});

// Добавление displayName для отладки
ExpenseItemEdit.displayName = 'ExpenseItemEdit';


// --- 3. КОМПОНЕНТ-ОБЕРТКА: Управление режимами ---

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
    item, 
    isDarkTheme, 
    isAppInEditMode, 
    textColor, 
    expenseTextColor, 
    handleSave, 
    handleDelete, 
    expandedItemId, 
    setExpandedItemId 
  } = props;
  
  const isExpanded = expandedItemId === item.id;
  
  const handleToggleExpand = useCallback(() => {
    if (!isAppInEditMode) return; 

    if (isExpanded) {
        setExpandedItemId(null);
    } else {
        setExpandedItemId(item.id);
    }
  }, [isAppInEditMode, isExpanded, item.id, setExpandedItemId]);


  // Цвет иконки для невидимости/видимости
  const iconColor = isAppInEditMode ? PRIMARY_COLOR : (isDarkTheme ? '#333' : '#FFF');
  
  return (
    <Animated.View style={[styles.expenseItem, { backgroundColor: isDarkTheme ? '#333' : '#FFF' }]}>
      
      {/* HEADER ROW */}
      <View style={styles.expenseHeaderRow}>
        
        {/* Нередактируемая часть всегда в ExpenseItemView */}
        <ExpenseItemView 
          item={item} 
          textColor={textColor} 
          expenseTextColor={expenseTextColor} 
        />

        {/* Toggle Button */}
        <TouchableOpacity onPress={handleToggleExpand} style={styles.toggleButton}>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={iconColor}
          />
        </TouchableOpacity>
      </View>

      {/* Большая плашка редактирования (Edit Component) */}
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
    </Animated.View>
  );
});

// Добавление displayName для отладки
ExpenseItem.displayName = 'ExpenseItem';


// --- Основной Компонент Приложения ---

export default function App(): JSX.Element {
  const [expenses, setExpenses] = useState<Expense[]>([
    { id: '1', name: 'Сыр', price: 5.50, category: 'Ingridients' },
    { id: '2', name: 'Мюллер брауни', price: 3.95, category: 'Sweets' },
    { id: '3', name: 'Сигареты', price: 10.00, category: 'Habbits' },
    { id: '4', name: 'Макдональдс', price: 15.00, category: 'Happiness' },
  ]);

  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(false);
  const animValue = useRef(new Animated.Value(0)).current;

  const [isEditMode, setIsEditMode] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // --- Логика темы ---
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedTheme !== null) {
          setIsDarkTheme(savedTheme === 'dark');
        } else {
          const colorScheme = Appearance.getColorScheme();
          setIsDarkTheme(colorScheme === 'dark');
        }
      } catch (e) {
        console.log('Ошибка загрузки темы:', e);
      }
    };
    loadTheme();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, isDarkTheme ? 'dark' : 'light');
    Animated.timing(animValue, {
      toValue: isDarkTheme ? 1 : 0,
      duration: TRANSITION_DURATION,
      useNativeDriver: false,
    }).start();
  }, [isDarkTheme]);
  // --- Конец логики темы ---

  // Интерполяция стилей
  const backgroundColor = animValue.interpolate({ inputRange: [0, 1], outputRange: ['#F5F5F5', '#161616FF'] });
  const headerColor = animValue.interpolate({ inputRange: [0, 1], outputRange: ['#FFF', '#222'] });
  const textColor = animValue.interpolate({ inputRange: [0, 1], outputRange: ['#000', '#FFF'] });
  const expenseTextColor = animValue.interpolate({ inputRange: [0, 1], outputRange: ['#555', '#CCC'] });

  const toggleTheme = (): void => setIsDarkTheme(!isDarkTheme);

  // --- Функции управления расходами ---

  const handleSaveExpense = useCallback((updatedExpense: Expense) => {
    setExpenses(prev =>
        prev.map(exp => (exp.id === updatedExpense.id ? updatedExpense : exp))
    );
    setExpandedItemId(null);
  }, []);

  const handleDeleteExpense = useCallback((id: string) => {
    setExpenses(prev => prev.filter(exp => exp.id !== id));
    setExpandedItemId(null);
  }, []);

  const handleAddManual = () => console.log('Добавить расход вручную');
  const handleAddCamera = () => console.log('Добавить расход с камеры');

  // --- Функция переключения режима редактирования ---

  const handleEditModeToggle = useCallback(() => {
    setIsEditMode(prev => {
      if (prev) {
        setExpandedItemId(null);
      }
      return !prev;
    });
  }, []);

  // --- Компонент расхода в списке ---

  const renderExpense = useCallback(({ item }: { item: Expense }): JSX.Element => {
    return (
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
    );
  }, [
    isEditMode, 
    isDarkTheme, 
    expandedItemId, 
    handleSaveExpense, 
    handleDeleteExpense, 
    textColor, 
    expenseTextColor
  ]);


  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDarkTheme ? '#161616FF' : '#F5F5F5' }}>
      <StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} />
      <Animated.View style={{ flex: 1, backgroundColor }}>

        {/* Хедер */}
        <Animated.View style={[styles.header, { backgroundColor: headerColor }]}>
          <TouchableOpacity>
            <Ionicons name="menu" size={28} color={isDarkTheme ? '#FFF' : '#000'} />
          </TouchableOpacity>
          <Animated.Text style={[styles.title, { color: textColor as any }]}>Spento</Animated.Text>
          <TouchableOpacity onPress={toggleTheme}>
            <Ionicons name={isDarkTheme ? 'sunny' : 'moon'} size={28} color={PRIMARY_COLOR} />
          </TouchableOpacity>
        </Animated.View>

        {/* Список расходов */}
        <FlatList
          data={expenses}
          keyExtractor={(item) => item.id}
          renderItem={renderExpense}
          style={styles.list}
          keyboardDismissMode="interactive"
        />

        {/* Нижняя панель с ПЕРЕИСПОЛЬЗУЕМЫМИ КНОПКАМИ */}
        <View style={styles.buttonRow}>
          
          <CircleButton
            iconName={isEditMode ? "close" : "pencil"}
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
            onPress={handleAddManual}
          />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

// --- Стили ---

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 3,
  },
  title: { fontSize: 20, fontWeight: 'bold' },
  list: { flex: 1, padding: 16 },
  expenseItem: {
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 1,
  },
  expenseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12, 
  },
  expenseName: { fontSize: 16, fontWeight: '500' },
  expenseDetails: { fontSize: 14 },
  toggleButton: {
    padding: 8,
  },
  inlineEditContainer: {
    paddingBottom: 4, 
    borderTopWidth: 1,
    borderTopColor: '#33333333',
    paddingTop: 8,
  },
  inlineLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
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
  saveButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
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
    flex: 1,
    flexDirection: 'row',
    padding: 16,
    marginHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: '#FFF', fontWeight: 'bold' },
});