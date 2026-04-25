import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserPlus } from 'lucide-react';
import { APP_TEXTS as FALLBACK_TEXTS } from '../constants';
import { useSettings } from '../contexts/SettingsContext';
import { useCampaign } from '../contexts/CampaignContext';

interface Yeshiva {
  id: string;
  name: string;
}

export default function Register() {
  const { settings } = useSettings();
  const { campaign } = useCampaign();
  const texts = settings?.texts || FALLBACK_TEXTS;
  const theme = settings?.theme;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [yeshiva, setYeshiva] = useState('');
  const [gender, setGender] = useState<'boy' | 'girl' | ''>('');
  const [phone, setPhone] = useState('');
  const [availableYeshivas, setAvailableYeshivas] = useState<Yeshiva[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const isTefillin = campaign === 'tefillin';
  
  // Decide yeshiva label based on gender first, then fallback to campaign generic
  const yeshivaLabel = gender === 'boy' ? 'ישיבה' : gender === 'girl' ? 'אולפנה' : (isTefillin ? texts.auth.yeshiva : 'אולפנה/מוסד');
  const yeshivaPlaceholder = gender === 'boy' ? 'בחר ישיבה' : gender === 'girl' ? 'בחר אולפנה' : (isTefillin ? texts.auth.selectYeshiva : 'בחר מוסד');

  useEffect(() => {
    const fetchYeshivas = async () => {
      try {
        const q = query(collection(db, 'yeshivas'));
        const querySnapshot = await getDocs(q);
        const yeshivasList: Yeshiva[] = [];
        querySnapshot.forEach((doc) => {
          yeshivasList.push({ id: doc.id, name: doc.data().name });
        });
        yeshivasList.sort((a, b) => a.name.localeCompare(b.name, 'he'));
        setAvailableYeshivas(yeshivasList);
      } catch (err) {
        console.error("Error fetching yeshivas:", err);
      }
    };
    fetchYeshivas();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!gender) {
      setError('נא לבחור מין (בן/בת)');
      return;
    }
    
    setLoading(true);
    
    if (!import.meta.env.VITE_FIREBASE_API_KEY) {
      setError('שגיאה: חסרים נתוני התחברות ל-Firebase. אנא הגדר את משתני הסביבה (Secrets).');
      setLoading(false);
      return;
    }

    try {
      console.log("מתחיל הרשמה...");
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("משתמש נוצר ב-Auth:", user.uid);
      
      try {
        // Add a timeout to the Firestore write to prevent infinite hanging
        const writePromise = setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          name,
          yeshiva,
          gender,
          phone,
          status: 'pending',
          role: 'user',
          clicks: 0,
          createdAt: new Date().toISOString(),
          defaultCampaign: gender === 'girl' ? 'candles' : 'tefillin'
        });
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Timeout: Firestore write took too long. Check your Firebase Security Rules.")), 10000)
        );
        
        await Promise.race([writePromise, timeoutPromise]);
        console.log("משתמש נשמר ב-Firestore");
      } catch (firestoreError: any) {
        console.error("שגיאה בשמירה ל-Firestore:", firestoreError);
        // Even if Firestore fails, the auth user was created. 
        // We should show the error but maybe still redirect or let them know.
        throw new Error(`המשתמש נוצר אך נתוניו לא נשמרו במסד הנתונים: ${firestoreError.message}`);
      }

      navigate('/');
    } catch (err: any) {
      console.error("שגיאת הרשמה:", err);
      setError(err.message || 'שגיאה בהרשמה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-8" style={{ backgroundColor: theme?.backgroundColor }} dir="rtl">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-primary mb-4">
            <UserPlus size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">{texts.auth.registerTitle}</h2>
          <p className="text-slate-500 mt-2">{texts.auth.registerSubtitle}</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{texts.auth.fullName}</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">אני:</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setGender('boy')}
                className={`py-2 px-4 rounded-xl border transition-all ${gender === 'boy' ? 'bg-primary text-white border-primary' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}
              >
                בן
              </button>
              <button
                type="button"
                onClick={() => setGender('girl')}
                className={`py-2 px-4 rounded-xl border transition-all ${gender === 'girl' ? 'bg-orange-500 text-white border-orange-500' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}
              >
                בת
              </button>
            </div>
          </div>

          {gender && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{yeshivaLabel}</label>
              <select
                required
                value={yeshiva}
                onChange={(e) => setYeshiva(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-white"
              >
                <option value="" disabled>{yeshivaPlaceholder}</option>
                {availableYeshivas.map((y) => (
                  <option key={y.id} value={y.name}>{y.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">מספר טלפון</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
              dir="ltr"
              placeholder="05X-XXXXXXX"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{texts.auth.email} (כתובת מייל)</label>
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
            className="w-full mt-2 bg-primary hover:bg-secondary text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? texts.auth.registerBtnLoading : texts.auth.registerBtn}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          {texts.auth.hasAccount}{' '}
          <Link to="/login" className="text-primary hover:underline font-medium">
            {texts.auth.loginHere}
          </Link>
        </div>
      </div>
    </div>
  );
}
