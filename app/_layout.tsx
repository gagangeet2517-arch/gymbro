import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { BodyMetricsProvider } from '../context/BodyMetricsContext';
import { ExerciseProvider } from '../context/ExerciseContext';
import { NutritionProvider } from '../context/NutritionContext';
import { TemplateProvider } from '../context/TemplateContext';
import { UserProfileProvider } from '../context/UserProfileContext';
import { WorkoutProvider } from '../context/WorkoutContext';

export default function RootLayout() {
  return (
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
          <StatusBar style="light" />
        </WorkoutProvider>
      </TemplateProvider>
    </ExerciseProvider>
    </BodyMetricsProvider>
    </UserProfileProvider>
    </NutritionProvider>
  );
}