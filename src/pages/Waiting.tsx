import React from 'react';
import { Clock, LogOut } from 'lucide-react';
import { auth } from '../lib/firebase';
import { useSettings } from '../contexts/SettingsContext';
import { APP_TEXTS as FALLBACK_TEXTS } from '../constants';

export default function Waiting() {
  const { settings } = useSettings();
  const texts = settings?.texts || FALLBACK_TEXTS;
  const theme = settings?.theme;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: theme?.backgroundColor }} dir="rtl">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 text-amber-600 mb-6">
          <Clock size={40} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">{texts.waiting.title}</h2>
        <p className="text-slate-600 mb-8">
          {texts.waiting.message}
        </p>
        <button
          onClick={() => auth.signOut()}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors"
        >
          <LogOut size={18} />
          {texts.app.logout}
        </button>
      </div>
    </div>
  );
}
