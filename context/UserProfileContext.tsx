import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

export type UserGoal = 'fat_loss' | 'lean_bulk' | 'maintenance' | 'recomp';

export type LifestyleGoal = 'hydration' | 'steps' | 'sleep' | 'consistency';

export type ReminderInterval = 'daily' | 'weekly' | 'monthly';

export type ReminderConfig = {
  enabled: boolean;
  hour: number;   // 0–23
  minute: number; // 0–59
  interval: ReminderInterval; // honoured by the long-term reminder; daily is always daily
  message: string; // custom notification text; daily = reminder message, long-term = goal description
};

export type UserProfile = {
  name: string;
  countryCode: string;
  phone: string;
  goal: UserGoal | null;
  lifestyleGoals: LifestyleGoal[];
  dailyReminder: ReminderConfig;
  longTermReminder: ReminderConfig;
};

type UserProfileContextType = {
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => void;
  // convenience accessor
  goal: UserGoal | null;
  setGoal: (g: UserGoal | null) => void;
};

const PROFILE_KEY = 'gymbro_user_profile';

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  countryCode: '+1',
  phone: '',
  goal: null,
  lifestyleGoals: [],
  dailyReminder: { enabled: false, hour: 18, minute: 0, interval: 'daily', message: '' },
  longTermReminder: { enabled: false, hour: 9, minute: 0, interval: 'weekly', message: '' },
};

const UserProfileContext = createContext<UserProfileContextType | null>(null);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_KEY).then((raw) => {
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          setProfile({ ...DEFAULT_PROFILE, ...saved });
        } catch { /* ignore corrupt data */ }
      }
      setHasHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }, [profile, hasHydrated]);

  const updateProfile = (updates: Partial<UserProfile>) =>
    setProfile((prev) => ({ ...prev, ...updates }));

  const setGoal = (g: UserGoal | null) => updateProfile({ goal: g });

  return (
    <UserProfileContext.Provider value={{ profile, updateProfile, goal: profile.goal, setGoal }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile(): UserProfileContextType {
  const ctx = useContext(UserProfileContext);
  if (!ctx) throw new Error('useUserProfile must be used within UserProfileProvider');
  return ctx;
}
