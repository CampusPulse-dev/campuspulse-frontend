'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ApiRequestError,
  apiFetch,
  type SessionResponse,
  type SignInBody,
  type SignUpBody,
  type UserPublic,
} from './api';
import { DEFAULT_DEMO_USER } from './campus-data';
import { DATA_MODE, DEMO_MODE } from './mode';
import {
  attendeeRequest,
  DEFAULT_PRIVACY,
  readLocal,
  writeLocal,
  type PersonaProfile,
  type PrivacyPreferences,
} from './attendee-data';
import { clearTicketAccount, setTicketAccount } from './offline-tickets';
export type { PersonaProfile, PrivacyPreferences } from './attendee-data';
export type OutingRhythm = PersonaProfile['rhythm'];
interface AuthContextValue {
  user: UserPublic | null;
  accessToken: string | null;
  ready: boolean;
  persona: PersonaProfile | null;
  privacy: PrivacyPreferences;
  interestedEventIds: string[];
  followedOrganizerIds: string[];
  signIn: (body: SignInBody) => Promise<UserPublic>;
  signUp: (body: SignUpBody) => Promise<UserPublic>;
  signOut: () => Promise<void>;
  markStudentVerified: (verified?: boolean) => void;
  savePersona: (next: PersonaProfile) => Promise<void>;
  updatePrivacy: (patch: Partial<PrivacyPreferences>) => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
  toggleInterested: (id: string) => Promise<boolean>;
  toggleFollowOrganizer: (id: string) => Promise<boolean>;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<UserPublic | null>(null);
  const [ready, setReady] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [persona, setPersona] = useState<PersonaProfile | null>(null);
  const [privacy, setPrivacy] = useState(DEFAULT_PRIVACY);
  const [interestedEventIds, setInterested] = useState<string[]>([]);
  const [followedOrganizerIds, setFollows] = useState<string[]>([]);
  const installUser = useCallback(
    async (next: UserPublic | null, token: string | null) => {
      const previous = readLocal<UserPublic | null>('user', null);
      if (previous?.id !== next?.id) {
        await clearTicketAccount();
        queryClient.clear();
      }
      setTicketAccount(next?.id ?? null);
      writeLocal('user', next);
      setUser(next);
      setAccessToken(token);
      const key = next?.id ?? 'guest';
      setPersona(readLocal(`persona:${key}`, null));
      setPrivacy(readLocal(`privacy:${key}`, DEFAULT_PRIVACY));
      setInterested(readLocal(`interested:${key}`, []));
      setFollows(readLocal(`follows:${key}`, []));
    },
    [queryClient],
  );
  useEffect(() => {
    let alive = true;
    async function restore() {
      if (DEMO_MODE || !navigator.onLine) {
        if (alive) await installUser(readLocal('user', null), null);
      } else {
        try {
          const s = await apiFetch<SessionResponse>('/auth/refresh', { method: 'POST' });
          if (alive) await installUser(s.user, s.accessToken);
        } catch (error) {
          if (alive)
            await installUser(
              error instanceof ApiRequestError && error.error.statusCode === 401
                ? null
                : readLocal('user', null),
              null,
            );
        }
      }
      if (alive) setReady(true);
    }
    void restore();
    return () => {
      alive = false;
    };
  }, [installUser]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === DATA_MODE + ':user') {
        void clearTicketAccount().then(() => {
          queryClient.clear();
          return installUser(readLocal('user', null), null);
        });
      }
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [installUser, queryClient]);
  useEffect(() => {
    if (privacy.theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', privacy.theme);
  }, [privacy.theme]);
  async function authenticate(body: SignInBody | SignUpBody, path: string) {
    const digest = DEMO_MODE
      ? Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              'SHA-256',
              new TextEncoder().encode(body.email.trim().toLowerCase()),
            ),
          ),
        )
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
      : '';
    const demoId = digest
      ? digest.slice(0, 8) +
        '-' +
        digest.slice(8, 12) +
        '-4' +
        digest.slice(13, 16) +
        '-8' +
        digest.slice(17, 20) +
        '-' +
        digest.slice(20, 32)
      : '';
    const session = DEMO_MODE
      ? {
          user: {
            ...DEFAULT_DEMO_USER,
            id: demoId,
            isVerifiedStudent: false,
            displayName: 'displayName' in body ? body.displayName : 'Tobi Adeyemi',
          },
          accessToken: 'demo',
        }
      : await apiFetch<SessionResponse>(path, { method: 'POST', body: JSON.stringify(body) });
    await installUser(session.user, session.accessToken);
    return session.user;
  }
  async function signOut() {
    try {
      if (!DEMO_MODE) await apiFetch('/auth/sign-out', { method: 'POST' });
    } finally {
      await installUser(null, null);
    }
    window.dispatchEvent(new Event('cp-account-change'));
  }
  function requireUser() {
    if (!user) throw new Error('Sign in to continue.');
    if (!DEMO_MODE && !accessToken) throw new Error('Reconnect and sign in to save changes.');
    return user;
  }
  async function savePersona(next: PersonaProfile) {
    const u = requireUser();
    if (!DEMO_MODE)
      await attendeeRequest('AttendeePersona', '/users/me/persona', accessToken, 'PUT', next);
    writeLocal(`persona:${u.id}`, next);
    setPersona(next);
  }
  async function updatePrivacy(patch: Partial<PrivacyPreferences>) {
    const u = requireUser();
    const next = { ...privacy, ...patch };
    if (!DEMO_MODE)
      await attendeeRequest('AttendeePrivacy', '/users/me/preferences', accessToken, 'PUT', next);
    writeLocal(`privacy:${u.id}`, next);
    setPrivacy(next);
  }
  async function updateProfile(displayName: string) {
    const u = requireUser();
    const next = DEMO_MODE
      ? { ...u, displayName }
      : await attendeeRequest('UserPublic', '/users/me', accessToken, 'PATCH', { displayName });
    writeLocal('user', next);
    setUser(next);
  }
  async function toggleInterested(id: string) {
    const u = requireUser();
    const added = !interestedEventIds.includes(id);
    if (!DEMO_MODE)
      await apiFetch(`/attendance/interested/${id}`, {
        method: added ? 'POST' : 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    const next = added ? [...interestedEventIds, id] : interestedEventIds.filter((v) => v !== id);
    writeLocal(`interested:${u.id}`, next);
    setInterested(next);
    return added;
  }
  async function toggleFollowOrganizer(id: string) {
    const u = requireUser();
    const added = !followedOrganizerIds.includes(id);
    if (!DEMO_MODE)
      await apiFetch(`/organizers/${id}/follow`, {
        method: added ? 'POST' : 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    const next = added
      ? [...followedOrganizerIds, id]
      : followedOrganizerIds.filter((v) => v !== id);
    writeLocal(`follows:${u.id}`, next);
    setFollows(next);
    return added;
  }
  function markStudentVerified(verified = true) {
    if (!DEMO_MODE || !user) return;
    const next = { ...user, isVerifiedStudent: verified };
    setUser(next);
    writeLocal('user', next);
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        ready,
        persona,
        privacy,
        interestedEventIds,
        followedOrganizerIds,
        signIn: (b) => authenticate(b, '/auth/sign-in'),
        signUp: (b) => authenticate(b, '/auth/sign-up'),
        signOut,
        markStudentVerified,
        savePersona,
        updatePrivacy,
        updateProfile,
        toggleInterested,
        toggleFollowOrganizer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
const signedOut: AuthContextValue = {
  user: null,
  ready: true,
  accessToken: null,
  persona: null,
  privacy: DEFAULT_PRIVACY,
  interestedEventIds: [],
  followedOrganizerIds: [],
  signIn: async () => {
    throw new Error('Sign in unavailable');
  },
  signUp: async () => {
    throw new Error('Sign up unavailable');
  },
  signOut: async () => {},
  markStudentVerified: () => {},
  savePersona: async () => {},
  updatePrivacy: async () => {},
  updateProfile: async () => {},
  toggleInterested: async () => false,
  toggleFollowOrganizer: async () => false,
};
export function useAuth(): AuthContextValue {
  return useContext(AuthContext) ?? signedOut;
}
