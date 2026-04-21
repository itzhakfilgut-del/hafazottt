import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { AppUser } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { APP_TEXTS as FALLBACK_TEXTS } from '../constants';

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

const createCustomIcon = (user: AppUser) => {
  const initial = user.name ? user.name.charAt(0).toUpperCase() : '?';
  const clicks = user.clicks || 0;
  const borderColor = getColorForYeshiva(user.yeshiva || '');
  
  const html = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: -10px;">
      <div style="width: 40px; height: 40px; background-color: white; color: ${borderColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 3px solid ${borderColor}; overflow: hidden;">
        ${initial}
      </div>
      <div style="background-color: ${borderColor}; color: white; font-size: 12px; font-weight: 900; padding: 2px 8px; border-radius: 9999px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-top: -8px; z-index: 10; border: 1px solid white;">
        ${clicks}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-leaflet-icon',
    iconSize: [40, 50],
    iconAnchor: [20, 25],
    popupAnchor: [0, -25]
  });
};

export default function MapView() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const { settings } = useSettings();
  const texts = settings?.texts || FALLBACK_TEXTS;
  const theme = settings?.theme;

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        const newUsers: AppUser[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as AppUser;
          // Only show approved users who have a valid location
          if (data.status === 'approved' && data.lastLocation && data.lastLocation.lat !== 0 && data.lastLocation.lng !== 0) {
            newUsers.push({ ...data, uid: doc.id });
          }
        });
        setUsers(newUsers);
      },
      (error) => {
        console.error("Error fetching users for map:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <div className="h-[600px] w-full rounded-2xl overflow-hidden shadow-lg border border-slate-200 relative z-0">
      <MapContainer center={[31.7683, 35.2137]} zoom={8} className="h-full w-full z-0">
        <TileLayer
          attribution='Map data &copy; <a href="https://www.google.com/maps">Google</a>'
          url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        />
        {users.map((user) => (
          <Marker 
            key={user.uid} 
            position={[user.lastLocation!.lat, user.lastLocation!.lng]}
            icon={createCustomIcon(user)}
          >
            <Popup>
              <div className="text-right" dir="rtl">
                <strong className="block text-lg">{user.name}</strong>
                <span className="block text-slate-600">{user.yeshiva}</span>
                <span className="block text-sm font-bold text-primary mt-1">
                  {texts.map.totalClicks} {user.clicks}
                </span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
