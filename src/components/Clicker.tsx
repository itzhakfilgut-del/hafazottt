import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useCampaign } from '../contexts/CampaignContext';
import { doc, updateDoc, collection, addDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MousePointerClick, Flame, MapPin, Lock, CheckCircle2 } from 'lucide-react';
import { APP_TEXTS as FALLBACK_TEXTS } from '../constants';
import { Geolocation } from '@capacitor/geolocation';
import LocationPickerModal from './LocationPickerModal';

export const formatAddressFromNominatim = (addressDetails: any, displayName: string): string => {
  if (!addressDetails) {
    return displayName.split(',').slice(0, 4).join(', ');
  }
  const parts = [];
  
  if (addressDetails.road) {
    let street = addressDetails.road;
    if (addressDetails.house_number) street += ` ${addressDetails.house_number}`;
    parts.push(street);
  } else if (addressDetails.pedestrian) {
    parts.push(addressDetails.pedestrian);
  }
  
  if (addressDetails.neighbourhood) parts.push(addressDetails.neighbourhood);
  else if (addressDetails.suburb) parts.push(addressDetails.suburb);
  
  if (addressDetails.city) parts.push(addressDetails.city);
  else if (addressDetails.town) parts.push(addressDetails.town);
  else if (addressDetails.village) parts.push(addressDetails.village);
  
  if (parts.length > 0) return parts.join(', ').replace(/\|.*/g, '').trim();
  return displayName.split(',').slice(0, 4).join(', ');
};

