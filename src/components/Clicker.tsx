import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { doc, updateDoc, collection, addDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MousePointerClick } from 'lucide-react';
import { APP_TEXTS as FALLBACK_TEXTS } from '../constants';
import { Geolocation } from '@capacitor/geolocation';

export default function Clicker() {
  const { appUser } = useAuth();
  const { settings } = useSettings();
  const texts = settings?.texts || FALLBACK_TEXTS;
  const theme = settings?.theme;
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);

  // Initialize and track position constantly in the background
  useEffect(() => {
    let watchId: string | null = null;
    let webWatchId: number | null = null;

    const startWebTracking = () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setCurrentLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
          },
          (err) => console.log("Web geolocation initial error:", err),
          { timeout: 10000, enableHighAccuracy: true }
        );

        webWatchId = navigator.geolocation.watchPosition(
          (position) => {
            setCurrentLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
          },
          (err) => console.log("Web geolocation watch error:", err),
          { timeout: 20000, enableHighAccuracy: true }
        );
      }
    };

    const startLocationTracking = async () => {
      try {
        // Automatically ask for permissions right when the user enters the screen
        let permission = await Geolocation.checkPermissions();
        if (permission.location !== 'granted') {
          permission = await Geolocation.requestPermissions();
        }

        // If granted, let's start a continuous watcher for smooth, instant clicks
        if (permission.location === 'granted') {
          // Fallback: Also do one very fast initial check using cached/network location
          try {
            const initialPos = await Geolocation.getCurrentPosition({ 
              enableHighAccuracy: false, 
              timeout: 10000 
            });
            setCurrentLocation({ 
              lat: initialPos.coords.latitude, 
              lng: initialPos.coords.longitude 
            });
          } catch (e) {
            console.log("Initial fast location check failed.");
          }

          // Start the continuous high-accuracy tracker
          watchId = await Geolocation.watchPosition(
            { enableHighAccuracy: true, timeout: 20000 },
            (position) => {
              if (position) {
                setCurrentLocation({
                  lat: position.coords.latitude,
                  lng: position.coords.longitude
                });
              }
            }
          );
        }
      } catch (error: any) {
        console.warn("Capacitor Geolocation not available, falling back to Web API:", error.message);
        startWebTracking();
      }
    };

    startLocationTracking();

    return () => {
      // Cleanup the watcher when the component unmounts
      if (watchId) {
        Geolocation.clearWatch({ id: watchId }).catch(console.error);
      }
      if (webWatchId !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(webWatchId);
      }
    };
  }, []);

  const handleClick = async (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      // Prevent double-tap zoom on mobile
      if ('preventDefault' in e) e.preventDefault();
    }
    
    if (!appUser || loading) return;
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }

    setLoading(true);
    
    try {
      // Now the click is instant! We just use the cached background location
      const locationData = currentLocation;

      // Update user clicks
      const userRef = doc(db, 'users', appUser.uid);
      const userUpdate: any = {
        clicks: increment(1)
      };

      if (locationData) {
        userUpdate.lastLocation = locationData;
      }
      
      await updateDoc(userRef, userUpdate);

      // Add click record
      const clickData: any = {
        uid: appUser.uid,
        name: appUser.name,
        yeshiva: appUser.yeshiva,
        timestamp: new Date().toISOString()
      };
      if (locationData) {
        // Add a tiny random jitter (approx ~10-20 meters) to the coordinates.
        // This ensures that if a user clicks 10 times without moving, the 10 markers
        // don't perfectly overlap into a single visible dot on the map.
        const jitterLat = (Math.random() - 0.5) * 0.0003;
        const jitterLng = (Math.random() - 0.5) * 0.0003;
        
        clickData.location = {
          lat: locationData.lat + jitterLat,
          lng: locationData.lng + jitterLng
        };
      }
      await addDoc(collection(db, 'clicks'), clickData);

    } catch (error) {
      console.error("Error recording click:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-slate-900 mb-4">{texts.clicker.title}</h2>
        <div className="text-6xl font-black text-blue-600 bg-blue-50 px-8 py-4 rounded-3xl inline-block shadow-inner">
          {appUser?.clicks || 0}
        </div>
      </div>

      <button
        onPointerDown={handleClick}
        disabled={loading}
        className="group relative w-48 h-48 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full shadow-2xl hover:shadow-blue-500/50 hover:scale-105 active:scale-95 transition-all duration-200 flex flex-col items-center justify-center text-white disabled:opacity-70 disabled:hover:scale-100 no-select touch-none"
      >
        <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
        <MousePointerClick size={48} className="mb-2" />
        <span className="text-2xl font-bold">{texts.clicker.clickHere}</span>
      </button>
      
      <p className="mt-8 text-slate-500 text-sm">
        {texts.clicker.locationNote}
      </p>
    </div>
  );
}
