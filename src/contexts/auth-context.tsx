
"use client";

import type { User } from '@/types/user';
import type { FirestoreUser, PropertyType as SignupPropertyType } from '@/types/firestoreUser';
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, app } from '@/lib/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged as firebaseOnAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc, type Timestamp, collection, writeBatch, updateDoc, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { StaffRole, Permissions, AppModuleKey } from '@/types/staff';
import { appModules, defaultPermissions } from '@/types/staff';
import type { Property } from '@/types/property';
import type { Conversation } from '@/types/conversation';
import { toast } from '@/hooks/use-toast';
import i18n from '@/lib/i18n';

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


  const fetchAndSetUser = async (firebaseUser: import('firebase/auth').User) => {
    const staffDocRef = doc(db, "staff", firebaseUser.uid);
    try {
      const staffDocSnap = await getDoc(staffDocRef);
      let appUser: User;

      if (staffDocSnap.exists()) {
        const firestoreData = staffDocSnap.data() as FirestoreUser;
        
        await updateDoc(staffDocRef, {
            status: 'online',
            last_active: serverTimestamp()
        });

        let finalPermissions = { ...defaultPermissions, ...(firestoreData.permissions || {}) };

        if (firestoreData.role === 'admin') {
            const adminPerms: Partial<Permissions> = {};
            appModules.forEach(mod => adminPerms[mod.key] = true);
            finalPermissions = { ...finalPermissions, ...adminPerms };
        }

        appUser = {
          id: firebaseUser.uid,
          email: firebaseUser.email!,
          name: firestoreData.fullName || firebaseUser.displayName || "User",
          role: firestoreData.role,
          propertyId: firestoreData.propertyId,
          country: firestoreData.country,
          city: firestoreData.city,
          address: firestoreData.address,
          phone: firestoreData.phone,
          permissions: finalPermissions,
          preferredLanguage: firestoreData.preferredLanguage || 'en',
        };

        if (firestoreData.preferredLanguage) {
            setPreferredLanguage(firestoreData.preferredLanguage);
        }

        if (firestoreData.propertyId) {
          const propDocRef = doc(db, "properties", firestoreData.propertyId);
          const propDocSnap = await getDoc(propDocRef);
          if (propDocSnap.exists()) {
            const propData = { id: propDocSnap.id, ...propDocSnap.data() } as Property;
            setProperty(propData);
          } else {
            console.warn(`Property document not found for propertyId: ${firestoreData.propertyId}`);
            setProperty(null);
          }
        } else {
          setProperty(null);
        }

      } else {
        console.warn("User exists in Auth but not in Firestore staff collection:", firebaseUser.uid);
        setUser(null);
        setProperty(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        localStorage.removeItem('propease_user_profile');
        return;
      }
      setUser(appUser);
      setIsAuthenticated(true);
      localStorage.setItem('propease_user_profile', JSON.stringify({ name: appUser.name }));
    } catch (error) {
      console.error("Error fetching Firestore staff document:", error);
      setUser({
        id: firebaseUser.uid,
        email: firebaseUser.email!,
        name: firebaseUser.displayName || "User (Profile Sync Error)",
        propertyId: "",
        permissions: defaultPermissions, 
        preferredLanguage: 'en',
      });
      setProperty(null);
      setIsAuthenticated(true);
    }
    setIsLoadingAuth(false);
  };

  useEffect(() => {
    const unsubscribe = firebaseOnAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await fetchAndSetUser(firebaseUser);
      } else {
        setUser(null);
        setProperty(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setInitialEmailFetchDone(false); // Reset on logout
        setEmails([]);
        setUnreadMessageCount(0);
        localStorage.removeItem('propease_user_profile');
      }
    });
    return () => unsubscribe();
  }, []);
  
  // Property listener for last sync and cache readiness
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


  const refreshUserProfile = async () => {
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      setIsLoadingAuth(true);
      await fetchAndSetUser(firebaseUser);
    }
  };

  const login = async (email: string, pass: string) => {
    // We no longer manage isLoadingAuth here. The component will handle its own loading state.
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will handle the rest upon successful sign-in.
    } catch (error: any) {
      // Re-throw the error so the login form can catch it and display a message.
      throw error;
    }
  };

  const signup = async (password: string, data: SignupData) => {
    setIsLoadingAuth(true);
    try {
        const functions = getFunctions(app, 'europe-west1');
        const signupAndCreateProperty = httpsCallable(functions, 'signupAndCreateProperty');

        const requestData = {
            email: data.email,
            password: password,
            fullName: data.fullName,
            country: data.country,
            city: data.city,
            address: data.address,
            propertyName: data.propertyName,
            propertyAddress: data.propertyAddress,
            propertyType: data.propertyType,
        };
        
        const result: any = await signupAndCreateProperty(requestData);

        if (!result.data.success) {
            throw new Error(result.data.error || "Signup failed during cloud function execution.");
        }
        // After successful creation, sign in the user to trigger onAuthStateChanged
        await signInWithEmailAndPassword(auth, data.email, password);
    } catch (error: any) {
        setIsLoadingAuth(false);
        throw error;
    }
  };

  const logout = async () => {
    setIsLoadingAuth(true);
    if(user?.id) {
        const staffDocRef = doc(db, "staff", user.id);
        await updateDoc(staffDocRef, {
            status: 'offline',
            last_active: serverTimestamp()
        });
    }
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
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
