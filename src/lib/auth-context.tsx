'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  apiFetch,
  type SessionResponse,
  type SignInBody,
  type SignUpBody,
  type UserPublic,
} from './api';
import { DEFAULT_DEMO_USER } from './campus-data';

export type OutingRhythm = 'WEEKNIGHTS' | 'WEEKENDS' | 'BOTH';

export interface PersonaProfile {
  skipped: boolean;
  vibes: string[];
  hall: string;
  faculty: string;
  level: string;
  rhythm: OutingRhythm;
  freeEventsOnly: boolean;
  personaBadge: string;
  followedClubIds: string[];
}

export interface PrivacyPreferences {
  stealthRsvp: boolean;
  hideFromFriends: boolean;
  mutedCategories: string[];
  theme: 'system' | 'dark' | 'light';
}

interface AuthContextValue {
  user: UserPublic | null;
  accessToken: string | null;
  persona: PersonaProfile | null;
  privacy: PrivacyPreferences;
  interestedEventIds: string[];
  followedOrganizerIds: string[];
  signIn: (body: SignInBody) => Promise<UserPublic>;
  signUp: (body: SignUpBody) => Promise<UserPublic>;
  signOut: () => void;
  markStudentVerified: () => void;
  savePersona: (next: PersonaProfile) => void;
  updatePrivacy: (patch: Partial<PrivacyPreferences>) => void;
  toggleInterested: (eventId: string) => boolean;
  toggleFollowOrganizer: (organizerId: string) => boolean;
}

const STORAGE_KEYS = {
  user: 'cp_auth_user_v1',
  persona: 'cp_persona_v1',
  privacy: 'cp_privacy_v1',
  interested: 'cp_interested_events_v1',
  follows: 'cp_followed_organizers_v1',
};

const DEFAULT_PRIVACY: PrivacyPreferences = {
  stealthRsvp: false,
  hideFromFriends: false,
  mutedCategories: [],
  theme: 'system',
};

function readStoredJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(() =>
    readStoredJson<UserPublic | null>(STORAGE_KEYS.user, DEFAULT_DEMO_USER),
  );
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [persona, setPersona] = useState<PersonaProfile | null>(() =>
    readStoredJson<PersonaProfile | null>(STORAGE_KEYS.persona, null),
  );
  const [privacy, setPrivacy] = useState<PrivacyPreferences>(() =>
    readStoredJson<PrivacyPreferences>(STORAGE_KEYS.privacy, DEFAULT_PRIVACY),
  );
  const [interestedEventIds, setInterestedEventIds] = useState<string[]>(() =>
    readStoredJson<string[]>(STORAGE_KEYS.interested, ['22222222-2222-4222-8222-222222222202']),
  );
  const [followedOrganizerIds, setFollowedOrganizerIds] = useState<string[]>(() =>
    readStoredJson<string[]>(STORAGE_KEYS.follows, [
      '11111111-1111-4111-8111-111111111101',
      '11111111-1111-4111-8111-111111111103',
    ]),
  );

  useEffect(() => {
    applyThemeAttribute(privacy.theme);
  }, [privacy.theme]);

  const signIn = useCallback(async (body: SignInBody): Promise<UserPublic> => {
    try {
      const session = await apiFetch<SessionResponse>('/auth/sign-in', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setUser(session.user);
      setAccessToken(session.accessToken);
      window.localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(session.user));
      return session.user;
    } catch {
      const emailPrefix = body.email.split('@')[0] ?? 'UI Student';
      const isUiEmail = body.email.toLowerCase().endsWith('@stu.ui.edu.ng');
      const fallbackUser: UserPublic = {
        id: DEFAULT_DEMO_USER.id,
        displayName: emailPrefix.replace(/[._-]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        avatarUrl: null,
        role: 'ATTENDEE',
        isVerifiedStudent: isUiEmail,
      };
      setUser(fallbackUser);
      setAccessToken('local-demo-token');
      window.localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(fallbackUser));
      return fallbackUser;
    }
  }, []);

  const signUp = useCallback(async (body: SignUpBody): Promise<UserPublic> => {
    try {
      const session = await apiFetch<SessionResponse>('/auth/sign-up', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setUser(session.user);
      setAccessToken(session.accessToken);
      window.localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(session.user));
      return session.user;
    } catch {
      const isUiEmail = body.email.toLowerCase().endsWith('@stu.ui.edu.ng');
      const newUser: UserPublic = {
        id: `usr-${Date.now()}`,
        displayName: body.displayName.trim() || 'UI Student',
        avatarUrl: null,
        role: 'ATTENDEE',
        isVerifiedStudent: isUiEmail,
      };
      setUser(newUser);
      setAccessToken('local-demo-token');
      window.localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(newUser));
      return newUser;
    }
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    try {
      window.localStorage.removeItem(STORAGE_KEYS.user);
    } catch {
      // ignore
    }
  }, []);

  const markStudentVerified = useCallback(() => {
    setUser((prev) => {
      const base = prev ?? DEFAULT_DEMO_USER;
      const next = { ...base, isVerifiedStudent: true };
      try {
        window.localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const savePersona = useCallback((next: PersonaProfile) => {
    setPersona(next);
    if (next.followedClubIds.length > 0) {
      setFollowedOrganizerIds((prev) => {
        const merged = Array.from(new Set([...prev, ...next.followedClubIds]));
        try {
          window.localStorage.setItem(STORAGE_KEYS.follows, JSON.stringify(merged));
        } catch {
          // ignore
        }
        return merged;
      });
    }
    try {
      window.localStorage.setItem(STORAGE_KEYS.persona, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const updatePrivacy = useCallback((patch: Partial<PrivacyPreferences>) => {
    setPrivacy((prev) => {
      const next = { ...prev, ...patch };
      applyThemeAttribute(next.theme);
      try {
        window.localStorage.setItem(STORAGE_KEYS.privacy, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const toggleInterested = useCallback((eventId: string): boolean => {
    let added = false;
    setInterestedEventIds((prev) => {
      const exists = prev.includes(eventId);
      added = !exists;
      const next = exists ? prev.filter((id) => id !== eventId) : [...prev, eventId];
      try {
        window.localStorage.setItem(STORAGE_KEYS.interested, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    return added;
  }, []);

  const toggleFollowOrganizer = useCallback((organizerId: string): boolean => {
    let following = false;
    setFollowedOrganizerIds((prev) => {
      const exists = prev.includes(organizerId);
      following = !exists;
      const next = exists ? prev.filter((id) => id !== organizerId) : [...prev, organizerId];
      try {
        window.localStorage.setItem(STORAGE_KEYS.follows, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    return following;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        persona,
        privacy,
        interestedEventIds,
        followedOrganizerIds,
        signIn,
        signUp,
        signOut,
        markStudentVerified,
        savePersona,
        updatePrivacy,
        toggleInterested,
        toggleFollowOrganizer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function applyThemeAttribute(theme: PrivacyPreferences['theme']) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: DEFAULT_DEMO_USER,
      accessToken: null,
      persona: null,
      privacy: DEFAULT_PRIVACY,
      interestedEventIds: [],
      followedOrganizerIds: [],
      signIn: async () => DEFAULT_DEMO_USER,
      signUp: async () => DEFAULT_DEMO_USER,
      signOut: () => undefined,
      markStudentVerified: () => undefined,
      savePersona: () => undefined,
      updatePrivacy: () => undefined,
      toggleInterested: () => true,
      toggleFollowOrganizer: () => true,
    };
  }
  return ctx;
}
