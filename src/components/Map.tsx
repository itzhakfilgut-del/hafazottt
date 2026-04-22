import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { APP_TEXTS as FALLBACK_TEXTS } from '../constants';
import { Trash2 } from 'lucide-react';

const getColorForYeshiva = (yeshivaName: string) => {
  if (!yeshivaName) return '#3b82f6'; // default blue
  
  // Special case for Ramat Gan as requested
  if (yeshivaName.includes('רמת גן')) return '#22c55e'; // green
  
  // Hash function for other yeshivas
  let hash = 0;
  for (let i = 0; i < yeshivaName.length; i++) {
    hash = yeshivaName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Nice vibrant colors suitable for map markers
  const colors = [
    '#ef4444', // red
    '#f97316', // orange
    '#f59e0b', // amber
    '#eab308', // yellow
    '#84cc16', // lime
    '#10b981', // emerald
    '#06b6d4', // cyan
    '#0ea5e9', // sky
    '#3b82f6', // blue
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#d946ef', // fuchsia
    '#f43f5e', // rose
  ];
  
  return colors[Math.abs(hash) % colors.length];
};

interface ClickRecord {
  id: string;
  uid: string;
  name: string;
  yeshiva: string;
  location: { lat: number; lng: number };
  timestamp: string;
}

const createCustomIcon = (name: string, yeshiva: string, isRecent: boolean = false) => {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const borderColor = getColorForYeshiva(yeshiva || '');
  
  // Convert hex to rgb for the shadow Ripple variable (simple approx to avoid complex hex parsing, just pass the border color)
  
  const html = `
    <div class="animate-marker-pop" style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: -10px; --marker-color: ${borderColor}99;">
      <div class="${isRecent ? 'animate-marker-ripple' : ''}" style="width: 24px; height: 24px; background-color: white; color: ${borderColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 2px solid ${borderColor}; overflow: hidden;">
        ${initial}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-leaflet-icon bg-transparent border-none', // Override defaults just in case
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

export default function MapView() {
  const [clickRecords, setClickRecords] = useState<ClickRecord[]>([]);
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === 'admin';
  const { settings } = useSettings();
  const texts = settings?.texts || FALLBACK_TEXTS;
  const theme = settings?.theme;

  useEffect(() => {
    // Fetch all clicks
    const q = query(collection(db, 'clicks'));
    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        const newRecords: ClickRecord[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.location && data.location.lat && data.location.lng) {
            newRecords.push({
              id: doc.id,
              uid: data.uid,
              name: data.name,
              yeshiva: data.yeshiva,
              location: data.location,
              timestamp: data.timestamp
            });
          }
        });
        setClickRecords(newRecords);
      },
      (error) => {
        console.error("Error fetching clicks for map:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleDeleteClick = async (record: ClickRecord) => {
    try {
      // 1. Delete the click record itself
      await deleteDoc(doc(db, 'clicks', record.id));
      
      // 2. Decrement the user's total clicks
      await updateDoc(doc(db, 'users', record.uid), {
        clicks: increment(-1)
      });
    } catch (error) {
      console.error("Error deleting click:", error);
    }
  };

  return (
    <div className="h-[600px] w-full rounded-2xl overflow-hidden shadow-lg border border-slate-200 relative z-0">
      <MapContainer center={[31.7683, 35.2137]} zoom={8} className="h-full w-full z-0">
        <TileLayer
          attribution='Map data &copy; <a href="https://www.google.com/maps">Google</a>'
          url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        />
        {clickRecords.map((record) => {
          // Check if this click happened in the last 15 seconds
          const isRecent = (Date.now() - new Date(record.timestamp).getTime()) < 15000;
          return (
            <Marker 
              key={record.id} 
              position={[record.location.lat, record.location.lng]}
              icon={createCustomIcon(record.name, record.yeshiva, isRecent)}
            >
              <Popup>
                <div className="text-right" dir="rtl">
                  <strong className="block text-lg">{record.name}</strong>
                  <span className="block text-slate-600">{record.yeshiva}</span>
                  <span className="block text-xs text-slate-400 mt-1" dir="ltr">
                    {new Date(record.timestamp).toLocaleString('he-IL')}
                  </span>
                  
                  {isAdmin && (
                    <button
                      onPointerDown={(e) => {
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(record);
                      }}
                      onTouchEnd={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleDeleteClick(record);
                      }}
                      className="mt-3 flex items-center justify-center gap-1.5 w-full py-1.5 px-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-md transition-colors text-sm font-medium border border-red-100 touch-none select-none"
                    >
                      <Trash2 size={14} />
                      מחק נקודה
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
