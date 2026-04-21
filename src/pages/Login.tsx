import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { LogIn, Loader2, AlertCircle } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { APP_TEXTS as FALLBACK_TEXTS } from '../constants';

export default function Login() {
  const { settings } = useSettings();
  const texts = settings?.texts || FALLBACK_TEXTS;
  const theme = settings?.theme;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!import.meta.env.VITE_FIREBASE_API_KEY) {
      setError('שגיאה: חסרים נתוני התחברות ל-Firebase. אנא הגדר את משתני הסביבה (Secrets).');
      setLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err: any) {
      console.error("שגיאת התחברות:", err);
      setError(err.message || 'שגיאה בהתחברות');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: theme?.backgroundColor }} dir="rtl">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-primary mb-4">
            <LogIn size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">{texts.auth.loginTitle}</h2>
          <p className="text-slate-500 mt-2">{texts.auth.loginSubtitle}</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{texts.auth.email}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{texts.auth.password}</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
              dir="ltr"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-secondary text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? texts.auth.loginBtnLoading : texts.auth.loginBtn}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          {texts.auth.noAccount}{' '}
          <Link to="/register" className="text-primary hover:underline font-medium">
            {texts.auth.registerHere}
          </Link>
        </div>
      </div>
    </div>
  );
}
