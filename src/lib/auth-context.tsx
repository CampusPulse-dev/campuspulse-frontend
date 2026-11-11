'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ApiRequestError,
  apiFetch,
  type Schemas,
  type SessionResponse,
  type SignInBody,
  type SignUpBody,
  type UserPublic,
  onSessionChange,
  refreshSession,
  setSessionToken,
} from './api';
import { DEFAULT_DEMO_USER } from './campus-data';
import { DATA_MODE, DEMO_MODE, DEV_AUTH_MODE, getDevAuthEmail, setDevAuthEmail } from './mode';
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
/** Fired when the cp_signed_in cookie flips; ServerViewSync refreshes the route. */
export const SIGNED_IN_CHANGE_EVENT = 'cp-signed-in-change';
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
      // Presentation hint only; API authorization still uses the real session.
      // The server picks landing vs. feed (and the shell) from this cookie, so
      // when it flips after render, ask the router to re-render server output.
      const wasSignedIn = /(?:^|;\s*)cp_signed_in=1(?:;|$)/.test(document.cookie);
      document.cookie = next
        ? 'cp_signed_in=1; Path=/; SameSite=Lax; Max-Age=2592000' +
          (location.protocol === 'https:' ? '; Secure' : '')
        : 'cp_signed_in=; Path=/; SameSite=Lax; Max-Age=0';
      if (wasSignedIn !== Boolean(next)) window.dispatchEvent(new Event(SIGNED_IN_CHANGE_EVENT));
      writeLocal('user', next);
      setUser(next);
      setAccessToken(token);
      setSessionToken(token && token !== 'demo' && token !== 'dev-auth' ? token : null);
      const key = next?.id ?? 'guest';
      setPersona(readLocal(`persona:${key}`, null));
      setPrivacy(readLocal(`privacy:${key}`, DEFAULT_PRIVACY));
      setInterested(readLocal(`interested:${key}`, []));
      setFollows(readLocal(`follows:${key}`, []));
    },
    [queryClient],
  );
  const hydrateRemotePreferences = useCallback(async (userId: string) => {
    try {
      const prefs = await apiFetch<Schemas['AttendeePreferences']>('/users/me/preferences', {
        cache: 'no-store',
      });
      if (prefs.persona) {
        writeLocal(`persona:${userId}`, prefs.persona);
        setPersona(prefs.persona);
        writeLocal(`follows:${userId}`, prefs.persona.followedClubIds);
        setFollows(prefs.persona.followedClubIds);
      }
      writeLocal(`privacy:${userId}`, prefs.privacy);
      setPrivacy(prefs.privacy);
    } catch {
      // Fall back to local cache if preferences fetch fails transiently.
    }
  }, []);

  useEffect(() => {
    let alive = true;
    async function restore() {
      if (DEMO_MODE || !navigator.onLine) {
        if (alive) await installUser(readLocal('user', null), DEV_AUTH_MODE ? 'dev-auth' : null);
      } else if (DEV_AUTH_MODE) {
        const devEmail = getDevAuthEmail();
        if (!devEmail) {
          if (alive) await installUser(null, null);
        } else {
          try {
            const me = await apiFetch<UserPublic>('/users/me', { cache: 'no-store' });
            if (alive) {
              await installUser(me, 'dev-auth');
              await hydrateRemotePreferences(me.id);
            }
          } catch (error) {
            if (alive) {
              if (error instanceof ApiRequestError && error.error.statusCode === 401) {
                setDevAuthEmail(null);
                await installUser(null, null);
              } else {
                await installUser(readLocal('user', null), 'dev-auth');
              }
            }
          }
        }
      } else {
        try {
          const s = await refreshSession();
          if (alive) {
            await installUser(s.user, s.accessToken);
            await hydrateRemotePreferences(s.user.id);
          }
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
  }, [hydrateRemotePreferences, installUser]);
  // A background refresh (triggered by a 401 inside apiFetch) replaced or ended the session.
  useEffect(
    () =>
      onSessionChange((session) => {
        if (!session) {
          void installUser(null, null);
          return;
        }
        writeLocal('user', session.user);
        setUser(session.user);
        setAccessToken(session.accessToken);
      }),
    [installUser],
  );
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
    if (DEV_AUTH_MODE) {
      setDevAuthEmail(body.email);
      let me = await apiFetch<UserPublic>('/users/me', { cache: 'no-store' });
      if ('displayName' in body && body.displayName.trim()) {
        me = await apiFetch<UserPublic>('/users/me', {
          method: 'PATCH',
          body: JSON.stringify({ displayName: body.displayName.trim() }),
        });
      }
      await installUser(me, 'dev-auth');
      await hydrateRemotePreferences(me.id);
      return me;
    }

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
            role: body.email.trim().toLowerCase().startsWith('organizer')
              ? ('ORGANIZER' as const)
              : DEFAULT_DEMO_USER.role,
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
      if (DEV_AUTH_MODE) setDevAuthEmail(null);
      else if (!DEMO_MODE) await apiFetch('/auth/sign-out', { method: 'POST' });
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
    // Presentation only: in live mode the server already holds the real flag.
    if (!user) return;
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
