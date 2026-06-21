import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Animated,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadUser } from '@/lib/data';

const PRIMARY = '#9644D8';
const CODE_LENGTH = 6;
const CORRECT_CODE = '111111';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [shake, setShake] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const inputRefs = useRef<Array<TextInput | null>>(Array(CODE_LENGTH).fill(null));
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadUser().then(u => { if (u) setUserEmail(u.email); });
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
  }, []);

  const handleDigit = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const allFilled = digits.every(d => d.length === 1);
  const enteredCode = digits.join('');

  const handleVerify = () => {
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.95, useNativeDriver: true, tension: 400 }),
      Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, tension: 200 }),
    ]).start();

    if (!allFilled) return;

    if (enteredCode !== CORRECT_CODE) {
      triggerShake();
      Alert.alert('Неверный код', 'Введите правильный код подтверждения.\n(Подсказка: 1 1 1 1 1 1)');
      setDigits(Array(CODE_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
      return;
    }

    // Success animation then navigate
    Animated.spring(successAnim, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }).start(() => {
      router.push('/quiz' as never);
    });
  };

  const handleResend = () => {
    Alert.alert('Код отправлен', `Новый код подтверждения отправлен на ${userEmail || 'ваш email'}.\n(Для тестирования используйте: 1 1 1 1 1 1)`);
    setDigits(Array(CODE_LENGTH).fill(''));
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  };

  const successScale = successAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.1, 1] });

  return (
    <SafeAreaView style={s.safe}>
      {/* Back */}
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#FFF" />
      </TouchableOpacity>

      {/* Step indicator */}
      <View style={s.steps}>
        {[1, 2, 3].map(i => (
          <View key={i} style={[s.step, i === 3 && s.stepActive, i < 3 && s.stepDone]}>
            {i < 3
              ? <Ionicons name="checkmark" size={14} color="#FFF" />
              : <Text style={[s.stepNum, s.stepNumActive]}>{i}</Text>
            }
          </View>
        ))}
      </View>

      <View style={s.content}>
        {/* Icon */}
        <Animated.View style={[s.iconWrap, { transform: [{ scale: successScale }] }]}>
          <Ionicons name="mail-outline" size={48} color={PRIMARY} />
        </Animated.View>

        <Text style={s.title}>Подтвердите почту</Text>
        <Text style={s.subtitle}>
          Мы отправили 6-значный код на{'\n'}
          <Text style={{ color: PRIMARY, fontWeight: '600' }}>{userEmail || 'ваш email'}</Text>
        </Text>

        {/* OTP inputs */}
        <Animated.View style={[s.codeRow, { transform: [{ translateX: shakeAnim }] }]}>
          {digits.map((digit, i) => (
            <TextInput
              key={i}
              ref={ref => { inputRefs.current[i] = ref; }}
              style={[
                s.codeBox,
                digit && s.codeBoxFilled,
                i === digits.findIndex(d => !d) && s.codeBoxFocused,
              ]}
              value={digit}
              onChangeText={text => handleDigit(text, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              caretHidden
            />
          ))}
        </Animated.View>

        <Text style={s.hint}>Для тестирования введите: 1 1 1 1 1 1</Text>

        {/* Verify button */}
        <TouchableOpacity
          onPress={handleVerify}
          onPressIn={() => Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, tension: 400 }).start()}
          onPressOut={() => Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, tension: 200 }).start()}
          activeOpacity={1}
          disabled={!allFilled}
        >
          <Animated.View style={[s.verifyBtn, { opacity: allFilled ? 1 : 0.4, transform: [{ scale: btnScale }] }]}>
            <Text style={s.verifyText}>Подтвердить</Text>
          </Animated.View>
        </TouchableOpacity>

        {/* Resend */}
        <TouchableOpacity style={s.resendBtn} onPress={handleResend}>
          <Text style={s.resendText}>Не получили код? </Text>
          <Text style={[s.resendText, { color: PRIMARY }]}>Отправить снова</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F0F0F' },
  backBtn: { padding: 16, alignSelf: 'flex-start' },
  steps: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginBottom: 8 },
  step: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' },
  stepActive: { backgroundColor: PRIMARY },
  stepDone: { backgroundColor: '#4CAF50' },
  stepNum: { fontSize: 12, fontWeight: '700', color: '#666' },
  stepNumActive: { color: '#FFF' },

  content: { flex: 1, alignItems: 'center', paddingHorizontal: 32, paddingTop: 32 },
  iconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1, borderColor: '#2C2C2E',
  },
  title: { fontSize: 24, fontWeight: '800', color: '#FFF', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 36 },

  codeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  codeBox: {
    width: 46,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2C2C2E',
    backgroundColor: '#1A1A1A',
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  codeBoxFilled: { borderColor: PRIMARY, backgroundColor: '#1C1028' },
  codeBoxFocused: { borderColor: PRIMARY },

  hint: { fontSize: 12, color: '#444', marginBottom: 32, textAlign: 'center' },

  verifyBtn: {
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 48,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
    marginBottom: 20,
  },
  verifyText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  resendBtn: { flexDirection: 'row', alignItems: 'center' },
  resendText: { fontSize: 14, color: '#555' },
});
