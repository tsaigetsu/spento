import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadUser, saveUser } from '@/lib/data';

const PRIMARY = '#9644D8';

const OPTIONS = {
  country: ['Польша', 'Германия', 'Украина', 'США', 'Великобритания', 'Франция', 'Испания', 'Италия', 'Другая'],
  currency: ['PLN (zł)', 'EUR (€)', 'USD ($)', 'UAH (₴)', 'GBP (£)'],
  language: ['Русский', 'Польский', 'English', 'Deutsch', 'Français'],
};

type PickerKey = keyof typeof OPTIONS;

interface SelectFieldProps {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
}

const SelectField: React.FC<SelectFieldProps> = ({ label, value, placeholder, onPress }) => (
  <View style={sf.wrapper}>
    <Text style={sf.label}>{label}</Text>
    <TouchableOpacity style={sf.field} onPress={onPress}>
      <Text style={[sf.fieldText, !value && sf.placeholder]}>
        {value || placeholder}
      </Text>
      <Ionicons name="chevron-down" size={18} color="#666" />
    </TouchableOpacity>
  </View>
);

const sf = StyleSheet.create({
  wrapper: { marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '500', color: '#777', marginBottom: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  fieldText: { fontSize: 15, color: '#FFF' },
  placeholder: { color: '#555' },
});

export default function QuizScreen() {
  const router = useRouter();

  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState('');
  const [language, setLanguage] = useState('');
  const [picker, setPicker] = useState<PickerKey | null>(null);

  const canProceed = !!country && !!currency && !!language;

  const currentValues: Record<PickerKey, string> = { country, currency, language };
  const setters: Record<PickerKey, (v: string) => void> = {
    country: setCountry,
    currency: setCurrency,
    language: setLanguage,
  };

  const handleSelect = (value: string) => {
    if (picker) setters[picker](value);
    setPicker(null);
  };

  const handleStart = async () => {
    if (!canProceed) return;
    const user = await loadUser();
    if (user) {
      await saveUser({ ...user, country, currency, language, quizDone: true });
    }
    router.replace('/(tabs)/explore' as never);
  };

  const pickerLabels: Record<PickerKey, string> = {
    country: 'Выберите страну',
    currency: 'Выберите валюту',
    language: 'Выберите язык',
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.hero}>
          <View style={s.stepDots}>
            {[0, 1, 2].map(i => (
              <View key={i} style={[s.dot, i === 0 && s.dotActive]} />
            ))}
          </View>
          <Text style={s.title}>Настроим всё для вас</Text>
          <Text style={s.subtitle}>Выберите предпочтения — их можно изменить позже в профиле.</Text>
        </View>

        {/* Selectors */}
        <View style={s.card}>
          <SelectField
            label="Страна"
            value={country}
            placeholder="Выберите страну"
            onPress={() => setPicker('country')}
          />
          <SelectField
            label="Валюта"
            value={currency}
            placeholder="Выберите валюту"
            onPress={() => setPicker('currency')}
          />
          <SelectField
            label="Язык приложения"
            value={language}
            placeholder="Выберите язык"
            onPress={() => setPicker('language')}
          />
        </View>

        <Text style={s.hint}>
          Эти настройки пока являются заглушками и будут влиять на интерфейс в будущих обновлениях.
        </Text>

        {/* Start button */}
        <TouchableOpacity
          style={[s.startBtn, { opacity: canProceed ? 1 : 0.4 }]}
          onPress={handleStart}
          disabled={!canProceed}
        >
          <Text style={s.startText}>Начать</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </ScrollView>

      {/* Picker modal */}
      <Modal
        visible={picker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(null)}
      >
        <TouchableOpacity
          style={m.overlay}
          activeOpacity={1}
          onPress={() => setPicker(null)}
        />
        <View style={m.sheet}>
          <View style={m.handle} />
          <Text style={m.sheetTitle}>{picker ? pickerLabels[picker] : ''}</Text>
          <FlatList
            data={picker ? OPTIONS[picker] : []}
            keyExtractor={item => item}
            renderItem={({ item }) => {
              const isSelected = picker ? currentValues[picker] === item : false;
              return (
                <TouchableOpacity
                  style={[m.option, isSelected && m.optionSelected]}
                  onPress={() => handleSelect(item)}
                >
                  <Text style={[m.optionText, isSelected && { color: PRIMARY }]}>{item}</Text>
                  {isSelected && <Ionicons name="checkmark" size={18} color={PRIMARY} />}
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={m.sep} />}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F0F0F' },
  scroll: { flexGrow: 1, padding: 24, paddingBottom: 40 },

  hero: { alignItems: 'center', paddingVertical: 32 },
  stepDots: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#333' },
  dotActive: { backgroundColor: PRIMARY, width: 24 },
  title: { fontSize: 26, fontWeight: '800', color: '#FFF', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8, lineHeight: 20 },

  card: { backgroundColor: '#1A1A1A', borderRadius: 20, padding: 20, gap: 12 },

  hint: { fontSize: 12, color: '#444', textAlign: 'center', marginTop: 16, lineHeight: 18 },

  startBtn: {
    flexDirection: 'row',
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  startText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
});

const m = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '60%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#444',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  optionSelected: { backgroundColor: '#2C2C2E' },
  optionText: { fontSize: 16, color: '#CCC' },
  sep: { height: 1, backgroundColor: '#2C2C2E', marginHorizontal: 20 },
});
