import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useCampaign } from '../contexts/CampaignContext';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { LogOut, Map as MapIcon, Trophy, MousePointerClick, ShieldAlert, Navigation, Settings, X, MessageCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { APP_TEXTS as FALLBACK_TEXTS } from '../constants';
import Clicker from '../components/Clicker';
import MapView from '../components/Map';
import Leaderboard from '../components/Leaderboard';
import AdminPanel from '../components/AdminPanel';
import MyClicks from '../components/MyClicks';
import ChatPanel from '../components/ChatPanel';

import AvatarPicker from '../components/AvatarPicker';

type Tab = 'clicker' | 'map' | 'myclicks' | 'leaderboard' | 'admin';

export default function Dashboard() {
  const { appUser } = useAuth();
  const { settings } = useSettings();
  const { campaign, setCampaign, setDefaultCampaign } = useCampaign();
  const texts = settings?.texts || FALLBACK_TEXTS;
  const theme = settings?.theme;
  const [activeTab, setActiveTab] = useState<Tab>('clicker');
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [unreadPrivateCount, setUnreadPrivateCount] = useState(0);
  const [hasGlobalUnread, setHasGlobalUnread] = useState(false);

  useEffect(() => {
    if (!appUser) return;
    
    const unsubMeta = onSnapshot(doc(db, 'user_chats', appUser.uid), (docSnap) => {
      let count = 0;
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.unreadPrivate) {
          Object.values(data.unreadPrivate).forEach(isUnread => {
            if (isUnread) count++;
          });
        }
      }
      setUnreadPrivateCount(count);
    });

    const qGlobal = query(collection(db, 'chat_messages'), orderBy('timestamp', 'desc'), limit(1));
    const unsubGlobal = onSnapshot(qGlobal, (snapshot) => {
      let isUnread = false;
      snapshot.forEach(msgDoc => {
        const data = msgDoc.data();
        if (data.uid !== appUser.uid && (!data.readBy || !data.readBy.includes(appUser.uid))) {
          isUnread = true;
        }
      });
      setHasGlobalUnread(isUnread);
    });

    return () => {
      unsubMeta();
      unsubGlobal();
    };
  }, [appUser]);

  const hasUnreadChats = unreadPrivateCount > 0 || hasGlobalUnread;

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme?.backgroundColor }} dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-auto py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {theme?.logoUrl ? (
              <img src={theme.logoUrl} alt="Logo" className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center font-bold text-xl">
                {texts.app.name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="font-bold text-slate-900 leading-tight flex items-center gap-2">
                {texts.app.name}
              </h1>
              <p className="text-xs text-slate-500">{texts.app.hello}, {appUser?.name}</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
            {/* Campaign Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 select-none">
              <button
                onClick={() => setCampaign('tefillin')}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200",
                  campaign === 'tefillin' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                )}
              >
                תפילין
              </button>
              <button
                onClick={() => setCampaign('candles')}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200",
                  campaign === 'candles' ? "bg-white text-orange-600 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                )}
              >
                נרות שבת
              </button>
              <button
                onClick={() => setCampaign('other')}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200",
                  campaign === 'other' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                )}
              >
                אחר
              </button>
            </div>
          
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowUserSettings(true)}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium"
                title="הגדרות אישיות"
              >
                {appUser?.photoURL ? (
                  <img src={appUser.photoURL} alt="Avatar" className="w-6 h-6 rounded-full object-cover shadow-sm" />
                ) : (
                  <Settings size={18} />
                )}
                <span className="hidden sm:inline">הגדרות אישיות</span>
              </button>
              <button
                onClick={() => setShowChat(true)}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-slate-100 text-slate-700 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors text-sm font-medium relative"
                title="צ'אט"
              >
                <div className="relative">
                  <MessageCircle size={18} />
                  {hasUnreadChats && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 border-2 border-slate-100 rounded-full"></span>
                  )}
                </div>
                <span className="hidden sm:inline">צ'אט</span>
              </button>
              <button
                onClick={() => auth.signOut()}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors text-sm font-medium"
                title={texts.app.logout}
              >
                <LogOut size={18} />
                <span className="hidden sm:inline">{texts.app.logout}</span>
              </button>
            </div>
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
            onClick={() => setActiveTab('myclicks')}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap",
              activeTab === 'myclicks' ? "bg-blue-50 text-primary shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <Navigation size={18} />
            הלחיצות שלי
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
          {activeTab === 'myclicks' && <MyClicks />}
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
            onClick={() => setActiveTab('myclicks')}
            className={cn(
              "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
              activeTab === 'myclicks' ? "text-primary" : "text-slate-400"
            )}
          >
            <Navigation size={20} />
            <span className="text-[10px] font-medium">הלחיצות שלי</span>
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

      {/* User Settings Modal */}
      {showUserSettings && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200" dir="rtl">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Settings size={18} className="text-primary" />
                הגדרות אישיות
              </h3>
              <button 
                onClick={() => setShowUserSettings(false)}
                className="text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-lg p-1 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="space-y-6">
                <AvatarPicker />
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">בחירת מסך ברירת מחדל:</label>
                  <p className="text-xs text-slate-500 -mt-2 mb-3">מסך זה יוצג אוטומטית בכל כניסה לאפליקציה.</p>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setDefaultCampaign('tefillin')}
                      className={cn(
                        "py-3 px-2 rounded-xl border-2 font-medium transition-all text-xs sm:text-sm",
                        (appUser?.defaultCampaign === 'tefillin' || (!appUser?.defaultCampaign && settings?.defaultCampaign === 'tefillin'))
                          ? "border-primary bg-primary text-white" 
                          : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      תפילין
                    </button>
                    <button
                      onClick={() => setDefaultCampaign('candles')}
                      className={cn(
                        "py-3 px-2 rounded-xl border-2 font-medium transition-all text-xs sm:text-sm",
                        (appUser?.defaultCampaign === 'candles' || (!appUser?.defaultCampaign && settings?.defaultCampaign === 'candles'))
                          ? "border-orange-500 bg-orange-500 text-white" 
                          : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      נרות שבת
                    </button>
                    <button
                      onClick={() => setDefaultCampaign('other')}
                      className={cn(
                        "py-3 px-2 rounded-xl border-2 font-medium transition-all text-xs sm:text-sm",
                        (appUser?.defaultCampaign === 'other')
                          ? "border-emerald-500 bg-emerald-500 text-white" 
                          : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      אחר
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowUserSettings(false)}
                className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-xl transition-colors"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Panel */}
      {showChat && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-end">
          <div className="absolute inset-0" onClick={() => setShowChat(false)} />
          <div className="relative h-full w-full sm:w-96">
            <ChatPanel onClose={() => setShowChat(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
