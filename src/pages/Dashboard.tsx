import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { auth } from '../lib/firebase';
import { LogOut, Map as MapIcon, Trophy, MousePointerClick, ShieldAlert, Download } from 'lucide-react';
import { cn } from '../lib/utils';
import { APP_TEXTS as FALLBACK_TEXTS } from '../constants';
import Clicker from '../components/Clicker';
import MapView from '../components/Map';
import Leaderboard from '../components/Leaderboard';
import AdminPanel from '../components/AdminPanel';

type Tab = 'clicker' | 'map' | 'leaderboard' | 'admin';

export default function Dashboard() {
  const { appUser } = useAuth();
  const { settings } = useSettings();
  const texts = settings?.texts || FALLBACK_TEXTS;
  const theme = settings?.theme;
  const [activeTab, setActiveTab] = useState<Tab>('clicker');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      // Show the install prompt
      deferredPrompt.prompt();
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      // Fallback for iOS or if already installed
      alert(texts.app.installInstructions);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme?.backgroundColor }} dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {theme?.logoUrl ? (
              <img src={theme.logoUrl} alt="Logo" className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center font-bold text-xl">
                {texts.app.name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="font-bold text-slate-900 leading-tight">{texts.app.name}</h1>
              <p className="text-xs text-slate-500">{texts.app.hello}, {appUser?.name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleInstall}
              className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-primary hover:bg-blue-100 rounded-lg transition-colors text-sm font-medium"
              title={texts.app.installApp}
            >
              <Download size={18} />
              <span className="hidden sm:inline">{texts.app.installApp}</span>
            </button>
            <button
              onClick={() => auth.signOut()}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors text-sm font-medium"
              title={texts.app.logout}
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">{texts.app.logout}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 pb-32 sm:pb-8">
        {/* Tabs - Desktop Only */}
        <div className="hidden sm:flex overflow-x-auto hide-scrollbar mb-8 bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-fit mx-auto">
          <button
            onClick={() => setActiveTab('clicker')}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap",
              activeTab === 'clicker' ? "bg-blue-50 text-primary shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <MousePointerClick size={18} />
            {texts.tabs.clicker}
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap",
              activeTab === 'map' ? "bg-blue-50 text-primary shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <MapIcon size={18} />
            {texts.tabs.map}
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap",
              activeTab === 'leaderboard' ? "bg-blue-50 text-primary shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <Trophy size={18} />
            {texts.tabs.leaderboard}
          </button>
          {appUser?.role === 'admin' && (
            <button
              onClick={() => setActiveTab('admin')}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap",
                activeTab === 'admin' ? "bg-red-50 text-red-700 shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <ShieldAlert size={18} />
              {texts.tabs.admin}
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === 'clicker' && <Clicker />}
          {activeTab === 'map' && <MapView />}
          {activeTab === 'leaderboard' && <Leaderboard />}
          {activeTab === 'admin' && appUser?.role === 'admin' && <AdminPanel />}
        </div>
      </main>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 pb-safe z-40">
        <div className="flex items-center justify-around h-16">
          <button
            onClick={() => setActiveTab('clicker')}
            className={cn(
              "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
              activeTab === 'clicker' ? "text-primary" : "text-slate-400"
            )}
          >
            <MousePointerClick size={20} />
            <span className="text-[10px] font-medium">{texts.tabs.clicker}</span>
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={cn(
              "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
              activeTab === 'map' ? "text-primary" : "text-slate-400"
            )}
          >
            <MapIcon size={20} />
            <span className="text-[10px] font-medium">{texts.tabs.map}</span>
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={cn(
              "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
              activeTab === 'leaderboard' ? "text-primary" : "text-slate-400"
            )}
          >
            <Trophy size={20} />
            <span className="text-[10px] font-medium">{texts.tabs.leaderboard}</span>
          </button>
          {appUser?.role === 'admin' && (
            <button
              onClick={() => setActiveTab('admin')}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                activeTab === 'admin' ? "text-red-600" : "text-slate-400"
              )}
            >
              <ShieldAlert size={20} />
              <span className="text-[10px] font-medium">{texts.tabs.admin}</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}
