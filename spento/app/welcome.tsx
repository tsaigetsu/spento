import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const PRIMARY = '#9644D8';

export default function WelcomeScreen() {
  const router = useRouter();

  // Entrance animations
  const logoAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(logoAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 10, delay: 100 }),
      Animated.timing(contentAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
    ]).start();
  }, [logoAnim, contentAnim]);

  const logoScale = logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const logoOpacity = logoAnim;
  const contentTranslate = contentAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] });
  const contentOpacity = contentAnim;

  return (
    <SafeAreaView style={s.safe}>
      {/* Logo section */}
      <Animated.View style={[s.logoSection, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <View style={s.logoBox}>
          <Ionicons name="wallet-outline" size={40} color="#FFF" />
        </View>
        <Text style={s.appName}>Spento</Text>
        <Text style={s.tagline}>Твои траты под контролем</Text>
      </Animated.View>

      {/* Buttons section */}
      <Animated.View style={[s.bottomSection, { opacity: contentOpacity, transform: [{ translateY: contentTranslate }] }]}>
        {/* Sign Up */}
        <AnimatedPressable
          style={s.primaryBtn}
          onPress={() => router.push('/signup-credentials' as never)}
        >
          <Ionicons name="person-add-outline" size={20} color="#FFF" style={s.btnIcon} />
          <Text style={s.primaryBtnText}>Создать аккаунт</Text>
        </AnimatedPressable>

        {/* Log In */}
        <AnimatedPressable
          style={s.secondaryBtn}
          onPress={() => router.push('/login' as never)}
        >
          <Ionicons name="log-in-outline" size={20} color={PRIMARY} style={s.btnIcon} />
          <Text style={s.secondaryBtnText}>Войти</Text>
        </AnimatedPressable>

        {/* Divider */}
        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>или войдите через</Text>
          <View style={s.dividerLine} />
        </View>

        {/* Social stubs */}
        <View style={s.socialRow}>
          <SocialButton
            icon="logo-google"
            label="Google"
            bg="#FFF"
            textColor="#333"
            onPress={() => {}}
          />
          {Platform.OS === 'ios' && (
            <SocialButton
              icon="logo-apple"
              label="Apple"
              bg="#000"
              textColor="#FFF"
              onPress={() => {}}
            />
          )}
          {Platform.OS !== 'ios' && (
            <SocialButton
              icon="logo-apple"
              label="Apple"
              bg="#1C1C1E"
              textColor="#FFF"
              onPress={() => {}}
            />
          )}
        </View>

        <Text style={s.legalText}>
          Регистрируясь, вы принимаете{' '}
          <Text style={{ color: PRIMARY }}>Условия использования</Text>
          {' '}и{' '}
          <Text style={{ color: PRIMARY }}>Политику конфиденциальности</Text>
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
}

// --- Animated press button ---
interface APProps {
  style: object | object[];
  onPress: () => void;
  children: React.ReactNode;
}

const AnimatedPressable: React.FC<APProps> = ({ style, onPress, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, tension: 400 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200 }).start()}
      activeOpacity={1}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

// --- Social button ---
interface SocialProps { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; bg: string; textColor: string; onPress: () => void }
const SocialButton: React.FC<SocialProps> = ({ icon, label, bg, textColor, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      style={[s.socialBtn, { backgroundColor: bg }]}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, tension: 400 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200 }).start()}
      activeOpacity={1}
    >
      <Animated.View style={[s.socialBtnInner, { transform: [{ scale }] }]}>
        <Ionicons name={icon} size={20} color={textColor} />
        <Text style={[s.socialBtnText, { color: textColor }]}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F0F0F' },
  logoSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 20,
  },
  logoBox: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  tagline: { fontSize: 15, color: '#666', marginTop: 6 },

  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  btnIcon: { marginRight: 10 },
  primaryBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryBtnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: PRIMARY,
    marginBottom: 24,
  },
  secondaryBtnText: { color: PRIMARY, fontSize: 17, fontWeight: '700' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#2C2C2E' },
  dividerText: { fontSize: 12, color: '#555', paddingHorizontal: 12 },

  socialRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  socialBtn: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  socialBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  socialBtnText: { fontSize: 15, fontWeight: '600' },

  legalText: { fontSize: 11, color: '#444', textAlign: 'center', lineHeight: 16 },
});
