import React, { useState } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type AuthUser, USER_KEY, ADMIN_USER, saveUser } from '@/lib/data';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PRIMARY = '#9644D8';

export default function RegisterScreen() {
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nick, setNick] = useState('');
  const [showNick, setShowNick] = useState(false);
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const isAdmin = nick.trim() === 'admin' && password === 'admin';

  const isValid = isAdmin || (
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    nick.trim().length >= 3 &&
    birthDate.length === 10 &&
    password.length >= 6 &&
    password === confirmPassword
  );

  const handleRegister = async () => {
    if (!isValid) {
      let msg = 'Заполните все поля.';
      if (!firstName.trim() || !lastName.trim()) msg = 'Введите имя и фамилию.';
      else if (nick.trim().length < 3) msg = 'Ник — минимум 3 символа.';
      else if (birthDate.length < 10) msg = 'Введите дату в формате ДД.ММ.ГГГГ.';
      else if (password.length < 6) msg = 'Пароль — минимум 6 символов.';
      else if (password !== confirmPassword) msg = 'Пароли не совпадают.';
      Alert.alert('Ошибка', msg);
      return;
    }

    const user: AuthUser = isAdmin
      ? ADMIN_USER
      : {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          nick: nick.trim(),
          showNick,
          birthDate,
          quizDone: false,
          country: '',
          currency: '',
          language: '',
        };

    await saveUser(user);
    router.replace(user.quizDone ? ('/(tabs)/explore' as never) : ('/quiz' as never));
  };

  const formatDate = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
  };

  const passwordsMatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={s.hero}>
            <View style={s.logoBox}>
              <Ionicons name="wallet-outline" size={36} color="#FFF" />
            </View>
            <Text style={s.appName}>Spento</Text>
            <Text style={s.tagline}>Твои траты. Твои данные.</Text>
          </View>

          {/* Form */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Создать аккаунт</Text>

            {/* Name row */}
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Имя</Text>
                <TextInput
                  style={s.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Иван"
                  placeholderTextColor="#555"
                  returnKeyType="next"
                />
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Фамилия</Text>
                <TextInput
                  style={s.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Иванов"
                  placeholderTextColor="#555"
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Nick */}
            <Text style={s.label}>Ник</Text>
            <TextInput
              style={s.input}
              value={nick}
              onChangeText={t => setNick(t.replace(/[^a-zA-Z0-9_]/g, ''))}
              placeholder="ivan_99"
              placeholderTextColor="#555"
              autoCapitalize="none"
              returnKeyType="next"
            />

            {/* Show nick toggle */}
            <TouchableOpacity style={s.checkRow} onPress={() => setShowNick(v => !v)}>
              <View style={[s.checkbox, showNick && { backgroundColor: PRIMARY, borderColor: PRIMARY }]}>
                {showNick && <Ionicons name="checkmark" size={13} color="#FFF" />}
              </View>
              <Text style={s.checkLabel}>Отображать ник вместо имени</Text>
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

            {/* Password */}
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

            {/* Confirm password */}
            <Text style={s.label}>Повторить пароль</Text>
            <View style={[s.pwdRow, passwordsMatch && { borderWidth: 1, borderColor: '#FF5722', borderRadius: 10 }]}>
              <TextInput
                style={s.pwdInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Повторите пароль"
                placeholderTextColor="#555"
                secureTextEntry={!showConfirmPwd}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
              <TouchableOpacity onPress={() => setShowConfirmPwd(v => !v)} style={s.eyeBtn}>
                <Ionicons name={showConfirmPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color="#666" />
              </TouchableOpacity>
            </View>
            {passwordsMatch && (
              <Text style={s.errorText}>Пароли не совпадают</Text>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[s.submitBtn, { opacity: isValid ? 1 : 0.45 }]}
              onPress={handleRegister}
            >
              <Text style={s.submitText}>Создать аккаунт</Text>
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

  hero: { alignItems: 'center', paddingVertical: 28 },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  appName: { fontSize: 30, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: '#666', marginTop: 4 },

  card: { backgroundColor: '#1A1A1A', borderRadius: 20, padding: 20 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#FFF', marginBottom: 16 },

  row: { flexDirection: 'row' },
  label: { fontSize: 12, fontWeight: '500', color: '#777', marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: '#FFF',
  },

  checkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkLabel: { fontSize: 14, color: '#BBB', flex: 1 },

  pwdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  pwdInput: { flex: 1, fontSize: 15, color: '#FFF', paddingVertical: 9 },
  eyeBtn: { padding: 6 },

  errorText: { color: '#FF5722', fontSize: 12, marginTop: 4, marginLeft: 2 },

  submitBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  submitText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
