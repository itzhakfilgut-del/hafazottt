import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { CampaignProvider } from './contexts/CampaignContext';
import { APP_TEXTS as FALLBACK_TEXTS } from './constants';
import Login from './pages/Login';
import Register from './pages/Register';
import Waiting from './pages/Waiting';
import Dashboard from './pages/Dashboard';
import WhatsAppBubble from './components/WhatsAppBubble';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, appUser, loading: authLoading, authError } = useAuth();
  const { settings, loading: settingsLoading } = useSettings();
  const [showError, setShowError] = React.useState(false);

  const texts = settings?.texts || FALLBACK_TEXTS;

  React.useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (user && !appUser && !authLoading && !settingsLoading) {
      // Wait 3 seconds before showing the error to allow for Firestore sync
      timeout = setTimeout(() => {
        setShowError(true);
      }, 3000);
    } else {
      setShowError(false);
    }
    return () => clearTimeout(timeout);
  }, [user, appUser, authLoading, settingsLoading]);

  if (authLoading || settingsLoading || (user && !appUser && !showError)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <div className="text-slate-600 font-medium">{texts.auth.loading}</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!appUser && showError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center p-4" dir="rtl">
        <h2 className="text-red-600 font-bold text-2xl mb-4">{texts.auth.missingDataTitle}</h2>
        <p className="text-slate-700 mb-2">{texts.auth.missingDataDesc1}</p>
        <p className="text-slate-700 mb-6">{texts.auth.missingDataDesc2}</p>
        {authError && (
          <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl text-left border border-red-200 w-full max-w-md font-mono mb-6" dir="ltr">
            <span className="font-bold block mb-1">Debug Info:</span>
            {authError}
          </div>
        )}
        <button 
          onClick={() => {
            import('./lib/firebase').then(({ auth }) => auth.signOut());
          }} 
          className="px-6 py-2 bg-primary hover:bg-secondary text-white rounded-xl font-medium transition-colors"
        >
          {texts.auth.logoutAndRetry}
        </button>
      </div>
    );
  }

  if (appUser.status === 'pending') {
    return <Navigate to="/waiting" />;
  }
  
  if (appUser.status === 'rejected') {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-red-600 font-bold text-xl" dir="rtl">{texts.auth.rejectedTitle}</div>;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <CampaignProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/waiting" element={<Waiting />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
            </Routes>
            <WhatsAppBubble />
          </Router>
        </CampaignProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}

