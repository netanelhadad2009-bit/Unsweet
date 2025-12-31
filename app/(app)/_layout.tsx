import { Stack } from 'expo-router';
import { Theme } from '../../constants/Theme';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Theme.colors.primary,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontFamily: Theme.fonts.bold,
          fontWeight: '700',
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Unsweet',
          headerShown: true,
        }}
      />
    </Stack>
  );
}
