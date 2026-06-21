import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';

const PRIMARY = '#9644D8';

export default function SplashScreen() {
  const router = useRouter();
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();

    // Navigate to main app after 1.1s
    const timer = setTimeout(() => {
      router.replace('/(tabs)/explore' as never);
    }, 1100);
    return () => clearTimeout(timer);
  }, [router, scale, opacity]);

  return (
    <View style={s.root}>
      <Animated.View style={[s.logoWrap, { opacity, transform: [{ scale }] }]}>
        <Text style={s.logoLetter}>S</Text>
      </Animated.View>
      <Animated.Text style={[s.brand, { opacity }]}>Spento</Animated.Text>
      <Animated.Text style={[s.tagline, { opacity }]}>
        Деньги уходят незаметно.{'\n'}Теперь ты это видишь.
      </Animated.Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 26,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  logoLetter: {
    fontSize: 52,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -2,
  },
  brand: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 4,
  },
});
