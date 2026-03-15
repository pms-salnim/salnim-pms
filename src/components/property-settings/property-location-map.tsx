'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    google: any;
  }
}

interface AddressData {
  streetAddress: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
}

interface PropertyLocationMapProps {
  latitude: number;
  longitude: number;
  streetAddress: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  onLocationChange: (latitude: number, longitude: number) => void;
  onAddressChange: (address: Partial<AddressData>) => void;
}

// Forward geocoding: Full Address → Coordinates
export async function forwardGeocode(address: Partial<AddressData>): Promise<{ latitude: number; longitude: number } | null> {
  try {
    // Build address string from country and postal code only
    const addressParts = [address.postalCode, address.country]
      .filter(Boolean)
      .join(', ');

    if (!addressParts.trim()) return null;

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressParts)}&limit=1`
    );

    if (!response.ok) return null;

    const results = await response.json();

    if (results.length > 0) {
      return {
        latitude: parseFloat(results[0].lat),
        longitude: parseFloat(results[0].lon),
      };
    }

    return null;
  } catch (error) {
    console.error('Forward geocoding error:', error);
    return null;
  }
}

// Reverse geocoding: Coordinates → Full Address
async function reverseGeocode(latitude: number, longitude: number): Promise<Partial<AddressData> | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
    );

    if (!response.ok) return null;

    const data = await response.json();

    if (data.address) {
      return {
        streetAddress: data.address.house_number && data.address.road
          ? `${data.address.house_number} ${data.address.road}`
          : data.address.road || '',
        city: data.address.city || data.address.town || data.address.village || '',
        stateProvince: data.address.state || '',
        postalCode: data.address.postcode || '',
        country: data.address.country || '',
      };
    }

    return null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

export default function PropertyLocationMap({
  latitude,
  longitude,
  streetAddress,
  city,
  stateProvince,
  postalCode,
  country,
  onLocationChange,
  onAddressChange,
}: PropertyLocationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.Marker | null>(null);
  const geocodeTimeoutRef = useRef<NodeJS.Timeout>();
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastLocationRef = useRef<string>('');
  const isMapClickRef = useRef(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [debug, setDebug] = useState(true);
  const [debugLogs, setDebugLogs] = useState<Array<{ time: string; message: string; type: 'info' | 'error' | 'warn' | 'success' }>>([]);
  const [allowMapDragUpdate, setAllowMapDragUpdate] = useState(true);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);

  const addLog = (message: string, type: 'info' | 'error' | 'warn' | 'success' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setDebugLogs((prev) => [...prev.slice(-9), { time, message, type }]);
    console.log(`[${time}] ${message}`);
  };

  // Load Google Maps API script
  useEffect(() => {
    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      // Check if Google Maps is already loaded
      if (window.google && window.google.maps) {
        setGoogleMapsLoaded(true);
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.defer = false; // Don't defer, we need it to load synchronously

    script.onload = () => {
      // Wait a bit to ensure window.google is available
      setTimeout(() => {
        if (window.google && window.google.maps) {
          setGoogleMapsLoaded(true);
        }
      }, 100);
    };

    script.onerror = () => {
      console.error('Failed to load Google Maps API');
      addLog('❌ Failed to load Google Maps API', 'error');
    };

    document.head.appendChild(script);

    return () => {
      // Don't remove the script as it might be used elsewhere
    };
  }, []);

  // Initialize Google Map (only after API is loaded)
  useEffect(() => {
    if (!googleMapsLoaded || !mapContainer.current || map.current) return;
    
    // Safety check: ensure window.google exists
    if (!window.google || !window.google.maps) {
      addLog('⏳ Waiting for Google Maps API to fully load...', 'warn');
      return;
    }

    addLog('🗺️ Initializing Google Map...', 'info');

    const mapOptions: google.maps.MapOptions = {
      zoom: latitude && longitude ? 13 : 2,
      center: { lat: latitude || 20, lng: longitude || 0 },
      mapTypeControl: true,
      fullscreenControl: true,
      zoomControl: true,
      streetViewControl: false,
    };

    map.current = new window.google.maps.Map(mapContainer.current, mapOptions);

    addLog(`✅ Google Map initialized. Initial coords: ${latitude}, ${longitude}`, 'success');

    // Map click handler
    map.current.addListener('click', (event: google.maps.MapMouseEvent) => {
      if (!event.latLng) return;

      const lat = event.latLng.lat();
      const lng = event.latLng.lng();

      addLog(`📍 Map clicked at: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, 'info');

      if (!allowMapDragUpdate) {
        addLog(`⚠️ Map dragging disabled - update address fields instead`, 'warn');
        return;
      }

      isMapClickRef.current = true;
      updateMarker(lat, lng);
      onLocationChange(lat, lng);
      addLog(`📌 Pin placed, coordinates updated`, 'success');

      setTimeout(() => {
        isMapClickRef.current = false;
      }, 100);
    });

    // Marker drag listener
    return () => {
      // Cleanup
      if (map.current) {
        google.maps.event.clearListeners(map.current, 'click');
      }
      if (marker.current) {
        google.maps.event.clearListeners(marker.current, 'dragend');
        marker.current.setMap(null);
      }
    };
  }, [allowMapDragUpdate, googleMapsLoaded]);

  // Update marker position
  const updateMarker = (lat: number, lng: number) => {
    if (!map.current) return;

    if (marker.current) {
      marker.current.setPosition({ lat, lng });
    } else {
      marker.current = new window.google.maps.Marker({
        position: { lat, lng },
        map: map.current,
        draggable: true,
        title: 'Property Location',
      });

      // Marker drag end listener
      marker.current.addListener('dragend', () => {
        if (!allowMapDragUpdate) {
          addLog(`⚠️ Marker drag disabled`, 'warn');
          return;
        }

        const position = marker.current?.getPosition();
        if (position) {
          const newLat = position.lat();
          const newLng = position.lng();
          addLog(`📍 Marker dragged to: ${newLat.toFixed(4)}, ${newLng.toFixed(4)}`, 'info');
          isMapClickRef.current = true;
          onLocationChange(newLat, newLng);
          lastCoordsRef.current = { lat: newLat, lng: newLng };

          setTimeout(() => {
            isMapClickRef.current = false;
          }, 100);
        }
      });
    }

    map.current.setCenter({ lat, lng });
    map.current.setZoom(13);
    lastCoordsRef.current = { lat, lng };
  };

  // Update map when latitude/longitude change (from form submission or other sources)
  useEffect(() => {
    if (!map.current || !latitude || !longitude) {
      addLog(`⏭️ Skipping coord update: map=${!!map.current}, lat=${latitude}, lng=${longitude}`, 'info');
      return;
    }

    // Check if coordinates have actually changed to avoid unnecessary updates
    if (
      lastCoordsRef.current &&
      Math.abs(lastCoordsRef.current.lat - latitude) < 0.0001 &&
      Math.abs(lastCoordsRef.current.lng - longitude) < 0.0001
    ) {
      addLog(`⏭️ Coords not changed significantly (threshold: 0.0001°), skipping update`, 'info');
      return;
    }

    addLog(`📍 Coord change detected: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, 'info');
    updateMarker(latitude, longitude);
  }, [latitude, longitude]);

  // Watch country and postal code changes and geocode
  useEffect(() => {
    // Skip if map updates are disabled
    if (!allowMapDragUpdate) {
      addLog(`⏭️ Skipping location watcher: map updates disabled by user`, 'warn');
      return;
    }

    // Skip if coordinates just came from a map click (reverse geocoding in progress)
    if (isMapClickRef.current) {
      addLog(`⏭️ Skipping location watcher: map click in progress`, 'warn');
      return;
    }

    // Build location string from country and postal code only
    const locationString = [country, postalCode].filter(Boolean).join(', ');

    addLog(`📍 Country/Postal Code changed: "${locationString || '(empty)'}"`, 'info');

    if (!locationString.trim()) {
      addLog(`⏭️ Country or postal code is empty, skipping geocoding`, 'warn');
      return;
    }

    // Skip if location hasn't changed
    if (locationString === lastLocationRef.current) {
      addLog(`⏭️ Location unchanged (same as last), skipping`, 'info');
      return;
    }

    // Debounce API calls
    clearTimeout(geocodeTimeoutRef.current);

    setIsGeocoding(true);
    addLog(`⏳ Geocoding will start in 800ms for: "${locationString}"`, 'info');

    geocodeTimeoutRef.current = setTimeout(async () => {
      // Double-check flag hasn't been set during debounce
      if (isMapClickRef.current) {
        addLog(`⏭️ Aborting forward geocoding: map click detected`, 'warn');
        setIsGeocoding(false);
        return;
      }

      addLog(`🔄 Starting forward geocoding with Country & PostalCode...`, 'info');
      const coords = await forwardGeocode({ country, postalCode });

      if (coords) {
        addLog(
          `✅ Forward geocode success: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`,
          'success'
        );

        if (map.current) {
          // Only update if coordinates are different
          if (
            !lastCoordsRef.current ||
            Math.abs(lastCoordsRef.current.lat - coords.latitude) > 0.0001 ||
            Math.abs(lastCoordsRef.current.lng - coords.longitude) > 0.0001
          ) {
            addLog(`📍 Updating marker to new coordinates`, 'info');
            updateMarker(coords.latitude, coords.longitude);
            onLocationChange(coords.latitude, coords.longitude);
          } else {
            addLog(`⏭️ New coords same as last, skipping marker update`, 'info');
          }
        } else {
          addLog(`❌ Map not initialized!`, 'error');
        }
      } else {
        addLog(`❌ Forward geocode failed or no results`, 'error');
      }

      lastLocationRef.current = locationString;
      setIsGeocoding(false);
    }, 800); // Debounce 800ms to avoid excessive API calls

    return () => clearTimeout(geocodeTimeoutRef.current);
  }, [country, postalCode, onLocationChange, allowMapDragUpdate]);

  return (
    <div className="space-y-3">
      {/* Checkbox to control map drag updates */}
      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <input
          type="checkbox"
          id="allowMapDragUpdate"
          checked={allowMapDragUpdate}
          onChange={(e) => setAllowMapDragUpdate(e.target.checked)}
          className="w-4 h-4 cursor-pointer"
        />
        <label htmlFor="allowMapDragUpdate" className="text-sm text-gray-700 cursor-pointer">
          Allow updating address by moving the pin on the map
        </label>
      </div>

      <div className="relative w-full bg-gray-50 rounded-lg border border-gray-300 overflow-hidden">
        <div
          ref={mapContainer}
          className="w-full h-96 rounded-lg"
          style={{ minHeight: '400px' }}
        />
        {isGeocoding && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-lg">
            <div className="text-sm text-gray-600">Updating map...</div>
          </div>
        )}
      </div>
      <div className="text-xs text-gray-500 p-2 bg-blue-50 rounded border border-blue-100">
        💡 Click on the map to pin location, drag the marker to update, or edit address fields to update the map.
      </div>

      {/* DEBUG PANEL */}
      {debug && (
        <div className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs font-mono space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-bold text-yellow-400">🐛 DEBUG PANEL</div>
            <button
              onClick={() => setDebug(false)}
              className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded bg-gray-800"
            >
              Hide
            </button>
          </div>

          {/* Current Values */}
          <div className="space-y-2 bg-gray-800 p-3 rounded">
            <div className="font-bold text-cyan-400">📊 COORDINATES:</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-blue-300">Latitude:</span>{' '}
                <span className={latitude ? 'text-green-400 font-bold' : 'text-gray-400'}>
                  {latitude ? latitude.toFixed(6) : '(empty)'}
                </span>
              </div>
              <div>
                <span className="text-blue-300">Longitude:</span>{' '}
                <span className={longitude ? 'text-green-400 font-bold' : 'text-gray-400'}>
                  {longitude ? longitude.toFixed(6) : '(empty)'}
                </span>
              </div>
            </div>

            <div className="col-span-2 border-t border-gray-600 pt-2 mt-2">
              <span className="text-violet-300 font-semibold">🗺️ LOCATION FIELDS (Triggers Forward Geocoding):</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-blue-300">Country:</span>{' '}
                <span className={country ? 'text-green-400' : 'text-gray-400'}>
                  {country || '(empty)'}
                </span>
              </div>
              <div>
                <span className="text-blue-300">Postal Code:</span>{' '}
                <span className={postalCode ? 'text-green-400' : 'text-gray-400'}>
                  {postalCode || '(empty)'}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-blue-300">Geocoding:</span>{' '}
                <span className={isGeocoding ? 'text-yellow-400' : 'text-gray-400'}>
                  {isGeocoding ? 'IN PROGRESS' : 'idle'}
                </span>
              </div>
            </div>
          </div>

          {/* State Refs */}
          <div className="space-y-1 bg-gray-800 p-3 rounded">
            <div className="font-bold text-cyan-400">🔍 INTERNAL STATE:</div>
            <div>
              <span className="text-blue-300">Last Coords:</span>{' '}
              <span className="text-orange-400">
                {lastCoordsRef.current
                  ? `${lastCoordsRef.current.lat.toFixed(4)}, ${lastCoordsRef.current.lng.toFixed(4)}`
                  : '(not set)'}
              </span>
            </div>
            <div className="break-all">
              <span className="text-blue-300">Last Location:</span>{' '}
              <span className="text-orange-400">{lastLocationRef.current || '(empty)'}</span>
            </div>
            <div>
              <span className="text-blue-300">Map Initialized:</span>{' '}
              <span className={map.current ? 'text-green-400' : 'text-red-400'}>
                {map.current ? 'YES' : 'NO'}
              </span>
            </div>
            <div>
              <span className="text-blue-300">Marker Initialized:</span>{' '}
              <span className={marker.current ? 'text-green-400' : 'text-red-400'}>
                {marker.current ? 'YES' : 'NO'}
              </span>
            </div>
            <div>
              <span className="text-blue-300">Map Click In Progress:</span>{' '}
              <span className={isMapClickRef.current ? 'text-yellow-400 font-bold' : 'text-gray-400'}>
                {isMapClickRef.current ? 'YES (geocoding active)' : 'NO'}
              </span>
            </div>
          </div>

          {/* Event Log */}
          <div className="space-y-1 bg-gray-800 p-3 rounded max-h-32 overflow-y-auto">
            <div className="font-bold text-cyan-400 sticky top-0 bg-gray-800">📋 EVENT LOG (last 10):</div>
            {debugLogs.length === 0 ? (
              <div className="text-gray-500">No events yet...</div>
            ) : (
              debugLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={`flex gap-2 ${
                    log.type === 'error'
                      ? 'text-red-400'
                      : log.type === 'warn'
                        ? 'text-yellow-400'
                        : log.type === 'success'
                          ? 'text-green-400'
                          : 'text-gray-300'
                  }`}
                >
                  <span className="text-gray-500 flex-shrink-0">[{log.time}]</span>
                  <span className="flex-1">{log.message}</span>
                </div>
              ))
            )}
          </div>

          {/* Callbacks Info */}
          <div className="space-y-1 bg-gray-800 p-3 rounded text-xs">
            <div className="font-bold text-cyan-400">🔗 CALLBACKS:</div>
            <div>
              <span className="text-blue-300">onLocationChange:</span>{' '}
              <span className={onLocationChange ? 'text-green-400' : 'text-red-400'}>
                {onLocationChange ? 'CONNECTED' : 'MISSING'}
              </span>
            </div>
            <div>
              <span className="text-blue-300">onAddressChange:</span>{' '}
              <span className={onAddressChange ? 'text-green-400' : 'text-red-400'}>
                {onAddressChange ? 'CONNECTED' : 'MISSING'}
              </span>
            </div>
          </div>
        </div>
      )}

      {!debug && (
        <button
          onClick={() => setDebug(true)}
          className="text-xs text-gray-600 hover:text-gray-900 px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
        >
          Show Debug Panel
        </button>
      )}
    </div>
  );
}
