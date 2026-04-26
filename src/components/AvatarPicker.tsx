import React, { useRef, useState } from 'react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Camera, RefreshCw, Upload } from 'lucide-react';

const AVATAR_STYLES = ['adventurer', 'avataaars', 'bottts', 'fun-emoji', 'micah'];

export default function AvatarPicker() {
  const { appUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  if (!appUser) return null;

  const currentAvatar = appUser.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${appUser.name}&backgroundColor=0284c7`;

  const handleGenerateRandom = async () => {
    setIsUpdating(true);
    try {
      const style = AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)];
      const seed = Math.random().toString(36).substring(7);
      const randomUrl = `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
      
      await updateDoc(doc(db, 'users', appUser.uid), {
        photoURL: randomUrl
      });
    } catch (error) {
      console.error("Error setting random avatar:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUpdating(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const result = event.target?.result as string;
        
        // Very basic simple resize using canvas to save storage space
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 150;
          const MAX_HEIGHT = 150;
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
          
          const maxQualityBase64 = canvas.toDataURL('image/jpeg', 0.7);
          
          await updateDoc(doc(db, 'users', appUser.uid), {
            photoURL: maxQualityBase64
          });
          setIsUpdating(false);
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error uploading avatar:", error);
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 bg-white p-4 rounded-xl border border-slate-200">
      <div className="text-sm font-medium text-slate-700 w-full text-right mb-2">תמונת פרופיל</div>
      
      <div className="relative group">
        <img 
          src={currentAvatar} 
          alt="Avatar" 
          className="w-24 h-24 rounded-full object-cover border-4 border-slate-50 shadow-md"
        />
        {isUpdating && (
          <div className="absolute inset-0 bg-white/70 rounded-full flex items-center justify-center backdrop-blur-sm">
            <RefreshCw className="animate-spin text-primary" />
          </div>
        )}
      </div>

      <div className="flex gap-2 w-full mt-2">
        <button
          onClick={handleGenerateRandom}
          disabled={isUpdating}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} />
          <span>אקראי</span>
        </button>
        
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUpdating}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Upload size={16} />
          <span>העלה תמונה</span>
        </button>
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          className="hidden"
        />
      </div>
    </div>
  );
}
