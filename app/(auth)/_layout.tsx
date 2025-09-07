import { Stack } from 'expo-router';
import React from 'react';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="phone-auth" />
      <Stack.Screen name="roleSelection" />
    </Stack>
  );
}