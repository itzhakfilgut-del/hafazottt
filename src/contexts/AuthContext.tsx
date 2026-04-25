import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  yeshiva: string;
  status: 'pending' | 'approved' | 'rejected';
  role: 'user' | 'admin';
  clicks: number;
  candleClicks?: number;
  lastLocation?: { lat: number; lng: number };
  defaultCampaign?: 'tefillin' | 'candles';
  gender?: 'boy' | 'girl';
  phone?: string;
}

interface AuthContextType {
  user: FirebaseUser | null;
  appUser: AppUser | null;
  loading: boolean;
  authError: string | null;
}

const AuthContext = createContext<AuthContextType>({ user: null, appUser: null, loading: true, authError: null });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthError(null);
      if (firebaseUser) {
        const unsubscribeDoc = onSnapshot(
          doc(db, 'users', firebaseUser.uid), 
          (docSnap) => {
             // Let's clear loading state and any previous error
            if (docSnap.exists()) {
              setAppUser({ uid: firebaseUser.uid, ...docSnap.data() } as AppUser);
              setAuthError(null);
            } else {
              setAppUser(null);
              setAuthError('DOC_NOT_FOUND: User document was not found in Firestore.');
            }
            setLoading(false);
          },
          (error) => {
            console.error("Error fetching user data:", error);
            // If permission denied, we still want to stop loading so the user isn't stuck
            setAppUser(null);
            setAuthError(`FIRESTORE_ERROR: ${error.code} - ${error.message}`);
            setLoading(false);
          }
        );
        return () => unsubscribeDoc();
      } else {
        setAppUser(null);
        setLoading(false);
        setAuthError(null);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, appUser, loading, authError }}>
      {children}
    </AuthContext.Provider>
  );
};
