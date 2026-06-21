import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveUser, type AuthUser } from '@/lib/data';
import { dbCreateUser } from '@/lib/db';
import { PENDING_CREDS_KEY } from './signup-credentials';

const PRIMARY = '#9644D8';

export default function SignupProfileScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nick, setNick] = useState('');
  const [showNick, setShowNick] = useState(false);
  const [birthDate, setBirthDate] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(false);
  const btnScale = useRef(new Animated.Value(1)).current;

  const isValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    nick.trim().length >= 3 &&
    birthDate.length === 10 &&
    parseFloat(budget) > 0;

  const formatDate = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
  };

  const pickPhoto = async (source: 'camera' | 'gallery') => {
    const permResult = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) {
      Alert.alert('Нет доступа', `Разрешите доступ к ${source === 'camera' ? 'камере' : 'галерее'} в настройках.`);
      return;
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true, aspect: [1, 1] })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleNext = async () => {
    if (!isValid || loading) return;
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.95, useNativeDriver: true, tension: 400 }),
      Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, tension: 200 }),
    ]).start();
    setLoading(true);
    try {
      const creds = await AsyncStorage.getItem(PENDING_CREDS_KEY);
      const { email, password } = creds ? JSON.parse(creds) : { email: '', password: '' };

      const user: AuthUser = {
        email,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        nick: nick.trim(),
        showNick,
        birthDate,
        photoUri,
        budget: parseFloat(budget),
        quizDone: false,
        country: '',
        currency: '',
        language: '',
        loginTimestamp: Date.now(),
      };

      // Save locally first so the app doesn't block on network
      await saveUser(user);
      await AsyncStorage.removeItem(PENDING_CREDS_KEY);

      // Sync to MongoDB, then store the returned mongoId
      dbCreateUser(user, password).then(mongoId => {
        if (mongoId) saveUser({ ...user, mongoId });
      }).catch(() => {});

      // Redirect to email verification
      router.push('/verify-email' as never);
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось создать аккаунт. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Back */}
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>

          {/* Step indicator */}
          <View style={s.steps}>
            {[1, 2, 3].map(i => (
              <View key={i} style={[s.step, i === 2 && s.stepActive, i < 2 && s.stepDone]}>
                {i < 2
                  ? <Ionicons name="checkmark" size={14} color="#FFF" />
                  : <Text style={[s.stepNum, i === 2 && s.stepNumActive]}>{i}</Text>
                }
              </View>
            ))}
          </View>

          <View style={s.hero}>
            <Text style={s.title}>О вас</Text>
            <Text style={s.subtitle}>Шаг 2 из 3 — Личные данные</Text>
          </View>

          {/* Photo picker */}
          <View style={s.photoSection}>
            <View style={s.avatarWrap}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={s.avatarImg} />
              ) : (
                <View style={[s.avatarImg, { backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="person" size={40} color="#555" />
                </View>
              )}
            </View>
            <View style={s.photoButtons}>
              <TouchableOpacity style={s.photoBtn} onPress={() => pickPhoto('camera')}>
                <Ionicons name="camera-outline" size={18} color={PRIMARY} />
                <Text style={s.photoBtnText}>Камера</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.photoBtn} onPress={() => pickPhoto('gallery')}>
                <Ionicons name="image-outline" size={18} color={PRIMARY} />
                <Text style={s.photoBtnText}>Галерея</Text>
              </TouchableOpacity>
              {photoUri && (
                <TouchableOpacity style={s.photoBtn} onPress={() => setPhotoUri(null)}>
                  <Ionicons name="close-outline" size={18} color="#FF5722" />
                  <Text style={[s.photoBtnText, { color: '#FF5722' }]}>Убрать</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={s.card}>
            {/* Name row */}
            <View style={s.nameRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Имя</Text>
                <TextInput style={s.input} value={firstName} onChangeText={setFirstName} placeholder="Иван" placeholderTextColor="#555" returnKeyType="next" />
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Фамилия</Text>
                <TextInput style={s.input} value={lastName} onChangeText={setLastName} placeholder="Иванов" placeholderTextColor="#555" returnKeyType="next" />
              </View>
            </View>

            {/* Nick */}
            <Text style={s.label}>Ник</Text>
            <TextInput
              style={s.input}
              value={nick}
              onChangeText={t => setNick(t.replace(/[^a-zA-Z0-9_]/g, ''))}
              placeholder="ivan_99 (мин. 3 символа)"
              placeholderTextColor="#555"
              autoCapitalize="none"
              returnKeyType="next"
            />
            {nick.length > 0 && nick.length < 3 && (
              <Text style={s.errorText}>Минимум 3 символа</Text>
            )}

            {/* Show nick toggle */}
            <TouchableOpacity style={s.checkRow} onPress={() => setShowNick(v => !v)}>
              <View style={[s.checkbox, showNick && { backgroundColor: PRIMARY, borderColor: PRIMARY }]}>
                {showNick && <Ionicons name="checkmark" size={13} color="#FFF" />}
              </View>
              <Text style={s.checkLabel}>Показывать ник вместо имени</Text>
            </TouchableOpacity>

            {/* Birth date */}
            <Text style={s.label}>Дата рождения</Text>
            <TextInput
              style={s.input}
              value={birthDate}
              onChangeText={t => setBirthDate(formatDate(t))}
              placeholder="ДД.ММ.ГГГГ"
              placeholderTextColor="#555"
              keyboardType="number-pad"
              maxLength={10}
              returnKeyType="next"
            />

            {/* Budget */}
            <Text style={s.label}>Месячный бюджет (zł)</Text>
            <TextInput
              style={s.input}
              value={budget}
              onChangeText={t => setBudget(t.replace(/[^0-9.]/g, ''))}
              placeholder="Например: 3000"
              placeholderTextColor="#555"
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
            <Text style={s.hint}>Это поможет отслеживать, сколько вы тратите от бюджета</Text>

            <TouchableOpacity
              onPress={handleNext}
              onPressIn={() => Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, tension: 400 }).start()}
              onPressOut={() => Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, tension: 200 }).start()}
              activeOpacity={1}
              disabled={!isValid || loading}
            >
              <Animated.View style={[s.nextBtn, { opacity: isValid ? 1 : 0.4, transform: [{ scale: btnScale }] }]}>
                <Text style={s.nextText}>{loading ? 'Создаём...' : 'Продолжить'}</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginLeft: 8 }} />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F0F0F' },
  scroll: { flexGrow: 1, padding: 24, paddingBottom: 40 },
  backBtn: { marginBottom: 8, padding: 4, alignSelf: 'flex-start' },

  steps: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  step: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' },
  stepActive: { backgroundColor: PRIMARY },
  stepDone: { backgroundColor: '#4CAF50' },
  stepNum: { fontSize: 12, fontWeight: '700', color: '#666' },
  stepNumActive: { color: '#FFF' },

  hero: { marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#FFF' },
  subtitle: { fontSize: 13, color: '#666', marginTop: 4 },

  photoSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 16 },
  avatarWrap: {
    width: 80, height: 80, borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 2, borderColor: '#2C2C2E',
  },
  avatarImg: { width: 80, height: 80, borderRadius: 40 },
  photoButtons: { flex: 1, gap: 8 },
  photoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1A1A1A', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  photoBtnText: { fontSize: 13, color: PRIMARY, fontWeight: '500' },

  card: { backgroundColor: '#1A1A1A', borderRadius: 20, padding: 20 },
  nameRow: { flexDirection: 'row' },
  label: { fontSize: 12, fontWeight: '500', color: '#777', marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: '#2C2C2E', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15, color: '#FFF' },
  errorText: { color: '#FF5722', fontSize: 12, marginTop: 4 },
  hint: { fontSize: 11, color: '#555', marginTop: 6 },

  checkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#444', alignItems: 'center', justifyContent: 'center' },
  checkLabel: { fontSize: 14, color: '#BBB', flex: 1 },

  nextBtn: {
    backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: 24,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  nextText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
