import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_TEXTS } from '../constants';

interface SiteSettings {
  defaultCampaign?: 'tefillin' | 'candles';
  texts: typeof APP_TEXTS;
  theme: {
    primaryColor: string;
    secondaryColor: string;
    logoUrl: string;
    backgroundColor: string;
  };
}

interface SettingsContextType {
  settings: SiteSettings;
  loading: boolean;
  updateSettings: (newSettings: Partial<SiteSettings>) => Promise<void>;
}

const defaultSettings: SiteSettings = {
  defaultCampaign: 'tefillin',
  texts: APP_TEXTS,
  theme: {
    primaryColor: '#2563eb',
    secondaryColor: '#1d4ed8',
    logoUrl: '',
    backgroundColor: '#f8fafc',
  },
};

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  loading: true,
  updateSettings: async () => {},
});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'settings', 'site_config'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as SiteSettings;
          // Deep merge texts to ensure new keys in nested objects are preserved
          const mergedTexts = { ...defaultSettings.texts };
          if (data.texts) {
            Object.keys(data.texts).forEach(key => {
              const k = key as keyof typeof APP_TEXTS;
              if (typeof mergedTexts[k] === 'object' && data.texts[k]) {
                mergedTexts[k] = { ...mergedTexts[k], ...data.texts[k] } as any;
              } else {
                mergedTexts[k] = data.texts[k] as any;
              }
            });
          }

          setSettings({
            ...defaultSettings,
            ...data,
            texts: mergedTexts,
            theme: { ...defaultSettings.theme, ...data.theme },
          });
        } else {
          // Initialize if not exists
          setDoc(doc(db, 'settings', 'site_config'), defaultSettings);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching settings:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const updateSettings = async (newSettings: Partial<SiteSettings>) => {
    const docRef = doc(db, 'settings', 'site_config');
    await setDoc(docRef, { ...settings, ...newSettings }, { merge: true });
  };

  // Apply theme colors to CSS variables
  useEffect(() => {
    if (!loading) {
      document.documentElement.style.setProperty('--primary-color', settings.theme.primaryColor);
      document.documentElement.style.setProperty('--secondary-color', settings.theme.secondaryColor);
      document.documentElement.style.setProperty('--bg-color', settings.theme.backgroundColor);
    }
  }, [settings.theme, loading]);

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};
