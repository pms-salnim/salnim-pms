
"use client";

import type { User } from '@/types/user';
import type { FirestoreUser, PropertyType as SignupPropertyType } from '@/types/firestoreUser';
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import type { AuthSession } from '@supabase/supabase-js';
import type { StaffRole, Permissions, AppModuleKey } from '@/types/staff';
import { appModules, defaultPermissions, fullPermissions } from '@/types/staff';
import type { Property } from '@/types/property';
import { toast } from '@/hooks/use-toast';
import i18n from '@/lib/i18n';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
);

// This type is used across the app, so it's defined here for broader access.
export interface Email {
  uid: number;
  from: { name: string; email: string };
  subject: string;
  date: string;
  snippet: string;
  body: string;
  bodyText?: string;
  unread: boolean;
  starred?: boolean;
  archived?: boolean;
  labels?: string[];
  attachments?: {
    filename: string;
    contentType: string;
    dataUri?: string;
    size: number;
  }[];
}

interface SignupData {
  fullName: string;
  email: string;
  country: string;
  city: string;
  address: string;
  propertyName: string;
  propertyAddress: string;
  propertyType: SignupPropertyType;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  property: Property | null;
  login: (email: string, pass: string) => Promise<void>;
  signup: (password: string, data: SignupData) => Promise<void>;
  logout: () => void;
  isLoadingAuth: boolean;
  refreshUserProfile: () => Promise<void>;
  preferredLanguage: string;
  setPreferredLanguage: (lang: string) => void;

  // Communication Features
  emails: Email[];
  unreadEmailCount: number;
  isLoadingEmails: boolean;
  refetchEmails: () => void;
  lastEmailSyncAt: number | null;
  isSyncingEmails: boolean;
  unreadMessageCount: number; // For internal team chat
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [preferredLanguage, setPreferredLanguageState] = useState(i18n.language);
  const router = useRouter();

  // Communication Hub State
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [initialEmailFetchDone, setInitialEmailFetchDone] = useState(false);
  const [lastEmailSyncAt, setLastEmailSyncAt] = useState<number | null>(null);
  const [isSyncingEmails, setIsSyncingEmails] = useState(false);
  const emailSyncCooldownMs = 2 * 60 * 1000;

  // Internal Workspace State
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  const unreadEmailCount = emails.filter(e => e.unread).length;

