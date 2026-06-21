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
import { ADMIN_USER, saveUser, type AuthUser } from '@/lib/data';
import { dbFindUser } from '@/lib/db';

const PRIMARY = '#9644D8';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const btnScale = useRef(new Animated.Value(1)).current;

  const isValid = email.includes('@') && password.length >= 1;

  const handleLogin = async () => {
    if (!loading) {
      Animated.sequence([
        Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, tension: 400 }),
        Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, tension: 200 }),
      ]).start();
    }
    if (!isValid || loading) return;
    setLoading(true);

    try {
      // Admin shortcut
      if (email.trim().toLowerCase() === 'admin@spento.app' && password === 'admin') {
        const adminUser: AuthUser = { ...ADMIN_USER, loginTimestamp: Date.now() };
        await saveUser(adminUser);
        router.replace('/splash' as never);
        return;
      }

      // Try MongoDB
      const dbUser = await dbFindUser(email.trim().toLowerCase(), password);
      if (dbUser) {
        await saveUser({ ...dbUser, loginTimestamp: Date.now() });
        router.replace(dbUser.quizDone ? ('/(tabs)/explore' as never) : ('/quiz' as never));
        return;
      }

      // Fallback: simple local check (admin:admin nick)
      if (email.trim() === 'admin' && password === 'admin') {
        const adminUser: AuthUser = { ...ADMIN_USER, loginTimestamp: Date.now() };
        await saveUser(adminUser);
        router.replace('/splash' as never);
        return;
      }

      Alert.alert('Ошибка', 'Неверный email или пароль.');
    } catch {
      Alert.alert('Ошибка', 'Не удалось войти. Проверьте подключение к интернету.');
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

          <View style={s.hero}>
            <Text style={s.title}>Добро пожаловать</Text>
            <Text style={s.subtitle}>Войдите в свой аккаунт</Text>
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

            <Text style={s.label}>Пароль</Text>
            <View style={s.pwdRow}>
              <TextInput
                style={s.pwdInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Ваш пароль"
                placeholderTextColor="#555"
                secureTextEntry={!showPwd}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={s.eyeBtn}>
                <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.forgotBtn} onPress={() => Alert.alert('Скоро', 'Восстановление пароля будет доступно в следующем обновлении.')}>
              <Text style={s.forgotText}>Забыли пароль?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleLogin}
              onPressIn={() => Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, tension: 400 }).start()}
              onPressOut={() => Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, tension: 200 }).start()}
              activeOpacity={1}
              disabled={!isValid || loading}
            >
              <Animated.View style={[s.submitBtn, { opacity: isValid ? 1 : 0.4, transform: [{ scale: btnScale }] }]}>
                <Text style={s.submitText}>{loading ? 'Входим...' : 'Войти'}</Text>
              </Animated.View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.switchLink} onPress={() => router.replace('/signup-credentials' as never)}>
            <Text style={s.switchText}>
              Нет аккаунта?{' '}
              <Text style={{ color: PRIMARY }}>Зарегистрироваться</Text>
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
  hero: { paddingVertical: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#FFF' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },

  card: { backgroundColor: '#1A1A1A', borderRadius: 20, padding: 20 },
  label: { fontSize: 12, fontWeight: '500', color: '#777', marginTop: 16, marginBottom: 6 },
  input: {
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 13,
    fontSize: 15,
    color: '#FFF',
  },
  pwdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 4,
  },
  pwdInput: { flex: 1, fontSize: 15, color: '#FFF', paddingVertical: 9 },
  eyeBtn: { padding: 6 },
  forgotBtn: { alignSelf: 'flex-end', marginTop: 10, marginBottom: 4 },
  forgotText: { fontSize: 13, color: PRIMARY },
  submitBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  submitText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  switchLink: { alignItems: 'center', marginTop: 24 },
  switchText: { color: '#666', fontSize: 14 },
});