export default function Clicker() {
  const { appUser } = useAuth();
  const { settings } = useSettings();
  const { campaign } = useCampaign();
  const texts = settings?.texts || FALLBACK_TEXTS;
  const theme = settings?.theme;
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(appUser?.lastLocation || null);
  const [locationName, setLocationName] = useState<string>('');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [isLocating, setIsLocating] = useState(true);
  const [otherNote, setOtherNote] = useState('');
  const isManualLocationRef = useRef(false);
  const [isManualLocation, setIsManualLocation] = useState(false);
  const [retryLocationTick, setRetryLocationTick] = useState(0);

  // Sync initial location from appUser if not set yet
  useEffect(() => {
    if (appUser?.lastLocation && !currentLocation && !isManualLocationRef.current) {
      setCurrentLocation(appUser.lastLocation);
      setIsLocating(false);
      // Fetch name for this last location
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${appUser.lastLocation.lat}&lon=${appUser.lastLocation.lng}&zoom=18&addressdetails=1`)
        .then(res => res.json())
        .then(data => {
          if (data && data.display_name && !isManualLocationRef.current) {
            setLocationName(formatAddressFromNominatim(data.address, data.display_name));
          }
        }).catch(console.error);
    }
  }, [appUser, currentLocation]);

  // Sync local clicks with DB based on campaign
  const [localClicks, setLocalClicks] = useState<number>(0);
  
  const userClicks = campaign === 'candles' ? (appUser?.candleClicks || 0) : campaign === 'other' ? (appUser?.otherClicks || 0) : (appUser?.clicks || 0);

  useEffect(() => {
    if (userClicks !== undefined) {
      setLocalClicks(Math.max(localClicks, userClicks));
    }
  }, [userClicks, campaign]); // Also reset/update when campaign changes
  
  // Set local clicks instantly on campaign toggle
  useEffect(() => {
    setLocalClicks(userClicks);
  }, [campaign]);

  // Initialize and track position constantly in the background
  useEffect(() => {
    let watchId: string | null = null;
    let webWatchId: number | null = null;

    const fetchIpGeolocation = async () => {
      try {
        // Fetch approximate location based on IP address using GeoJS (robust, no rate limits, CORS friendly)
        const response = await fetch('https://get.geojs.io/v1/ip/geo.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const textData = await response.text();
        // If we get an HTML block page instead of JSON, abort silently
        if (textData.toLowerCase().includes('<!doctype') || textData.toLowerCase().includes('<html')) {
          console.warn("IP Geolocation blocked by cloudflare/firewall, aborting IP fallback.");
          return;
        }

        const data = JSON.parse(textData);
        const lat = parseFloat(data.latitude);
        const lng = parseFloat(data.longitude);
        
        if (!isNaN(lat) && !isNaN(lng)) {
          if (!isManualLocationRef.current) {
            setCurrentLocation({ lat, lng });
            fetchLocationName(lat, lng);
            setIsLocating(false);
            console.log("Using IP Geolocation fallback");
          }
        }
      } catch (error) {
        console.error("IP Geolocation failed:", error);
      }
    };

    const fetchLocationName = async (lat: number, lng: number) => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        const data = await res.json();
        if (data && data.display_name) {
          if (!isManualLocationRef.current) {
            setLocationName(formatAddressFromNominatim(data.address, data.display_name));
          }
        } else {
          if (!isManualLocationRef.current) setLocationName('מיקום מדויק נמצא');
        }
      } catch (e) {
        if (!isManualLocationRef.current) setLocationName('מיקום מדויק נמצא');
      }
    };

    let bestAccuracy = Infinity;
    let hasFoundLocation = !!appUser?.lastLocation;

    const updateIfMoreAccurate = (lat: number, lng: number, accuracy: number, forceNameUpdate: boolean = false) => {
      if (isManualLocationRef.current) return;
      
      // If we don't have a location yet, or if this new location is more accurate 
      // (or at least somewhat exact, like < 50 meters, and better than what we had)
      if (!hasFoundLocation || accuracy <= bestAccuracy || accuracy < 50) {
        if (accuracy < bestAccuracy) bestAccuracy = accuracy;
        hasFoundLocation = true;
        setCurrentLocation({ lat, lng });
        setIsLocating(false);
        if (forceNameUpdate) {
          fetchLocationName(lat, lng);
        } else {
          setLocationName(prev => {
            if (!prev || prev === 'מיקום מדויק נמצא') {
              fetchLocationName(lat, lng);
            }
            return prev;
          });
        }
      }
    };

    const startWebTracking = () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            updateIfMoreAccurate(position.coords.latitude, position.coords.longitude, position.coords.accuracy || 100, true);
          },
          (err) => {
            console.log("Web geolocation initial error:", err);
            fetchIpGeolocation(); // Fallback to IP geolocation if permissions denied
          },
          { timeout: 10000, enableHighAccuracy: true }
        );

        webWatchId = navigator.geolocation.watchPosition(
          (position) => {
            updateIfMoreAccurate(position.coords.latitude, position.coords.longitude, position.coords.accuracy || 100);
          },
          (err) => console.log("Web geolocation watch error:", err),
          { timeout: 20000, enableHighAccuracy: true }
        );
      } else {
        fetchIpGeolocation();
      }
    };

    const startLocationTracking = async () => {
      // 1. Instantly trigger IP geolocation as a reliable, fast baseline
      fetchIpGeolocation();

      try {
        // Automatically ask for permissions right when the user enters the screen
        let permission = await Geolocation.checkPermissions();
        if (permission.location !== 'granted') {
          permission = await Geolocation.requestPermissions();
        }

        // If granted, let's start a continuous watcher for precise location
        if (permission.location === 'granted') {
          // Fallback: Also do one very fast initial check using cached/network location
          try {
            const initialPos = await Geolocation.getCurrentPosition({ 
              enableHighAccuracy: false, 
              timeout: 10000 
            });
            updateIfMoreAccurate(initialPos.coords.latitude, initialPos.coords.longitude, initialPos.coords.accuracy || 100, true);
          } catch (e) {
            console.log("Initial fast location check failed.");
          }

          // Start the continuous high-accuracy tracker
          watchId = await Geolocation.watchPosition(
            { enableHighAccuracy: true, timeout: 20000 },
            (position) => {
              if (position) {
                updateIfMoreAccurate(position.coords.latitude, position.coords.longitude, position.coords.accuracy || 100);
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
  }, [retryLocationTick]);

  const handleClick = (e?: React.MouseEvent | React.TouchEvent) => {
    if (!appUser || (!currentLocation && isLocating)) return;
    
    // Require location
    if (!currentLocation) {
      alert("יש לאשר מיקום לפני שניתן ללחוץ, או לבחור מיקום ידנית.");
      return;
    }

    if (campaign === 'other' && !otherNote.trim()) {
      alert("אנא הכנס על מה הספירה בשדה הטקסט.");
      return;
    }

    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }

    // Instantly update UI counter optimistically
    setLocalClicks(prev => prev + 1);
    
    // Now the click is instant! We just use the cached background location
    const locationData = currentLocation;

    // Fire and forget database updates (do not await)
    const updateDatabase = async () => {
      try {
        let finalLocation = locationData;
        
        // If they clicked so fast that even the IP baseline hasn't finished, fetch it inline
        if (!finalLocation) {
          try {
            const response = await fetch('https://get.geojs.io/v1/ip/geo.json');
            if (response.ok) {
              const textData = await response.text();
              if (!textData.toLowerCase().includes('<!doctype') && !textData.toLowerCase().includes('<html')) {
                const data = JSON.parse(textData);
                const lat = parseFloat(data.latitude);
                const lng = parseFloat(data.longitude);
                if (!isNaN(lat) && !isNaN(lng)) {
                  finalLocation = { lat, lng };
                  setCurrentLocation(finalLocation);
                }
              }
            }
          } catch (e) {
            console.log("Inline JIT location fetch failed", e);
          }
        }

        // Update user clicks based on campaign
        const isTefillin = campaign === 'tefillin';
        const isOther = campaign === 'other';
        const userRef = doc(db, 'users', appUser.uid);
        const userUpdate: any = {};
        
        if (isTefillin) {
          userUpdate.clicks = increment(1);
        } else if (campaign === 'candles') {
          userUpdate.candleClicks = increment(1);
        } else {
          userUpdate.otherClicks = increment(1);
        }

        if (finalLocation) {
          userUpdate.lastLocation = finalLocation;
        }
        
        // Add click record
        // Do not add jitter here if we want exact locations, but jitter helps with privacy.
        const clickData: any = {
          uid: appUser.uid,
          name: appUser.name,
          yeshiva: appUser.yeshiva,
          timestamp: new Date().toISOString(),
          type: campaign // Keep track of the type just in case we share the same collection in the future, though we use separate collections
        };

        if (isOther) {
          clickData.note = otherNote.trim();
        }
        
        if (finalLocation) {
          const jitterLat = (Math.random() - 0.5) * 0.0003;
          const jitterLng = (Math.random() - 0.5) * 0.0003;
          
          clickData.location = {
            lat: finalLocation.lat + jitterLat,
            lng: finalLocation.lng + jitterLng
          };
        } else {
          // If definitely no location, do not proceed with click record
          return;
        }
        
        const targetCollection = isTefillin ? 'clicks' : campaign === 'candles' ? 'candle_clicks' : 'other_clicks';
        
        // Execute operations in parallel without blocking clicks
        await Promise.all([
          updateDoc(userRef, userUpdate),
          addDoc(collection(db, targetCollection), clickData)
        ]);

      } catch (error) {
        console.error("Error recording click:", error);
      }
    };
    
    updateDatabase();
  };

  const handleManualLocation = (lat: number, lng: number, addressName?: string) => {
    isManualLocationRef.current = true;
    setIsManualLocation(true);
    setCurrentLocation({ lat, lng });
    setIsLocating(false);
    
    if (addressName) {
      setLocationName(formatAddressFromNominatim(null, addressName));
    } else {
      // Fetch address for the manually picked location
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`)
        .then(res => res.json())
        .then(data => {
          if (data && data.display_name) {
            setLocationName(formatAddressFromNominatim(data.address, data.display_name));
          } else {
            setLocationName('מיקום נבחר ידנית');
          }
        })
        .catch(() => setLocationName('מיקום נבחר ידנית'));
    }
  };

  const restoreAccurateLocation = () => {
    isManualLocationRef.current = false;
    setIsManualLocation(false);
    // Keep currentLocation so the button stays unlocked!
    setLocationName('');
    setIsLocating(true);
    setRetryLocationTick(prev => prev + 1);
  };

  const isTefillin = campaign === 'tefillin';
  const isOther = campaign === 'other';
  const displayTitle = isTefillin ? texts.clicker.title : isOther ? "ספירה אחרת" : "הדלקת נרות שבת";
  
  // Dynamically set text based on gender
  let clickText = texts.clicker.clickHere;
  if (appUser?.gender === 'boy') {
    clickText = "לחץ כאן!";
  } else if (appUser?.gender === 'girl') {
    clickText = "לחצי כאן!";
  }
  
  const displayClickText = isTefillin ? clickText : isOther ? "הוסף ספירה" : "הדלקתי!";
  
  const titleColor = isTefillin ? "text-blue-600 bg-blue-50" : isOther ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50";
  const buttonActiveGradient = isTefillin 
    ? "from-blue-500 to-blue-700 hover:shadow-blue-500/50" 
    : isOther ? "from-emerald-500 to-teal-600 hover:shadow-emerald-500/50"
    : "from-amber-500 to-orange-600 hover:shadow-orange-500/50";
    
  const buttonGradient = currentLocation ? buttonActiveGradient : "from-slate-400 to-slate-500 cursor-not-allowed opacity-80";

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-slate-900 mb-4">{displayTitle}</h2>
        <div className={`text-6xl font-black px-8 py-4 rounded-3xl inline-block shadow-inner ${titleColor}`}>
          {localClicks}
        </div>
      </div>

      {isOther && (
        <div className="w-full max-w-xs mb-8">
          <input
            type="text"
            placeholder="על מה הספירה? (לדוגמה: תהילים)"
            value={otherNote}
            onChange={(e) => setOtherNote(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-center"
            dir="rtl"
          />
        </div>
      )}

      <button
        onClick={handleClick}
        disabled={!currentLocation && isLocating}
        className={`group relative w-48 h-48 bg-gradient-to-br rounded-full shadow-2xl transition-all duration-200 flex flex-col items-center justify-center text-white no-select touch-manipulation select-none appearance-none ${buttonGradient} ${currentLocation ? 'hover:scale-105 active:scale-95' : ''}`}
      >
        <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
        {currentLocation ? (
          isTefillin ? (
            <MousePointerClick size={48} className="mb-2" />
          ) : isOther ? (
            <CheckCircle2 size={48} className="mb-2" />
          ) : (
            <Flame size={48} className="mb-2 text-yellow-200" />
          )
        ) : (
          <Lock size={48} className="mb-2 text-white/80" />
        )}
        <span className="text-2xl font-bold">{currentLocation ? displayClickText : "ממתין למיקום"}</span>
      </button>
      
      <div className="mt-8 flex flex-col items-center max-w-sm w-full">
        {!currentLocation && isLocating ? (
          <div className="w-full text-center">
            <p className="text-sm font-medium text-slate-700 mb-2">מאתר את מיקומך...</p>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-primary animate-pulse w-full origin-left"></div>
            </div>
          </div>
        ) : currentLocation ? (
          <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
            <MapPin size={16} />
            <span className="truncate max-w-[200px]" dir="auto">{locationName || 'מיקום זוהה'}</span>
          </div>
        ) : (
          <div className="text-sm text-red-500">
            לא ניתן למצוא מיקום באופן אוטומטי
          </div>
        )}
        
        <button
          onClick={() => setShowLocationPicker(true)}
          className="mt-4 text-sm text-primary hover:text-primary/80 font-medium underline-offset-4 hover:underline transition-all"
        >
          שירותי המיקום לא זמינים? בחר מיקום ידנית
        </button>
        
        {isManualLocation && (
          <button
            onClick={restoreAccurateLocation}
            className="mt-2 text-sm text-slate-500 hover:text-slate-700 font-medium underline-offset-4 hover:underline transition-all"
          >
            חזור למיקום מדויק (GPS)
          </button>
        )}
      </div>

      <LocationPickerModal 
        isOpen={showLocationPicker} 
        onClose={() => setShowLocationPicker(false)} 
        onSelectLocation={handleManualLocation}
        initialCenter={currentLocation || undefined}
      />
    </div>
  );
}
