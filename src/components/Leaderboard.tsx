import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, increment, deleteDoc, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppUser, useAuth } from '../contexts/AuthContext';
import { useCampaign } from '../contexts/CampaignContext';
import { useSettings } from '../contexts/SettingsContext';
import { Trophy, Medal, Plus, Minus, Trash2, Lock } from 'lucide-react';
import { APP_TEXTS as FALLBACK_TEXTS } from '../constants';
import ChangePasswordModal from './ChangePasswordModal';

export default function Leaderboard() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const { appUser } = useAuth();
  const { settings } = useSettings();
  const { campaign } = useCampaign();
  const texts = settings?.texts || FALLBACK_TEXTS;
  const theme = settings?.theme;
  const isAdmin = appUser?.role === 'admin';
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const isTefillin = campaign === 'tefillin';
  const sortField = isTefillin ? 'clicks' : 'candleClicks';

  useEffect(() => {
    // You must create a composite index for candleClicks on Firebase if you orderBy it, 
    // or just fetch all and sort client side. Since we sorting by clicks required an index, 
    // we'll do the same client-side sorting here to be safe and avoid needing indexes.
    
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        const newUsers: AppUser[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as AppUser;
          const userCount = isTefillin ? (data.clicks || 0) : (data.candleClicks || 0);
          
          if (data.status === 'approved' && userCount > 0) {
            newUsers.push({ ...data, uid: doc.id });
          }
        });
        
        // Sort client side based on campaign
        newUsers.sort((a, b) => {
          const aCount = isTefillin ? (a.clicks || 0) : (a.candleClicks || 0);
          const bCount = isTefillin ? (b.clicks || 0) : (b.candleClicks || 0);
          return bCount - aCount;
        });
        
        setUsers(newUsers);
      },
      (error) => {
        console.error("Error fetching leaderboard:", error);
      }
    );

    return () => unsubscribe();
  }, [campaign, isTefillin]);

  const handleUpdateClicks = async (uid: string, amount: number, currentClicks: number) => {
    if (currentClicks + amount < 0) return;
    try {
      if (amount < 0) {
        // If decrementing, delete the most recent click document without needing a composite index
        const targetCollection = isTefillin ? 'clicks' : 'candle_clicks';
        const q = query(
          collection(db, targetCollection),
          where('uid', '==', uid)
        );
        const snapshot = await getDocs(q);
        
        // Sort client-side
        const sortedDocs = snapshot.docs.sort((a, b) => {
          const timeA = new Date(a.data().timestamp || 0).getTime();
          const timeB = new Date(b.data().timestamp || 0).getTime();
          return timeB - timeA; // Descending
        });
        
        const docsToDelete = sortedDocs.slice(0, Math.abs(amount));
        const deletePromises = docsToDelete.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      }

      const updateField = isTefillin ? 'clicks' : 'candleClicks';
      await updateDoc(doc(db, 'users', uid), {
        [updateField]: increment(amount)
      });
    } catch (error) {
      console.error("Error updating clicks:", error);
    }
  };

  const handleDeleteUser = async (uid: string, name: string) => {
    if (window.confirm(`${texts.admin.actions.confirmDelete} ${name}?`)) {
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (error) {
        console.error("Error deleting user:", error);
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
        <Trophy className="text-amber-500" size={24} />
        <h2 className="text-xl font-bold text-slate-900">{texts.leaderboard.title}</h2>
      </div>
      
      <div className="divide-y divide-slate-100">
        {users.map((user, index) => {
          const userCount = isTefillin ? (user.clicks || 0) : (user.candleClicks || 0);
          return (
            <div key={user.uid} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 relative">
                  {index === 0 && <Medal className="absolute -top-2 -right-2 text-amber-400" size={20} fill="currentColor" />}
                  {index === 1 && <Medal className="absolute -top-2 -right-2 text-slate-400" size={20} fill="currentColor" />}
                  {index === 2 && <Medal className="absolute -top-2 -right-2 text-amber-700" size={20} fill="currentColor" />}
                  {index + 1}
                </div>
                <div>
                  <div className="font-bold text-slate-900">{user.name}</div>
                  <div className="text-sm text-slate-500">{user.yeshiva}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className={`text-xl font-black px-4 py-1 rounded-full ${isTefillin ? 'text-blue-600 bg-blue-50' : 'text-amber-600 bg-amber-50'}`}>
                  {userCount}
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1 border-r pr-4 border-slate-200">
                    <button onClick={() => handleUpdateClicks(user.uid, 1, userCount)} className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors" title={texts.admin.actions.addClick}>
                      <Plus size={16} />
                    </button>
                    <button onClick={() => handleUpdateClicks(user.uid, -1, userCount)} className="p-1.5 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors" title={texts.admin.actions.removeClick}>
                      <Minus size={16} />
                    </button>
                    <button onClick={() => handleDeleteUser(user.uid, user.name)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title={texts.admin.actions.delete}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {users.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            {texts.leaderboard.empty}
          </div>
        )}
      </div>

      <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-center">
        <button
          onClick={() => setIsChangePasswordOpen(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all font-medium shadow-sm active:scale-[0.98]"
        >
          <Lock size={18} className="text-slate-400" />
          {texts.auth.changePassword}
        </button>
      </div>

      <ChangePasswordModal 
        isOpen={isChangePasswordOpen} 
        onClose={() => setIsChangePasswordOpen(false)} 
      />
    </div>
  );
}
