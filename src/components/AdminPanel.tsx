import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, addDoc, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppUser } from '../contexts/AuthContext';
import { Check, X, Trash2, Edit2, Shield, ShieldAlert, Plus, Building2, Settings, Palette, Type as TypeIcon, Upload, Loader2 } from 'lucide-react';
import { APP_TEXTS as FALLBACK_TEXTS } from '../constants';
import { useSettings } from '../contexts/SettingsContext';

interface Yeshiva {
  id: string;
  name: string;
}

const TextEditor = ({ obj, path, onChange }: { obj: any, path: string[], onChange: (path: string[], value: string) => void }) => {
  return (
    <div className="space-y-4">
      {Object.entries(obj).map(([key, value]) => {
        const currentPath = [...path, key];
        if (typeof value === 'object' && value !== null) {
          return (
            <div key={key} className="border-l-2 border-slate-200 pr-4 mt-4">
              <h4 className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider">{key}</h4>
              <TextEditor obj={value} path={currentPath} onChange={onChange} />
            </div>
          );
        }
        return (
          <div key={key} className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">{key}</label>
            <textarea
              value={value as string}
              onChange={(e) => onChange(currentPath, e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none min-h-[40px]"
              rows={1}
              style={{ height: 'auto' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = target.scrollHeight + 'px';
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

export default function AdminPanel() {
  const { settings, updateSettings } = useSettings();
  const texts = settings?.texts || FALLBACK_TEXTS;
  const [users, setUsers] = useState<AppUser[]>([]);
  const [yeshivas, setYeshivas] = useState<Yeshiva[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', yeshiva: '', clicks: 0 });
  const [newYeshivaName, setNewYeshivaName] = useState('');
  
  const [activeAdminTab, setActiveAdminTab] = useState<'users' | 'yeshivas' | 'settings'>('users');
  const [tempSettings, setTempSettings] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setTempSettings(settings);
  }, [settings]);

  const handleTextChange = (path: string[], value: string) => {
    setTempSettings(prev => {
      const newTexts = JSON.parse(JSON.stringify(prev.texts));
      let current = newTexts;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
      return { ...prev, texts: newTexts };
    });
  };

  const handleThemeChange = (key: string, value: string) => {
    setTempSettings(prev => ({
      ...prev,
      theme: { ...prev.theme, [key]: value }
    }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      
      // Create an image to check dimensions and resize if needed
      const img = new Image();
      img.src = base64String;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Get the resized base64 string
        const resizedBase64 = canvas.toDataURL('image/png', 0.8);
        
        if (resizedBase64.length > 800000) { // Still too large for Firestore (approx 600KB)
          alert('התמונה גדולה מדי גם לאחר כיווץ. אנא בחר תמונה קטנה יותר.');
          setIsUploading(false);
          return;
        }

        handleThemeChange('logoUrl', resizedBase64);
        setIsUploading(false);
        e.target.value = '';
      };
      img.onerror = () => {
        alert('שגיאה בעיבוד התמונה');
        setIsUploading(false);
      };
    };
    reader.onerror = () => {
      alert('שגיאה בקריאת הקובץ');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const saveSettings = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await updateSettings(tempSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
      alert('שגיאה בשמירת ההגדרות');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const qUsers = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(
      qUsers, 
      (snapshot) => {
        const newUsers: AppUser[] = [];
        snapshot.forEach((doc) => {
          newUsers.push({ ...doc.data(), uid: doc.id } as AppUser);
        });
        setUsers(newUsers);
      },
      (error) => {
        console.error("Error fetching users for admin panel:", error);
      }
    );

    const qYeshivas = query(collection(db, 'yeshivas'));
    const unsubscribeYeshivas = onSnapshot(
      qYeshivas,
      (snapshot) => {
        const newYeshivas: Yeshiva[] = [];
        snapshot.forEach((doc) => {
          newYeshivas.push({ id: doc.id, name: doc.data().name });
        });
        // Sort alphabetically
        newYeshivas.sort((a, b) => a.name.localeCompare(b.name, 'he'));
        setYeshivas(newYeshivas);
      },
      (error) => {
        console.error("Error fetching yeshivas:", error);
      }
    );

    return () => {
      unsubscribeUsers();
      unsubscribeYeshivas();
    };
  }, []);

  const handleStatusChange = async (uid: string, status: 'approved' | 'rejected') => {
    await updateDoc(doc(db, 'users', uid), { status });
  };

  const handleRoleChange = async (uid: string, role: 'admin' | 'user') => {
    await updateDoc(doc(db, 'users', uid), { role });
  };

  const handleDelete = async (uid: string) => {
    if (window.confirm(texts.admin.actions.confirmDelete)) {
      await deleteDoc(doc(db, 'users', uid));
    }
  };

  const startEdit = (user: AppUser) => {
    setEditingId(user.uid);
    setEditForm({ name: user.name, yeshiva: user.yeshiva, clicks: user.clicks || 0 });
  };

  const saveEdit = async (uid: string) => {
    const user = users.find(u => u.uid === uid);
    if (!user) return;

    const newClicks = Number(editForm.clicks);
    const oldClicks = user.clicks || 0;

    const updateData: any = {
      name: editForm.name,
      yeshiva: editForm.yeshiva,
      clicks: newClicks
    };

    // If clicks are reduced, delete the most recent click documents
    if (newClicks < oldClicks) {
      try {
        const diff = oldClicks - newClicks;
        const q = query(
          collection(db, 'clicks'),
          where('uid', '==', uid),
          orderBy('timestamp', 'desc'),
          limit(diff)
        );
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      } catch (error) {
        console.error("Error deleting click records:", error);
      }
    }

    // If clicks are reset to 0, also clear lastLocation
    if (newClicks === 0) {
      updateData.lastLocation = { lat: 0, lng: 0 };
    }

    await updateDoc(doc(db, 'users', uid), updateData);
    setEditingId(null);
  };

  const handleAddYeshiva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newYeshivaName.trim()) return;
    try {
      await addDoc(collection(db, 'yeshivas'), { name: newYeshivaName.trim() });
      setNewYeshivaName('');
    } catch (error) {
      console.error("Error adding yeshiva:", error);
    }
  };

  const handleDeleteYeshiva = async (id: string, name: string) => {
    if (window.confirm(`האם אתה בטוח שברצונך למחוק את הישיבה "${name}"?`)) {
      try {
        await deleteDoc(doc(db, 'yeshivas', id));
      } catch (error) {
        console.error("Error deleting yeshiva:", error);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin Tabs */}
      <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-fit">
        <button
          onClick={() => setActiveAdminTab('users')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeAdminTab === 'users' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          {texts.admin.title}
        </button>
        <button
          onClick={() => setActiveAdminTab('yeshivas')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeAdminTab === 'yeshivas' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          {texts.admin.yeshivasTitle}
        </button>
        <button
          onClick={() => setActiveAdminTab('settings')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeAdminTab === 'settings' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          הגדרות אתר
        </button>
      </div>

      {activeAdminTab === 'yeshivas' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
            <Building2 className="text-primary" size={24} />
            <h2 className="text-xl font-bold text-slate-900">{texts.admin.yeshivasTitle}</h2>
          </div>
          <div className="p-6">
            <form onSubmit={handleAddYeshiva} className="flex gap-3 mb-6">
              <input
                type="text"
                value={newYeshivaName}
                onChange={(e) => setNewYeshivaName(e.target.value)}
                placeholder={texts.admin.addYeshivaPlaceholder}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
              />
              <button
                type="submit"
                disabled={!newYeshivaName.trim()}
                className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-secondary text-white font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                <Plus size={18} />
                {texts.admin.addYeshiva}
              </button>
            </form>
            
            <div className="flex flex-wrap gap-2">
              {yeshivas.map((yeshiva) => (
                <div key={yeshiva.id} className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                  <span className="text-slate-700 font-medium">{yeshiva.name}</span>
                  <button
                    onClick={() => handleDeleteYeshiva(yeshiva.id, yeshiva.name)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                    title="מחק ישיבה"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              {yeshivas.length === 0 && (
                <div className="text-slate-500 text-sm">אין ישיבות במערכת</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeAdminTab === 'users' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
            <ShieldAlert className="text-red-500" size={24} />
            <h2 className="text-xl font-bold text-slate-900">{texts.admin.title}</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
                <tr>
                  <th className="p-4 font-medium">{texts.admin.columns.name}</th>
                  <th className="p-4 font-medium">{texts.admin.columns.email}</th>
                  <th className="p-4 font-medium">{texts.admin.columns.yeshiva}</th>
                  <th className="p-4 font-medium">לחיצות</th>
                  <th className="p-4 font-medium">{texts.admin.columns.status}</th>
                  <th className="p-4 font-medium">תפקיד</th>
                  <th className="p-4 font-medium">{texts.admin.columns.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.uid} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      {editingId === user.uid ? (
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="border rounded px-2 py-1 w-full"
                        />
                      ) : (
                        <span className="font-medium text-slate-900">{user.name}</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-500" dir="ltr">{user.email}</td>
                    <td className="p-4">
                      {editingId === user.uid ? (
                        <input
                          type="text"
                          value={editForm.yeshiva}
                          onChange={(e) => setEditForm({ ...editForm, yeshiva: e.target.value })}
                          className="border rounded px-2 py-1 w-full"
                        />
                      ) : (
                        <span className="text-slate-600">{user.yeshiva}</span>
                      )}
                    </td>
                    <td className="p-4">
                      {editingId === user.uid ? (
                        <input
                          type="number"
                          value={editForm.clicks}
                          onChange={(e) => setEditForm({ ...editForm, clicks: parseInt(e.target.value) || 0 })}
                          className="border rounded px-2 py-1 w-20"
                        />
                      ) : (
                        <span className="font-bold text-primary">{user.clicks || 0}</span>
                      )}
                    </td>
                    <td className="p-4">
                      {user.status === 'pending' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          {texts.admin.status.pending}
                        </span>
                      )}
                      {user.status === 'approved' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {texts.admin.status.approved}
                        </span>
                      )}
                      {user.status === 'rejected' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {texts.admin.status.rejected}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.uid, e.target.value as 'admin' | 'user')}
                        className="bg-transparent border border-slate-200 rounded px-2 py-1 text-sm outline-none focus:border-primary"
                      >
                        <option value="user">משתמש</option>
                        <option value="admin">מנהל</option>
                      </select>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {user.status === 'pending' && (
                          <>
                            <button onClick={() => handleStatusChange(user.uid, 'approved')} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title={texts.admin.actions.approve}>
                              <Check size={18} />
                            </button>
                            <button onClick={() => handleStatusChange(user.uid, 'rejected')} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title={texts.admin.actions.reject}>
                              <X size={18} />
                            </button>
                          </>
                        )}
                        
                        {editingId === user.uid ? (
                          <button onClick={() => saveEdit(user.uid)} className="p-1.5 text-primary hover:bg-blue-50 rounded-lg transition-colors" title="שמור">
                            <Check size={18} />
                          </button>
                        ) : (
                          <button onClick={() => startEdit(user)} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="ערוך">
                            <Edit2 size={18} />
                          </button>
                        )}
                        
                        <button onClick={() => handleDelete(user.uid)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title={texts.admin.actions.delete}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      אין משתמשים במערכת
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeAdminTab === 'settings' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="text-primary" size={24} />
              <h2 className="text-xl font-bold text-slate-900">הגדרות אתר</h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={saveSettings}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-secondary text-white font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                {isSaving ? 'שומר...' : 'שמור שינויים'}
              </button>
              {saveSuccess && (
                <span className="text-green-600 font-medium flex items-center gap-1 animate-in fade-in zoom-in duration-300">
                  <Check size={18} />
                  נשמר בהצלחה!
                </span>
              )}
            </div>
          </div>
          
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Theme Settings */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-slate-900 font-bold border-b pb-2">
                <Palette size={20} />
                <h3>עיצוב וצבעים</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">צבע ראשי</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={tempSettings.theme.primaryColor}
                      onChange={(e) => handleThemeChange('primaryColor', e.target.value)}
                      className="w-10 h-10 rounded border border-slate-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={tempSettings.theme.primaryColor}
                      onChange={(e) => handleThemeChange('primaryColor', e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">צבע משני</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={tempSettings.theme.secondaryColor}
                      onChange={(e) => handleThemeChange('secondaryColor', e.target.value)}
                      className="w-10 h-10 rounded border border-slate-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={tempSettings.theme.secondaryColor}
                      onChange={(e) => handleThemeChange('secondaryColor', e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">צבע רקע</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={tempSettings.theme.backgroundColor}
                      onChange={(e) => handleThemeChange('backgroundColor', e.target.value)}
                      className="w-10 h-10 rounded border border-slate-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={tempSettings.theme.backgroundColor}
                      onChange={(e) => handleThemeChange('backgroundColor', e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">לוגו האתר</label>
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tempSettings.theme.logoUrl.startsWith('data:') ? 'תמונה הועלתה (Base64)' : tempSettings.theme.logoUrl}
                        onChange={(e) => handleThemeChange('logoUrl', e.target.value)}
                        placeholder="הזן כתובת URL או העלה קובץ..."
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                      <label className={`flex items-center justify-center px-4 py-2 rounded-lg cursor-pointer transition-colors border border-slate-200 ${isUploading ? 'bg-slate-50 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                        {isUploading ? (
                          <Loader2 size={18} className="ml-2 animate-spin" />
                        ) : (
                          <Upload size={18} className="ml-2" />
                        )}
                        <span className="text-sm font-medium">{isUploading ? 'מעלה...' : 'העלה'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          disabled={isUploading}
                          className="hidden"
                        />
                      </label>
                    </div>
                    {tempSettings.theme.logoUrl && (
                      <div className="relative w-24 h-24 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center p-2 group">
                        <img 
                          src={tempSettings.theme.logoUrl} 
                          alt="Logo Preview" 
                          className="max-w-full max-h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                        <button 
                          onClick={() => handleThemeChange('logoUrl', '')}
                          className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          title="הסר לוגו"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="text-sm font-bold text-slate-700 mb-2">תצוגה מקדימה</h4>
                <div className="flex gap-2">
                  <button className="px-4 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: tempSettings.theme.primaryColor }}>כפתור ראשי</button>
                  <button className="px-4 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: tempSettings.theme.secondaryColor }}>כפתור משני</button>
                </div>
              </div>
            </div>

            {/* Text Settings */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-slate-900 font-bold border-b pb-2">
                <TypeIcon size={20} />
                <h3>טקסטים באתר</h3>
              </div>
              
              <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                <TextEditor obj={tempSettings.texts} path={[]} onChange={handleTextChange} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
