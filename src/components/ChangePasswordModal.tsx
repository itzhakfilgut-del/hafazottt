import React, { useState } from 'react';
import { auth } from '../lib/firebase';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { X, Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { APP_TEXTS as FALLBACK_TEXTS } from '../constants';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const { settings } = useSettings();
  const texts = settings?.texts || FALLBACK_TEXTS;
  
  // Ensure we have the specific texts we need, falling back to constants if missing
  const authTexts = { ...FALLBACK_TEXTS.auth, ...texts.auth };
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError(authTexts.passwordsDontMatch);
      return;
    }

    if (newPassword.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }

    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error('User not logged in');

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);
      
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Close after 2 seconds
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 2000);

    } catch (err: any) {
      console.error('Error changing password:', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError(authTexts.wrongCurrentPassword);
      } else {
        setError('שגיאה בעדכון הסיסמה. נסה שוב מאוחר יותר.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <Lock size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">{authTexts.changePassword}</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-slate-500 mb-2 leading-relaxed">
            {authTexts.changePasswordDescription}
          </p>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-2 text-sm animate-in slide-in-from-top-2">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 border border-green-100 text-green-600 rounded-xl flex items-center gap-2 text-sm animate-in slide-in-from-top-2">
              <CheckCircle2 size={18} />
              {authTexts.changePasswordSuccess}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">{authTexts.currentPassword}</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setError(null);
              }}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">{authTexts.newPassword}</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setError(null);
              }}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">{authTexts.confirmNewPassword}</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError(null);
              }}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all active:scale-[0.98]"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="flex-[2] py-3 bg-primary hover:bg-secondary text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                authTexts.changePasswordBtn
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
