import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { loadUser, clearUser, isSessionValid } from '@/lib/data';

export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    loadUser().then(async user => {
      if (!user) {
        router.replace('/welcome' as never);
      } else if (!isSessionValid(user)) {
        // Session older than 30 days — log out
        await clearUser();
        router.replace('/welcome' as never);
      } else if (!user.quizDone) {
        router.replace('/quiz' as never);
      } else {
        router.replace('/(tabs)/explore' as never);
      }
    });
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0F0F', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#9644D8" />
    </View>
  );
}
