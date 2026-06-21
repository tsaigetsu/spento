import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Alert,
  Animated,
  Image,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { loadUser, saveUser, clearUser, type AuthUser } from '@/lib/data';
import { dbUpdateUser } from '@/lib/db';

const PRIMARY = '#9644D8';
const DANGER = '#FF3B30';
const THEME_KEY = 'SPENTO_THEME';

// --- FieldRow ---

interface FieldRowProps {
  label: string;
  value: string;
  editable: boolean;
  isDarkTheme: boolean;
  onChangeText?: (t: string) => void;
  keyboardType?: 'default' | 'email-address' | 'decimal-pad' | 'number-pad';
  placeholder?: string;
  hint?: string;
  suffix?: string;
}

const FieldRow: React.FC<FieldRowProps> = ({
  label, value, editable, isDarkTheme, onChangeText,
  keyboardType = 'default', placeholder, hint, suffix,
}) => {
  const textColor = isDarkTheme ? '#FFF' : '#000';
  const subColor = isDarkTheme ? '#8E8E93' : '#6C6C70';
  const inputBg = isDarkTheme ? '#2C2C2E' : '#F2F2F7';
  return (
    <View style={fr.row}>
      <Text style={[fr.label, { color: subColor }]}>{label}</Text>
      {editable ? (
        <View style={fr.inputWrap}>
          <TextInput
            style={[fr.input, { backgroundColor: inputBg, color: textColor }]}
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            placeholder={placeholder}
            placeholderTextColor={subColor}
          />
          {suffix ? <Text style={[fr.suffix, { color: subColor }]}>{suffix}</Text> : null}
        </View>
      ) : (
        <Text style={[fr.value, { color: textColor }]}>{value || '—'}</Text>
      )}
      {hint ? <Text style={[fr.hint, { color: subColor }]}>{hint}</Text> : null}
    </View>
  );
};

const fr = StyleSheet.create({
  row: { marginBottom: 4 },
  label: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  value: { fontSize: 16, paddingVertical: 2 },
  inputWrap: { position: 'relative' },
  input: { borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15 },
  suffix: { position: 'absolute', right: 13, top: 13, fontSize: 14 },
  hint: { fontSize: 11, marginTop: 4 },
});

// --- ToggleRow ---

interface ToggleRowProps {
  label: string;
  value: boolean;
  editable: boolean;
  isDarkTheme: boolean;
  onChange?: (v: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, value, editable, isDarkTheme, onChange }) => {
  const textColor = isDarkTheme ? '#BBB' : '#333';
  return (
    <TouchableOpacity
      style={tr.row}
      onPress={() => editable && onChange?.(!value)}
      activeOpacity={editable ? 0.7 : 1}
    >
      <View style={[tr.box, value && { backgroundColor: PRIMARY, borderColor: PRIMARY }]}>
        {value && <Ionicons name="checkmark" size={13} color="#FFF" />}
      </View>
      <Text style={[tr.label, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
};

const tr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#444', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14 },
});

// --- Section ---

interface SectionProps { title: string; isDarkTheme: boolean; children: React.ReactNode }

const Section: React.FC<SectionProps> = ({ title, isDarkTheme, children }) => (
  <View style={[sec.card, { backgroundColor: isDarkTheme ? '#222' : '#FFF' }]}>
    <Text style={[sec.title, { color: isDarkTheme ? '#8E8E93' : '#6C6C70' }]}>{title}</Text>
    {children}
  </View>
);

const sec = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, marginBottom: 16, gap: 12 },
  title: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
});

