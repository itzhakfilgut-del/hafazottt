import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  yeshiva: string;
  status: 'pending' | 'approved' | 'rejected';
  role: 'user' | 'admin';
  clicks: number;
  lastLocation?: { lat: number; lng: number };
}

interface AuthContextType {
  user: FirebaseUser | null;
  appUser: AppUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, appUser: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const unsubscribeDoc = onSnapshot(
          doc(db, 'users', firebaseUser.uid), 
          (docSnap) => {
            if (docSnap.exists()) {
              setAppUser({ uid: firebaseUser.uid, ...docSnap.data() } as AppUser);
            } else {
              setAppUser(null);
            }
            setLoading(false);
          },
          (error) => {
            console.error("Error fetching user data:", error);
            // If permission denied, we still want to stop loading so the user isn't stuck
            setAppUser(null);
            setLoading(false);
          }
        );
        return () => unsubscribeDoc();
      } else {
        setAppUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, appUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
