import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Search, MapPin, X } from 'lucide-react';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (lat: number, lng: number, addressName?: string) => void;
  initialCenter?: { lat: number; lng: number };
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMapEvents({});
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

function LocationMarker({ position, setPosition, onManualPick }: { position: L.LatLng | null, setPosition: (pos: L.LatLng) => void, onManualPick: () => void }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      onManualPick();
    },
  });

  return position === null ? null : (
    <Marker position={position} />
  );
}

export default function LocationPickerModal({ isOpen, onClose, onSelectLocation, initialCenter }: LocationPickerModalProps) {
  const [position, setPosition] = useState<L.LatLng | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>(initialCenter ? [initialCenter.lat, initialCenter.lng] : [31.7683, 35.2137]);

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedAddressName, setSelectedAddressName] = useState<string | undefined>();

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchResults([]);
    setSelectedAddressName(undefined);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5&addressdetails=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        setSearchResults(data);
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setMapCenter([lat, lng]);
        setPosition(new L.LatLng(lat, lng));
        setSelectedAddressName(data[0].display_name);
      } else {
        alert('לא נמצאו תוצאות לחיפוש זה.');
      }
    } catch (err) {
      console.error(err);
      alert('שגיאה בחיפוש הכתובת.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setMapCenter([lat, lng]);
    setPosition(new L.LatLng(lat, lng));
    
    // addressdetails=1 provides the address object
    let formattedName = result.display_name;
    if (result.address) {
      // Use logic similar to Clicker
      const parts = [];
      if (result.address.road) {
        let street = result.address.road;
        if (result.address.house_number) street += ` ${result.address.house_number}`;
        parts.push(street);
      } else if (result.address.pedestrian) parts.push(result.address.pedestrian);
      
      if (result.address.neighbourhood) parts.push(result.address.neighbourhood);
      else if (result.address.suburb) parts.push(result.address.suburb);
      
      if (result.address.city) parts.push(result.address.city);
      else if (result.address.town) parts.push(result.address.town);
      else if (result.address.village) parts.push(result.address.village);
      
      if (parts.length > 0) formattedName = parts.join(', ').replace(/\|.*/g, '').trim();
    }
    
    setSearchQuery(formattedName);
    setSelectedAddressName(formattedName);
    setSearchResults([]);
  };

  const handleConfirm = () => {
    if (position) {
      onSelectLocation(position.lat, position.lng, selectedAddressName);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-bold text-lg">בחר מיקום ידנית</h3>
          <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>
        
        <div className="p-4 border-b border-slate-100 bg-slate-50 relative">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              placeholder="חפש כתובת, עיר..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/50 text-right"
              dir="rtl"
            />
            <button 
              type="submit" 
              disabled={isSearching}
              className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 flex items-center gap-2 disabled:opacity-70"
            >
              {isSearching ? <span className="animate-spin text-xl">⏳</span> : <Search size={20} />}
            </button>
          </form>
          {searchResults.length > 1 && (
            <div className="absolute top-full left-4 right-4 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
              {searchResults.map((result, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectResult(result)}
                  className="w-full text-right px-4 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0 text-sm flex items-start gap-2"
                >
                  <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
                  <span className="truncate whitespace-normal leading-tight">{result.display_name}</span>
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-500 mt-2 text-center">או לחץ על המפה כדי לבחור נקודה</p>
        </div>

        <div className="h-64 w-full bg-slate-200 relative z-0">
          <MapContainer center={mapCenter} zoom={12} className="h-full w-full z-0">
            <TileLayer
              attribution='Map data &copy; <a href="https://www.google.com/maps">Google</a>'
              url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            />
            <MapUpdater center={mapCenter} />
            <LocationMarker position={position} setPosition={setPosition} onManualPick={() => setSelectedAddressName(undefined)} />
          </MapContainer>
        </div>

        <div className="p-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors"
          >
            ביטול
          </button>
          <button
            onClick={handleConfirm}
            disabled={!position}
            className="flex-1 py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <MapPin size={20} />
            אשר מיקום זה
          </button>
        </div>
      </div>
    </div>
  );
}