// --- Main ProfileScreen ---

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nick, setNick] = useState('');
  const [showNick, setShowNick] = useState(false);
  const [birthDate, setBirthDate] = useState('');
  const [budget, setBudget] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState('');
  const [language, setLanguage] = useState('');

  const editBtnScale = useRef(new Animated.Value(1)).current;

  const populateFields = useCallback((u: AuthUser) => {
    setUser(u);
    setFirstName(u.firstName);
    setLastName(u.lastName);
    setNick(u.nick);
    setShowNick(u.showNick);
    setBirthDate(u.birthDate);
    setBudget(String(u.budget ?? ''));
    setPhotoUri(u.photoUri);
    setCountry(u.country);
    setCurrency(u.currency);
    setLanguage(u.language);
  }, []);

  useEffect(() => {
    const load = async () => {
      const [u, theme] = await Promise.all([loadUser(), AsyncStorage.getItem(THEME_KEY)]);
      setIsDarkTheme(theme === 'dark');
      if (u) populateFields(u);
    };
    load();
  }, [populateFields]);

  const handleSave = async () => {
    if (!user) return;
    if (nick.trim().length < 3) { Alert.alert('Ошибка', 'Ник — минимум 3 символа.'); return; }
    if (!firstName.trim() || !lastName.trim()) { Alert.alert('Ошибка', 'Введите имя и фамилию.'); return; }
    setSaving(true);
    const updated: AuthUser = {
      ...user,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      nick: nick.trim(),
      showNick,
      birthDate,
      budget: parseFloat(budget) || user.budget,
      photoUri,
      country,
      currency,
      language,
    };
    await saveUser(updated);
    if (user.mongoId) {
      dbUpdateUser(user.mongoId, updated);
    }
    setUser(updated);
    setIsEditing(false);
    setSaving(false);
    Alert.alert('Сохранено', 'Профиль обновлён.');
  };

  const handleCancel = () => {
    if (user) populateFields(user);
    setIsEditing(false);
  };

  const handlePickPhoto = async (source: 'camera' | 'gallery') => {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true, aspect: [1, 1] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const handleLogout = () => {
    Alert.alert('Выход', 'Вы уверены, что хотите выйти?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: async () => {
          await clearUser();
          router.replace('/welcome' as never);
        },
      },
    ]);
  };

  const animateEditBtn = () =>
    Animated.sequence([
      Animated.spring(editBtnScale, { toValue: 0.9, useNativeDriver: true, tension: 400 }),
      Animated.spring(editBtnScale, { toValue: 1, useNativeDriver: true, tension: 200 }),
    ]).start();

  const bg = isDarkTheme ? '#161616' : '#F5F5F5';
  const textColor = isDarkTheme ? '#FFF' : '#000';
  const subColor = isDarkTheme ? '#8E8E93' : '#6C6C70';
  const headerBg = isDarkTheme ? '#222' : '#FFF';

  const displayName = user
    ? user.showNick ? `@${user.nick}` : `${user.firstName} ${user.lastName}`
    : '';
  const avatarChar = user?.nick?.[0]?.toUpperCase() ?? '?';
  const memberSince = user?.loginTimestamp
    ? new Date(user.loginTimestamp).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long' })
    : '';

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
        <StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>

        {/* Header with back arrow */}
        <View style={[ps.header, { backgroundColor: headerBg }]}>
          <TouchableOpacity style={ps.backBtn} onPress={() => router.back()} hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={24} color={textColor} />
          </TouchableOpacity>
          <Text style={[ps.title, { color: textColor }]}>Профиль</Text>
          <TouchableOpacity
            onPress={() => { animateEditBtn(); isEditing ? handleCancel() : setIsEditing(true); }}
            activeOpacity={1}
          >
            <Animated.View style={{ transform: [{ scale: editBtnScale }] }}>
              <Text style={[ps.editBtn, { color: isEditing ? DANGER : PRIMARY }]}>
                {isEditing ? 'Отмена' : 'Изменить'}
              </Text>
            </Animated.View>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={ps.scroll}
          contentContainerStyle={ps.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar section */}
          <View style={ps.avatarSection}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={ps.avatar} />
            ) : (
              <View style={[ps.avatar, { backgroundColor: PRIMARY }]}>
                <Text style={ps.avatarChar}>{avatarChar}</Text>
              </View>
            )}
            {isEditing && (
              <View style={ps.photoRow}>
                <TouchableOpacity style={ps.photoBtn} onPress={() => handlePickPhoto('camera')}>
                  <Ionicons name="camera-outline" size={16} color={PRIMARY} />
                  <Text style={[ps.photoBtnText, { color: PRIMARY }]}>Камера</Text>
                </TouchableOpacity>
                <TouchableOpacity style={ps.photoBtn} onPress={() => handlePickPhoto('gallery')}>
                  <Ionicons name="image-outline" size={16} color={PRIMARY} />
                  <Text style={[ps.photoBtnText, { color: PRIMARY }]}>Галерея</Text>
                </TouchableOpacity>
                {photoUri && (
                  <TouchableOpacity style={ps.photoBtn} onPress={() => setPhotoUri(null)}>
                    <Ionicons name="close-outline" size={16} color={DANGER} />
                    <Text style={[ps.photoBtnText, { color: DANGER }]}>Убрать</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            <Text style={[ps.displayName, { color: textColor }]}>{displayName}</Text>
            <Text style={[ps.email, { color: subColor }]}>{user.email}</Text>
            <Text style={[ps.memberSince, { color: subColor }]}>С нами с {memberSince}</Text>
          </View>

          {/* Personal info */}
          <Section title="Личная информация" isDarkTheme={isDarkTheme}>
            <FieldRow label="Имя" value={firstName} editable={isEditing} isDarkTheme={isDarkTheme} onChangeText={setFirstName} />
            <FieldRow label="Фамилия" value={lastName} editable={isEditing} isDarkTheme={isDarkTheme} onChangeText={setLastName} />
            <FieldRow
              label="Ник"
              value={nick}
              editable={isEditing}
              isDarkTheme={isDarkTheme}
              onChangeText={t => setNick(t.replace(/[^a-zA-Z0-9_]/g, ''))}
            />
            <ToggleRow
              label="Показывать ник вместо имени"
              value={showNick}
              editable={isEditing}
              isDarkTheme={isDarkTheme}
              onChange={setShowNick}
            />
            <FieldRow
              label="Дата рождения"
              value={birthDate}
              editable={isEditing}
              isDarkTheme={isDarkTheme}
              onChangeText={setBirthDate}
              placeholder="ДД.ММ.ГГГГ"
            />
          </Section>

          {/* Finance */}
          <Section title="Финансы" isDarkTheme={isDarkTheme}>
            <FieldRow
              label="Месячный бюджет"
              value={budget}
              editable={isEditing}
              isDarkTheme={isDarkTheme}
              onChangeText={t => setBudget(t.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              suffix="zł"
              hint="Используется для расчёта прогресса трат"
            />
          </Section>

          {/* Preferences */}
          <Section title="Настройки" isDarkTheme={isDarkTheme}>
            <FieldRow label="Страна" value={country} editable={isEditing} isDarkTheme={isDarkTheme} onChangeText={setCountry} />
            <FieldRow label="Валюта" value={currency} editable={isEditing} isDarkTheme={isDarkTheme} onChangeText={setCurrency} />
            <FieldRow label="Язык" value={language} editable={isEditing} isDarkTheme={isDarkTheme} onChangeText={setLanguage} />
          </Section>

          {/* Save button */}
          {isEditing && (
            <TouchableOpacity
              style={[ps.saveBtn, { opacity: saving ? 0.7 : 1 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={ps.saveBtnText}>{saving ? 'Сохранение...' : 'Сохранить изменения'}</Text>
            </TouchableOpacity>
          )}

          {/* Logout */}
          <TouchableOpacity style={ps.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color={DANGER} />
            <Text style={ps.logoutText}>Выйти из аккаунта</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const ps = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  backBtn: { marginRight: 12 },
  title: { flex: 1, fontSize: 20, fontWeight: 'bold' },
  editBtn: { fontSize: 15, fontWeight: '600', paddingLeft: 8 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },

  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarChar: { color: '#FFF', fontSize: 36, fontWeight: '700' },
  photoRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(150,68,216,0.1)',
  },
  photoBtnText: { fontSize: 12, fontWeight: '500' },
  displayName: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  email: { fontSize: 14 },
  memberSince: { fontSize: 12, marginTop: 2 },

  saveBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${DANGER}40`,
    marginBottom: 8,
  },
  logoutText: { color: DANGER, fontSize: 15, fontWeight: '600' },
});
