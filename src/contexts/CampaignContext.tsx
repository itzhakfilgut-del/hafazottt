import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useSettings } from './SettingsContext';
import { useAuth } from './AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

type CampaignType = 'tefillin' | 'candles';

interface CampaignContextType {
  campaign: CampaignType;
  setCampaign: (c: CampaignType) => void;
  setDefaultCampaign: (c: CampaignType) => Promise<void>;
}

const CampaignContext = createContext<CampaignContextType | undefined>(undefined);

export function CampaignProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const { appUser } = useAuth();
  
  // Initialize from cache or settings
  const [campaign, setCampaignState] = useState<CampaignType>(() => {
    const cached = localStorage.getItem('activeCampaign') as CampaignType;
    return cached || 'tefillin';
  });

  // Sync when settings or user default change initially
  useEffect(() => {
    const defaultCamp = appUser?.defaultCampaign || settings?.defaultCampaign;
    if (defaultCamp && !localStorage.getItem('activeCampaign')) {
      setCampaignState(defaultCamp);
    }
  }, [appUser?.defaultCampaign, settings?.defaultCampaign]);

  const setCampaign = (c: CampaignType) => {
    setCampaignState(c);
    localStorage.setItem('activeCampaign', c);
  };

  const setDefaultCampaign = async (c: CampaignType) => {
    setCampaign(c);
    if (appUser) {
      await updateDoc(doc(db, 'users', appUser.uid), {
        defaultCampaign: c
      });
    }
  };

  return (
    <CampaignContext.Provider value={{ campaign, setCampaign, setDefaultCampaign }}>
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaign() {
  const context = useContext(CampaignContext);
  if (context === undefined) {
    throw new Error('useCampaign must be used within a CampaignProvider');
  }
  return context;
}

