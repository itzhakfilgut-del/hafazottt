import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Trash2, MapPin, Clock, Navigation } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { APP_TEXTS as FALLBACK_TEXTS } from '../constants';

interface ClickRecord {
  id: string;
  uid: string;
  name: string;
  yeshiva: string;
  location: { lat: number; lng: number };
  timestamp: string;
}

export default function MyClicks() {
  const [myClicks, setMyClicks] = useState<ClickRecord[]>([]);
  const { appUser } = useAuth();
  const { settings } = useSettings();
  const texts = settings?.texts || FALLBACK_TEXTS;
  const theme = settings?.theme;
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!appUser) return;

    // Fetch clicks specific to the logged-in user without orderBy to avoid needing a composite index
    const q = query(
      collection(db, 'clicks'),
      where('uid', '==', appUser.uid)
    );

    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        const records: ClickRecord[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.location && data.location.lat && data.location.lng) {
            records.push({
              id: doc.id,
              uid: data.uid,
              name: data.name,
              yeshiva: data.yeshiva,
              location: data.location,
              timestamp: data.timestamp || new Date().toISOString()
            });
          }
        });
        
        // Client-side sorting (newest first)
        records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        setMyClicks(records);
      },
      (error) => {
        console.error("Error fetching user clicks:", error);
      }
    );

    return () => unsubscribe();
  }, [appUser]);

  const handleDeleteClick = async (record: ClickRecord) => {
    setIsDeleting(record.id);
    try {
      // 1. Delete the click record itself
      await deleteDoc(doc(db, 'clicks', record.id));
      
      // 2. Decrement the user's total clicks
      await updateDoc(doc(db, 'users', record.uid), {
        clicks: increment(-1)
      });
    } catch (error) {
      console.error("Error deleting click:", error);
    } finally {
      setIsDeleting(null);
    }
  };

  const getGoogleMapsUrl = (lat: number, lng: number) => {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
        <Navigation className="text-primary" size={24} />
        <h2 className="text-xl font-bold text-slate-900">הלחיצות שלי</h2>
      </div>
      
      <div className="divide-y divide-slate-100">
        {myClicks.map((record) => (
          <div key={record.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 transition-colors gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                <MapPin size={20} />
              </div>
              <div className="text-right">
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <Clock size={14} className="text-slate-400" />
                  <span dir="ltr">{new Date(record.timestamp).toLocaleString('he-IL')}</span>
                </div>
                <a 
                  href={getGoogleMapsUrl(record.location.lat, record.location.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-500 hover:text-blue-700 hover:underline mt-1 inline-block"
                >
                  הצג במפה ({record.location.lat.toFixed(4)}, {record.location.lng.toFixed(4)})
                </a>
              </div>
            </div>
            
            <button
              onClick={() => handleDeleteClick(record)}
              disabled={isDeleting === record.id}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg transition-colors text-sm font-medium self-end sm:self-auto disabled:opacity-50"
            >
              <Trash2 size={16} />
              מחק
            </button>
          </div>
        ))}
        
        {myClicks.length === 0 && (
          <div className="p-12 text-center flex flex-col items-center justify-center text-slate-500">
            <MapPin size={48} className="text-slate-200 mb-4" />
            <h3 className="text-lg font-bold text-slate-700 mb-2">אין היסטורית לחיצות</h3>
            <p>עדיין לא נרשמו לחיצות עם מיקום מוגדר.</p>
          </div>
        )}
      </div>
    </div>
  );
}
