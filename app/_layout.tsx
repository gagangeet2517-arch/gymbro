import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import Onboarding from '../components/Onboarding';
import { BodyMetricsProvider } from '../context/BodyMetricsContext';
import { ExerciseProvider } from '../context/ExerciseContext';
import { NutritionProvider } from '../context/NutritionContext';
import { TemplateProvider } from '../context/TemplateContext';
import { UserProfileProvider } from '../context/UserProfileContext';
import { WorkoutProvider } from '../context/WorkoutContext';

const ONBOARDING_KEY = 'gymbro_onboarding_seen';

function OnboardingGate() {
  // null = still loading the flag; true/false = whether to show onboarding.
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((v) => setShowOnboarding(v !== 'true'));
  }, []);

  const finish = () => {
    setShowOnboarding(false);
    AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  };

  if (showOnboarding === null) return null;
  if (showOnboarding) return <Onboarding onDone={finish} />;
  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <KeyboardProvider>
    <NutritionProvider>
    <UserProfileProvider>
    <BodyMetricsProvider>
    <ExerciseProvider>
      <TemplateProvider>
        <WorkoutProvider>
          <Stack screenOptions={{ headerShown: false, homeIndicatorHidden: true } as object}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="workout/[id]"
            options={{ animation: 'fade' }}
            />
          </Stack>
          <OnboardingGate />
          <StatusBar style="light" />
        </WorkoutProvider>
      </TemplateProvider>
    </ExerciseProvider>
    </BodyMetricsProvider>
    </UserProfileProvider>
    </NutritionProvider>
    </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