  const setPreferredLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    setPreferredLanguageState(lang);
    if (user?.id) {
        const userDocRef = doc(db, 'staff', user.id);
        updateDoc(userDocRef, { preferredLanguage: lang }).catch(err => {
            console.error("Failed to save language preference to Firestore:", err);
        });
    }
  };

  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
        setPreferredLanguageState(lng);
    };
    i18n.on('languageChanged', handleLanguageChanged);
    return () => {
        i18n.off('languageChanged', handleLanguageChanged);
    };
  }, []);

  const refetchEmails = useCallback(async (isPolling = false) => {
    try {
      // ✅ Strict IMAP configuration check - don't fetch if not configured
      if (!user || !property || !property.imapConfiguration) {
        if (!isPolling) {
          console.debug('Email fetch skipped: IMAP not configured');
        }
        return;
      }

      // ✅ Prevent concurrent requests - exit if already syncing
      if (isSyncingEmails) {
        console.debug('Email sync already in progress, skipping duplicate request');
        return;
      }

      // ✅ Enforce cooldown between sync attempts
      const now = Date.now();
      if (lastEmailSyncAt && now - lastEmailSyncAt < emailSyncCooldownMs) {
        if (!isPolling) {
          console.debug(`Email sync cooldown active. Next sync available in ${Math.ceil((emailSyncCooldownMs - (now - lastEmailSyncAt)) / 1000)}s`);
        }
        return;
      }

      setIsSyncingEmails(true);
      if (!isPolling) setIsLoadingEmails(true);

      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) {
          throw new Error("Unauthenticated: could not retrieve ID token");
        }

        // Use the Cloud Run function URL for Gen2 HTTP functions
        const endpoint = 'https://europe-west1-protrack-hub.cloudfunctions.net/fetchEmailsHttp';

        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({ mode: 'sync', maxNew: 200 }),
        }).catch(err => {
          console.error('Fetch error:', err);
          throw new Error('Network error: Unable to connect to email server');
        });

        if (!resp.ok) {
          let message = 'Failed to fetch emails';
          try {
            const err = await resp.json();
            message = err?.message || message;
          } catch (_) {
            message = `Server error: ${resp.status} ${resp.statusText}`;
          }
          throw new Error(message);
        }

        const newEmails: Email[] = await resp.json();
        setEmails(currentEmails => {
          if (isPolling) {
            const currentUids = new Set(currentEmails.map(e => e.uid));
            const hasNew = newEmails.some(e => !currentUids.has(e.uid) && e.unread);
            if (hasNew) {
              toast({ title: "New Mail", description: "You have new messages in your inbox." });
            }
          }
          return newEmails;
        });

        // ✅ Update last sync timestamp only on successful sync
        setLastEmailSyncAt(Date.now());

      } catch (fetchError: any) {
        // ✅ Only show errors for user-initiated fetches, not background polling
        if (!isPolling && property?.imapConfiguration) {
          toast({ title: "Error Fetching Emails", description: fetchError.message || "Could not retrieve emails.", variant: "destructive" });
          console.error("Email fetch failed:", fetchError);
        } else if (isPolling) {
          console.debug("Background email sync failed:", fetchError.message);
        }
      } finally {
        if (!isPolling) setIsLoadingEmails(false);
        setIsSyncingEmails(false);
        setInitialEmailFetchDone(true);
      }
    } catch (outerError: any) {
      // ✅ Blanket catch to prevent ANY unhandled errors from escaping
      console.debug('Email fetch wrapper caught error:', outerError?.message);
      setIsSyncingEmails(false);
      if (!isPolling) setIsLoadingEmails(false);
      setInitialEmailFetchDone(true);
    }
  }, [user, property, lastEmailSyncAt, isSyncingEmails]);


  const fetchAndSetUser = async (userId: string, accessToken?: string, retries = 3, delayMs = 500) => {
    try {
      // Fetch user profile from API endpoint (uses cookie-based auth or Bearer token)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // If access token provided, use it (for immediate post-login calls)
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
      
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        // If we get a 401 and have retries left, wait and try again
        // This handles the race condition where middleware hasn't set cookies yet
        if (response.status === 401 && retries > 0 && !accessToken) {
          console.log(`Session not ready, retrying in ${delayMs}ms (${retries} retries left)`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          return fetchAndSetUser(userId, undefined, retries - 1, delayMs * 1.5);
        }
        throw new Error(await response.text());
      }

      const { user: userData, property: propertyData } = await response.json();

      if (!userData) {
        console.warn('User profile not found');
        setUser(null);
        setProperty(null);
        setIsAuthenticated(false);
        localStorage.removeItem('propease_user_profile');
        setIsLoadingAuth(false);
        return;
      }

      // CHECK USER STATUS - Block inactive users from logging in
      console.log('Checking user status:', { email: userData.email, status: userData.status });
      if (userData.status === 'Inactive') {
        console.warn('User account is disabled:', userData.email);
        // Sign out the user
        await supabase.auth.signOut();
        setUser(null);
        setProperty(null);
        setIsAuthenticated(false);
        localStorage.removeItem('propease_user_profile');
        setIsLoadingAuth(false);
        
        // Throw error with gentle message
        const disabledError = new Error('Your account has been disabled. Please contact your administrator.');
        console.error('Throwing disabled account error:', disabledError.message);
        throw disabledError;
      }

      console.log('API response:', { 
        userId: userData.id, 
        propertyId: userData.property_id,
        hasPropertyData: !!propertyData 
      });

      // Build user object with permissions
      let finalPermissions = { ...defaultPermissions, ...(userData.permissions || {}) };

      // Grant full permissions to admin and owner roles
      if (userData.role === 'admin' || userData.role === 'owner') {
        finalPermissions = { ...fullPermissions };
      }

      const appUser: User = {
        id: userData.id,
        email: userData.email,
        name: userData.name || 'User',
        role: userData.role,
        propertyId: userData.property_id || '',
        country: userData.country,
        city: userData.city,
        address: userData.address,
        phone: userData.phone,
        permissions: finalPermissions,
        preferredLanguage: userData.preferred_language || 'en',
      };

      setUser(appUser);
      setProperty(propertyData || null);
      setIsAuthenticated(true);
      setPreferredLanguage(userData.preferred_language || 'en');
      localStorage.setItem('propease_user_profile', JSON.stringify({ name: appUser.name }));
    } catch (error: any) {
      console.error('Error fetching user profile:', error);
      setUser(null);
      setProperty(null);
      setIsAuthenticated(false);
      localStorage.removeItem('propease_user_profile');
      // ✅ Re-throw the error so it propagates to login() and then to the form
      throw error;
    } finally {
      setIsLoadingAuth(false);
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await fetchAndSetUser(session.user.id, session.access_token);
      } else {
        setUser(null);
        setProperty(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        localStorage.removeItem('propease_user_profile');
        setEmails([]);
        setUnreadMessageCount(0);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Monitor user status for logged-in users - logout if account is disabled
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const statusCheckInterval = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        // Fetch current user profile to check status
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) return;

        const { user: userData } = await response.json();

        // If user status is now Inactive, sign out and notify
        if (userData?.status === 'Inactive') {
          console.warn('User account has been disabled, logging out:', userData.email);
          
          // ✅ Store the logout reason so login page can display it
          localStorage.setItem('disabledAccountLogout', 'true');
          
          // Sign out
          await supabase.auth.signOut();
          setUser(null);
          setProperty(null);
          setIsAuthenticated(false);
          localStorage.removeItem('propease_user_profile');
          setEmails([]);
          setUnreadMessageCount(0);

          // Show notification
          toast({
            title: 'Account Disabled',
            description: 'Your account has been disabled by an administrator. You have been logged out.',
            variant: 'destructive',
          });

          // Redirect to login (will show persisted error message)
          router.push('/login');
        }
      } catch (error) {
        // Silently fail - don't interrupt user experience on network errors
        console.debug('Status check failed (expected on network issues):', error);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(statusCheckInterval);
  }, [isAuthenticated, user?.id, router]);
  
  // TODO: Implement email functionality with Supabase if needed
  // Property listener for last sync and cache readiness
  /*
  useEffect(() => {
    if (!user?.propertyId) return;
    const propRef = doc(db, 'properties', user.propertyId);
    return onSnapshot(propRef, (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as Property;
        setProperty(data);
        const raw = (data as any).emailLastSyncAt;
        if (raw?.toMillis) {
          setLastEmailSyncAt(raw.toMillis());
        } else if (typeof raw === 'number') {
          setLastEmailSyncAt(raw);
        } else {
          setLastEmailSyncAt(null);
        }
      }
    });
  }, [user?.propertyId]);

  // Email cache listener (instant inbox from Firestore)
  useEffect(() => {
    if (!user?.propertyId) return;
    const emailsQuery = query(
      collection(db, 'properties', user.propertyId, 'emails'),
      orderBy('dateMs', 'desc'),
      limit(50)
    );
    return onSnapshot(emailsQuery, (snap) => {
      const cachedEmails = snap.docs.map(doc => doc.data() as Email);
      setEmails(cachedEmails);
      setInitialEmailFetchDone(true);
    });
  }, [user?.propertyId]);

  // ✅ Background sync with strict IMAP config check and cooldown (no IMAP call on load)
  useEffect(() => {
    // Exit immediately if required conditions not met
    if (!user || !property || !property.imapConfiguration) {
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const timeoutId = setTimeout(() => {
      // Call refetchEmails(true) directly without adding to dependency array
      refetchEmails(true);
      intervalId = setInterval(() => {
        refetchEmails(true);
      }, 5 * 60 * 1000); // Poll every 5 minutes
    }, 2 * 60 * 1000); // Start polling after 2 minutes

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
    // Note: Intentionally excluding refetchEmails from deps to prevent effect restarts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, property]);

  // Internal Conversation Unread Count Effect
  useEffect(() => {
    if (user?.id) {
        const conversationsQuery = query(
            collection(db, "conversations"),
            where("participants", "array-contains", user.id)
        );

        const unsubscribe = onSnapshot(conversationsQuery, (snapshot) => {
            let count = 0;
            snapshot.forEach(doc => {
                const conversation = doc.data() as Conversation;
                count += conversation.unreadCounts?.[user.id!] || 0;
            });
            setUnreadMessageCount(count);
        });

        return () => unsubscribe();
    }
  }, [user?.id]);
  */


  const refreshUserProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await fetchAndSetUser(session.user.id);
    }
  };

  const login = async (email: string, password: string) => {
    console.log('Login attempt initiated for:', email);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Auth sign in error:', error.message);
        throw error;
      }

      console.log('Auth sign in successful, checking account status...');
      
      // ✅ Immediately fetch user profile and check if account is disabled
      // This is done BEFORE the useEffect, so the form catches the error directly
      if (data.session?.user) {
        await fetchAndSetUser(data.session.user.id, data.session.access_token);
        console.log('User profile fetched and verified - login complete');
      }
    } catch (error: any) {
      console.error('Login error:', error.message);
      throw error;
    }
  };

  const signup = async (password: string, data: SignupData) => {
    setIsLoadingAuth(true);
    try {
      // Call the API endpoint to create user and property
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          password: password,
          fullName: data.fullName,
          country: data.country,
          city: data.city,
          address: data.address,
          propertyName: data.propertyName,
          propertyAddress: data.propertyAddress,
          propertyType: data.propertyType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Signup failed');
      }

      const result = await response.json();

      // Sign in user after successful signup
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: password,
      });

      if (signInError) throw signInError;

      if (authData.session?.user) {
        await fetchAndSetUser(authData.session.user.id, authData.session.access_token);
      }
    } catch (error: any) {
      setIsLoadingAuth(false);
      throw error;
    }
  };

  const logout = async () => {
    setIsLoadingAuth(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProperty(null);
      setIsAuthenticated(false);
      setEmails([]);
      localStorage.removeItem('propease_user_profile');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
        isAuthenticated, user, property, login, signup, logout, isLoadingAuth, refreshUserProfile,
        preferredLanguage, setPreferredLanguage,
      emails, unreadEmailCount, isLoadingEmails, refetchEmails, lastEmailSyncAt, isSyncingEmails, unreadMessageCount
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
