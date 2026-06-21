import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { loadUser, clearUser, isSessionValid } from '@/lib/data';

const PRIMARY = '#9644D8';

export default function IndexScreen() {
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      loadUser().then(async user => {
        if (!user) {
          router.replace('/welcome' as never);
        } else if (!isSessionValid(user)) {
          await clearUser();
          router.replace('/welcome' as never);
        } else if (!user.quizDone) {
          router.replace('/quiz' as never);
        } else {
          router.replace('/splash' as never);
        }
      });
    }, [router])
  );

  return (
    <View style={s.root}>
      <View style={s.logoWrap}>
        <Text style={s.logoLetter}>S</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 26,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
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
});
