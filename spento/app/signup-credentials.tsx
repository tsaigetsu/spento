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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PRIMARY = '#9644D8';
export const PENDING_CREDS_KEY = 'SPENTO_PENDING_CREDS';

export default function SignupCredentialsScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const btnScale = useRef(new Animated.Value(1)).current;

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const pwdValid = password.length >= 6;
  const pwdMatch = password === confirmPassword && confirmPassword.length > 0;
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const canProceed = emailValid && pwdValid && pwdMatch;

  const handleNext = async () => {
    if (!canProceed) {
      if (!emailValid) { Alert.alert('Ошибка', 'Введите корректный email.'); return; }
      if (!pwdValid) { Alert.alert('Ошибка', 'Пароль должен быть не менее 6 символов.'); return; }
      if (!pwdMatch) { Alert.alert('Ошибка', 'Пароли не совпадают.'); return; }
    }
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.95, useNativeDriver: true, tension: 400 }),
      Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, tension: 200 }),
    ]).start();
    // Persist credentials for the next step
    await AsyncStorage.setItem(PENDING_CREDS_KEY, JSON.stringify({ email: email.trim().toLowerCase(), password }));
    router.push('/signup-profile' as never);
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
              <View key={i} style={[s.step, i === 1 && s.stepActive, i < 1 && s.stepDone]}>
                <Text style={[s.stepNum, i === 1 && s.stepNumActive]}>{i}</Text>
              </View>
            ))}
          </View>

          <View style={s.hero}>
            <Text style={s.title}>Создать аккаунт</Text>
            <Text style={s.subtitle}>Шаг 1 из 3 — Ваши учётные данные</Text>
          </View>

          <View style={s.card}>
            <Text style={s.label}>Email</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="example@mail.com"
              placeholderTextColor="#555"
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              autoFocus
            />
            {email.length > 0 && !emailValid && (
              <Text style={s.errorText}>Введите корректный email</Text>
            )}

            <Text style={s.label}>Пароль</Text>
            <View style={s.pwdRow}>
              <TextInput
                style={s.pwdInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Минимум 6 символов"
                placeholderTextColor="#555"
                secureTextEntry={!showPwd}
                returnKeyType="next"
              />
              <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={s.eyeBtn}>
                <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={s.label}>Повторить пароль</Text>
            <View style={[s.pwdRow, mismatch && { borderWidth: 1, borderColor: '#FF5722', borderRadius: 10 }]}>
              <TextInput
                style={s.pwdInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Повторите пароль"
                placeholderTextColor="#555"
                secureTextEntry={!showConfirm}
                returnKeyType="done"
                onSubmitEditing={handleNext}
              />
              <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={s.eyeBtn}>
                <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color="#666" />
              </TouchableOpacity>
            </View>
            {mismatch && <Text style={s.errorText}>Пароли не совпадают</Text>}

            <TouchableOpacity
              onPress={handleNext}
              onPressIn={() => Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, tension: 400 }).start()}
              onPressOut={() => Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, tension: 200 }).start()}
              activeOpacity={1}
              disabled={!canProceed}
            >
              <Animated.View style={[s.nextBtn, { opacity: canProceed ? 1 : 0.4, transform: [{ scale: btnScale }] }]}>
                <Text style={s.nextText}>Продолжить</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginLeft: 8 }} />
              </Animated.View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.switchLink} onPress={() => router.replace('/login' as never)}>
            <Text style={s.switchText}>
              Уже есть аккаунт?{' '}
              <Text style={{ color: PRIMARY }}>Войти</Text>
            </Text>
          </TouchableOpacity>
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
  step: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#2C2C2E',
    alignItems: 'center', justifyContent: 'center',
  },
  stepActive: { backgroundColor: PRIMARY },
  stepDone: { backgroundColor: '#4CAF50' },
  stepNum: { fontSize: 12, fontWeight: '700', color: '#666' },
  stepNumActive: { color: '#FFF' },

  hero: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '800', color: '#FFF' },
  subtitle: { fontSize: 13, color: '#666', marginTop: 4 },

  card: { backgroundColor: '#1A1A1A', borderRadius: 20, padding: 20 },
  label: { fontSize: 12, fontWeight: '500', color: '#777', marginTop: 16, marginBottom: 6 },
  input: {
    backgroundColor: '#2C2C2E', borderRadius: 10,
    paddingHorizontal: 13, paddingVertical: 13,
    fontSize: 15, color: '#FFF',
  },
  pwdRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#2C2C2E', borderRadius: 10,
    paddingHorizontal: 13, paddingVertical: 4,
  },
  pwdInput: { flex: 1, fontSize: 15, color: '#FFF', paddingVertical: 9 },
  eyeBtn: { padding: 6 },
  errorText: { color: '#FF5722', fontSize: 12, marginTop: 4 },

  nextBtn: {
    backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
    marginTop: 24,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  nextText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  switchLink: { alignItems: 'center', marginTop: 24 },
  switchText: { color: '#666', fontSize: 14 },
});
