import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import type { LocationPoint } from '../types';
import { 
  Map as MapIcon, Key, ExternalLink, Crosshair, 
  Minimize2, Maximize2, ZoomIn, ZoomOut, ChevronDown, ChevronUp 
} from 'lucide-react';

interface EmergencyMapProps {
  latitude: number | null;
  longitude: number | null;
  address?: string;
  emergencyId?: string;
  userId?: string;
  locationHistory?: LocationPoint[];
  allActiveEmergencies?: Array<{
    emergencyId: string;
    latitude: number | null;
    longitude: number | null;
    priority: string;
    userId: string;
  }>;
  onSelectEmergency?: (id: string) => void;
  height?: string;
}

// Tactical Dark Mode Styling for Google Maps API
const GOOGLE_MAPS_DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
  { featureType: "landscape.man_made", elementType: "geometry.stroke", stylers: [{ color: "#334e87" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#021019" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#283d6a" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6f9ba5" }] },
  { featureType: "poi", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
  { featureType: "road", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2c6675" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#255462" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#64acc8" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4e6d70" }] }
];

export const EmergencyMap: React.FC<EmergencyMapProps> = ({
  latitude,
  longitude,
  address,
  emergencyId,
  userId,
  locationHistory = [],
  allActiveEmergencies = [],
  onSelectEmergency,
  height: propHeight = '380px'
}) => {
  // Map Engine Toggle: 'GOOGLE_MAPS' (Official Google Maps JS API) vs 'TACTICAL_LEAFLET' (Zero key fallback)
  const [engine, setEngine] = useState<'TACTICAL_LEAFLET' | 'GOOGLE_MAPS'>(() => {
    return (localStorage.getItem('gb_map_engine') as 'TACTICAL_LEAFLET' | 'GOOGLE_MAPS') || 'GOOGLE_MAPS';
  });

  // Google Maps Theme Toggle: 'STANDARD' (just like Google Maps app) vs 'TACTICAL_NIGHT' vs 'SATELLITE'
  const [gmapTheme, setGmapTheme] = useState<'STANDARD' | 'TACTICAL_NIGHT' | 'SATELLITE'>(() => {
    return (localStorage.getItem('gb_gmap_theme') as 'STANDARD' | 'TACTICAL_NIGHT' | 'SATELLITE') || 'STANDARD';
  });

  // Map Size Mode: 'COLLAPSED' (slim bar) vs 'COMPACT' (170px) vs 'STANDARD' (380px) vs 'EXPANDED' (600px)
  const [sizeMode, setSizeMode] = useState<'COLLAPSED' | 'COMPACT' | 'STANDARD' | 'EXPANDED'>(() => {
    const saved = localStorage.getItem('gb_map_size');
    if (saved === 'MINIMIZED' || saved === 'COLLAPSED') return 'COLLAPSED';
    if (saved === 'COMPACT') return 'COMPACT';
    if (saved === 'EXPANDED') return 'EXPANDED';
    return 'STANDARD';
  });

  const [googleApiKey, setGoogleApiKey] = useState<string>(() => {
    return localStorage.getItem('gb_gmaps_key') || (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';
  });

  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState(googleApiKey);
  const [gmapError, setGmapError] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  // Leaflet refs
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletMarkerRef = useRef<L.Marker | null>(null);
  const leafletPolylineRef = useRef<L.Polyline | null>(null);
  const leafletBlipsRef = useRef<L.Marker[]>([]);

  // Google Maps refs
  const gmapInstanceRef = useRef<google.maps.Map | null>(null);
  const gmapActiveMarkerRef = useRef<google.maps.Marker | null>(null);
  const gmapPolylineRef = useRef<google.maps.Polyline | null>(null);
  const gmapBlipsRef = useRef<google.maps.Marker[]>([]);
  const gmapInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const hasCoords = latitude !== null && longitude !== null && !isNaN(Number(latitude)) && !isNaN(Number(longitude));
  const effectiveLat = hasCoords ? Number(latitude) : 10.9993;
  const effectiveLng = hasCoords ? Number(longitude) : 77.0842;

  const currentHeight = sizeMode === 'COMPACT' ? '170px' : sizeMode === 'EXPANDED' ? '600px' : propHeight;

  // Persist engine choice
  const handleSwitchEngine = (newEngine: 'TACTICAL_LEAFLET' | 'GOOGLE_MAPS') => {
    setEngine(newEngine);
    localStorage.setItem('gb_map_engine', newEngine);
    setGmapError(null);
  };

  const handleSwitchGmapTheme = (newTheme: 'STANDARD' | 'TACTICAL_NIGHT' | 'SATELLITE') => {
    setGmapTheme(newTheme);
    localStorage.setItem('gb_gmap_theme', newTheme);

    if (gmapInstanceRef.current) {
      if (newTheme === 'SATELLITE') {
        gmapInstanceRef.current.setMapTypeId('hybrid');
        gmapInstanceRef.current.setOptions({ styles: [] });
      } else if (newTheme === 'TACTICAL_NIGHT') {
        gmapInstanceRef.current.setMapTypeId('roadmap');
        gmapInstanceRef.current.setOptions({ styles: GOOGLE_MAPS_DARK_STYLE });
      } else {
        // STANDARD (Clean Google Maps App view)
        gmapInstanceRef.current.setMapTypeId('roadmap');
        gmapInstanceRef.current.setOptions({ styles: [] });
      }
    }
  };

  const handleToggleSizeMode = (newMode: 'COLLAPSED' | 'COMPACT' | 'STANDARD' | 'EXPANDED') => {
    setSizeMode(newMode);
    localStorage.setItem('gb_map_size', newMode);

    if (newMode !== 'COLLAPSED') {
      // Trigger map resize event so tiles repaint smoothly
      setTimeout(() => {
        if (engine === 'GOOGLE_MAPS' && gmapInstanceRef.current) {
          window.google.maps.event.trigger(gmapInstanceRef.current, 'resize');
          gmapInstanceRef.current.setCenter({ lat: effectiveLat, lng: effectiveLng });
        } else if (engine === 'TACTICAL_LEAFLET' && leafletMapRef.current) {
          leafletMapRef.current.invalidateSize();
        }
      }, 150);
    }
  };

  const handleSaveKey = () => {
    setGoogleApiKey(keyInput.trim());
    localStorage.setItem('gb_gmaps_key', keyInput.trim());
    setShowKeyModal(false);
    setGmapError(null);
  };

  // Zoom controls - Allows zooming freely (minimizing scale) without artificial walls
  const handleZoomIn = () => {
    if (engine === 'GOOGLE_MAPS' && gmapInstanceRef.current) {
      gmapInstanceRef.current.setZoom((gmapInstanceRef.current.getZoom() || 15) + 1);
    } else if (engine === 'TACTICAL_LEAFLET' && leafletMapRef.current) {
      leafletMapRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (engine === 'GOOGLE_MAPS' && gmapInstanceRef.current) {
      gmapInstanceRef.current.setZoom(Math.max(1, (gmapInstanceRef.current.getZoom() || 15) - 1));
    } else if (engine === 'TACTICAL_LEAFLET' && leafletMapRef.current) {
      leafletMapRef.current.zoomOut();
    }
  };

  const handleSetZoomPreset = (zoomLevel: number) => {
    if (engine === 'GOOGLE_MAPS' && gmapInstanceRef.current) {
      gmapInstanceRef.current.setZoom(zoomLevel);
    } else if (engine === 'TACTICAL_LEAFLET' && leafletMapRef.current) {
      leafletMapRef.current.setZoom(zoomLevel);
    }
  };

  // Recenter map on active emergency at standard street zoom 16
  const handleRecenter = () => {
    if (engine === 'GOOGLE_MAPS' && gmapInstanceRef.current) {
      gmapInstanceRef.current.setCenter({ lat: effectiveLat, lng: effectiveLng });
      gmapInstanceRef.current.setZoom(16);
    } else if (engine === 'TACTICAL_LEAFLET' && leafletMapRef.current) {
      leafletMapRef.current.setView([effectiveLat, effectiveLng], 16, { animate: true });
    }
  };

  // -------------------------------------------------------------
  // 1. LEAFLET MAP ENGINE (Allows zoom out to 3, no duplicate world wrapping)
  // -------------------------------------------------------------
  useEffect(() => {
    if (engine !== 'TACTICAL_LEAFLET') {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
      return;
    }

    if (!mapContainerRef.current) return;

    if (!leafletMapRef.current) {
      if ((mapContainerRef.current as any)._leaflet_id) {
        (mapContainerRef.current as any)._leaflet_id = null;
      }
      try {
        const map = L.map(mapContainerRef.current, {
          center: [effectiveLat, effectiveLng],
          zoom: 15,
          minZoom: 1, // Allows zooming all the way out freely (minimizing map scale)
          maxZoom: 19,
          zoomControl: false, // Custom controls provided
          attributionControl: false,
          maxBounds: [[-85, -180], [85, 180]],
          maxBoundsViscosity: 0.5
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          minZoom: 1,
          noWrap: true, // Prevents duplicate globe repetition (single map only)
          bounds: [[-85, -180], [85, 180]],
          subdomains: 'abcd',
        }).addTo(map);

        leafletMapRef.current = map;
      } catch (err) {
        console.warn('[Leaflet] Safe init warning:', err);
      }
    }

    const map = leafletMapRef.current;
    if (!map) return;

    // Clear old blips
    leafletBlipsRef.current.forEach(m => m.remove());
    leafletBlipsRef.current = [];

    allActiveEmergencies.forEach(emg => {
      if (emg.latitude && emg.longitude && emg.emergencyId !== emergencyId) {
        const blipIcon = L.divIcon({
          className: 'custom-blip',
          html: `<div style="background: #eab308; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 10px #eab308; cursor: pointer;"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });

        const blipMarker = L.marker([emg.latitude, emg.longitude], { icon: blipIcon })
          .addTo(map)
          .bindPopup(`<b>${emg.emergencyId}</b><br/>User: ${emg.userId}<br/>Priority: ${emg.priority}`);

        blipMarker.on('click', () => {
          if (onSelectEmergency) onSelectEmergency(emg.emergencyId);
        });

        leafletBlipsRef.current.push(blipMarker);
      }
    });

    // Update active emergency marker
    if (hasCoords) {
      const pulseIcon = L.divIcon({
        className: 'custom-emergency-pin',
        html: `
          <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background: rgba(239, 68, 68, 0.4); animation: pulse-ring 1.5s cubic-bezier(0.2, 0, 1) infinite;"></div>
            <div style="width: 18px; height: 18px; border-radius: 50%; background: #ef4444; border: 3px solid #ffffff; box-shadow: 0 0 14px #ef4444; z-index: 10;"></div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      if (leafletMarkerRef.current) {
        leafletMarkerRef.current.setLatLng([effectiveLat, effectiveLng]);
        leafletMarkerRef.current.setIcon(pulseIcon);
      } else {
        leafletMarkerRef.current = L.marker([effectiveLat, effectiveLng], { icon: pulseIcon }).addTo(map);
      }

      leafletMarkerRef.current.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; color: #111;">
          <b style="color: #dc2626;">🚨 ${emergencyId || 'ACTIVE SOS'}</b><br/>
          <b>User:</b> ${userId || 'Unknown'}<br/>
          <b>Lat/Lng:</b> ${effectiveLat.toFixed(5)}, ${effectiveLng.toFixed(5)}<br/>
          <b>Address:</b> ${address || 'Kalaignar Karunanidhi Institute of Technology, Coimbatore'}
        </div>
      `);

      map.panTo([effectiveLat, effectiveLng], { animate: true });
    }

    // Polyline breadcrumbs (with distance anomaly filter to eliminate cross-continent trails)
    if (leafletPolylineRef.current) {
      leafletPolylineRef.current.remove();
      leafletPolylineRef.current = null;
    }

    if (locationHistory && locationHistory.length > 1) {
      const validPoints = locationHistory.filter(
        p => Math.abs(p.latitude - effectiveLat) < 2.5 && Math.abs(p.longitude - effectiveLng) < 2.5
      );
      if (validPoints.length > 1) {
        const latLngs: [number, number][] = validPoints.map(p => [p.latitude, p.longitude]);
        leafletPolylineRef.current = L.polyline(latLngs, {
          color: '#ef4444',
          weight: 4,
          dashArray: '6, 8',
          opacity: 0.85
        }).addTo(map);
      }
    }

  }, [engine, effectiveLat, effectiveLng, emergencyId, userId, address, locationHistory, allActiveEmergencies, hasCoords]);

  // -------------------------------------------------------------
  // 2. OFFICIAL GOOGLE MAPS API (Zoom out permitted down to 3 without world duplicate)
  // -------------------------------------------------------------
  useEffect(() => {
    if (engine !== 'GOOGLE_MAPS') {
      if (gmapInstanceRef.current) {
        gmapInstanceRef.current = null;
      }
      return;
    }

    if (!googleApiKey) {
      setGmapError('No Google Maps API Key provided. Enter your API Key or Maps Demo Key.');
      return;
    }

    let isCancelled = false;

    try {
      setOptions({
        key: googleApiKey,
        v: 'weekly'
      });
    } catch {
      // Ignore if setOptions was already called
    }

    Promise.all([
      importLibrary('maps'),
      importLibrary('marker')
    ]).then(([mapsLib]) => {
      if (isCancelled || !mapContainerRef.current) return;

      setGmapError(null);
      const googleMaps = mapsLib as google.maps.MapsLibrary;

      if (!gmapInstanceRef.current) {
        // Create the Google Map allowing full zoom range (street to globe) smoothly
        const gmap = new googleMaps.Map(mapContainerRef.current, {
          center: { lat: effectiveLat, lng: effectiveLng },
          zoom: 15,
          minZoom: 1, // Allows zooming all the way out freely (minimizing map scale)
          maxZoom: 20,
          restriction: {
            latLngBounds: {
              north: 85,
              south: -85,
              west: -180,
              east: 180,
            },
            strictBounds: false, // Prevents locking zoom-out on wide screens
          },
          mapTypeId: gmapTheme === 'SATELLITE' ? 'hybrid' : 'roadmap',
          styles: gmapTheme === 'TACTICAL_NIGHT' ? GOOGLE_MAPS_DARK_STYLE : [],
          disableDefaultUI: false,
          zoomControl: false, // We supply custom unified zoom buttons
          mapTypeControl: false,
          streetViewControl: true,
          fullscreenControl: true,
          scaleControl: true
        });

        gmapInstanceRef.current = gmap;

        setTimeout(() => {
          if (gmapInstanceRef.current) {
            window.google.maps.event.trigger(gmapInstanceRef.current, 'resize');
            gmapInstanceRef.current.setCenter({ lat: effectiveLat, lng: effectiveLng });
          }
        }, 100);
      }

      const gmap = gmapInstanceRef.current;

      // Update theme if changed
      if (gmapTheme === 'SATELLITE') {
        gmap.setMapTypeId('hybrid');
        gmap.setOptions({ styles: [] });
      } else if (gmapTheme === 'TACTICAL_NIGHT') {
        gmap.setMapTypeId('roadmap');
        gmap.setOptions({ styles: GOOGLE_MAPS_DARK_STYLE });
      } else {
        // STANDARD (Clean Google Maps App view)
        gmap.setMapTypeId('roadmap');
        gmap.setOptions({ styles: [] });
      }

      // Clear previous secondary blips
      gmapBlipsRef.current.forEach(m => m.setMap(null));
      gmapBlipsRef.current = [];

      allActiveEmergencies.forEach(emg => {
        if (emg.latitude && emg.longitude && emg.emergencyId !== emergencyId) {
          const blipMarker = new window.google.maps.Marker({
            position: { lat: emg.latitude, lng: emg.longitude },
            map: gmap,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: '#eab308',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2
            },
            title: `${emg.emergencyId} - User: ${emg.userId}`
          });

          blipMarker.addListener('click', () => {
            if (onSelectEmergency) onSelectEmergency(emg.emergencyId);
          });

          gmapBlipsRef.current.push(blipMarker);
        }
      });

      // Update active emergency marker
      if (hasCoords) {
        const markerPos = { lat: effectiveLat, lng: effectiveLng };

        if (!gmapActiveMarkerRef.current) {
          gmapActiveMarkerRef.current = new window.google.maps.Marker({
            position: markerPos,
            map: gmap,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 11,
              fillColor: '#ef4444',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 3
            },
            title: `🚨 ${emergencyId || 'ACTIVE SOS'}`
          });

          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div style="color: #111; font-family: sans-serif; padding: 4px; font-size: 12px;">
                <b style="color: #dc2626;">🚨 ${emergencyId || 'ACTIVE SOS'}</b><br/>
                <b>User:</b> ${userId || 'Unknown'}<br/>
                <b>Location:</b> ${address || 'Kalaignar Karunanidhi Institute of Technology, Coimbatore'}<br/>
                <b>Coords:</b> ${effectiveLat.toFixed(5)}, ${effectiveLng.toFixed(5)}
              </div>
            `
          });
          gmapInfoWindowRef.current = infoWindow;

          gmapActiveMarkerRef.current.addListener('click', () => {
            if (gmapInstanceRef.current && gmapActiveMarkerRef.current) {
              infoWindow.open({
                anchor: gmapActiveMarkerRef.current,
                map: gmapInstanceRef.current
              });
            }
          });
        } else {
          gmapActiveMarkerRef.current.setPosition(markerPos);
        }

        gmap.panTo(markerPos);
      }

      // Update movement polyline (with distance anomaly filter to eliminate cross-continent trails)
      if (gmapPolylineRef.current) {
        gmapPolylineRef.current.setMap(null);
        gmapPolylineRef.current = null;
      }

      if (locationHistory && locationHistory.length > 1) {
        const validPoints = locationHistory.filter(
          p => Math.abs(p.latitude - effectiveLat) < 2.5 && Math.abs(p.longitude - effectiveLng) < 2.5
        );
        if (validPoints.length > 1) {
          const pathCoords = validPoints.map(p => ({ lat: p.latitude, lng: p.longitude }));
          gmapPolylineRef.current = new window.google.maps.Polyline({
            path: pathCoords,
            geodesic: true,
            strokeColor: '#ef4444',
            strokeOpacity: 0.9,
            strokeWeight: 4,
            map: gmap
          });
        }
      }

    }).catch((err: unknown) => {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('Failed to load Google Maps JavaScript API:', errMsg);
      setGmapError(`Google Maps API Error: ${errMsg || 'Check your API Key and enabled services'}`);
    });

    return () => {
      isCancelled = true;
    };
  }, [engine, gmapTheme, googleApiKey, effectiveLat, effectiveLng, emergencyId, userId, address, locationHistory, allActiveEmergencies, hasCoords]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
      if (gmapInstanceRef.current) {
        gmapInstanceRef.current = null;
      }
    };
  }, []);

  // If minimized to collapsed bar mode, render sleek full-width radar status bar
  if (sizeMode === 'COLLAPSED') {
    return (
      <div className="w-full bg-slate-900/95 backdrop-blur-md px-4 py-3 rounded-xl border border-slate-700/80 text-xs font-mono flex flex-wrap items-center justify-between gap-3 shadow-xl transition-all">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping absolute"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 relative"></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white uppercase tracking-wider text-xs">
              LIVE EMERGENCY MAP (MINIMIZED)
            </span>
            {emergencyId && (
              <span className="bg-rose-950/80 text-rose-300 border border-rose-800/80 px-2 py-0.5 rounded text-[11px] font-bold">
                {emergencyId}
              </span>
            )}
            {hasCoords && (
              <span className="text-slate-400 hidden md:inline text-[11px]">
                📍 {effectiveLat.toFixed(4)}°, {effectiveLng.toFixed(4)}° {address ? `• ${address}` : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleToggleSizeMode('COMPACT')}
            className="px-2.5 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition font-mono"
            title="Open 170px Compact Radar View"
          >
            Compact (170px)
          </button>
          <button
            onClick={() => handleToggleSizeMode('STANDARD')}
            className="px-3 py-1 text-[11px] rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer transition flex items-center gap-1.5 shadow font-mono"
            title="Restore Standard 380px View"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            <span>Show / Expand Map</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 shadow-2xl transition-all duration-300">
      
      {/* Top Map Tactical HUD overlay: Status + Zoom Controls + Recenter */}
      <div className="absolute top-3 left-3 z-[1000] bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/80 text-xs flex items-center gap-2 shadow-lg max-w-[90%] overflow-x-auto">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span className="font-mono font-bold text-white uppercase text-[11px] sm:text-xs">
            {engine === 'GOOGLE_MAPS' 
              ? (gmapTheme === 'STANDARD' ? 'GOOGLE MAPS' : gmapTheme === 'SATELLITE' ? 'GMAP SATELLITE' : 'GMAP NIGHT') 
              : 'TACTICAL MAP'}
          </span>
        </div>

        {hasCoords && (
          <span className="text-slate-400 border-l border-slate-700 pl-2 font-mono hidden md:inline text-[11px] shrink-0">
            {effectiveLat.toFixed(4)}°, {effectiveLng.toFixed(4)}°
          </span>
        )}

        {/* Recenter button */}
        <button
          onClick={handleRecenter}
          title="Recenter on Incident Location (Street Level)"
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 text-[11px] font-mono border border-slate-700 transition cursor-pointer shrink-0"
        >
          <Crosshair className="w-3 h-3" />
          <span className="hidden sm:inline">RECENTER</span>
        </button>

        {/* Quick Zoom Scale Presets */}
        <div className="hidden lg:flex items-center gap-1 border-l border-slate-700 pl-2 shrink-0">
          <button
            onClick={() => handleSetZoomPreset(16)}
            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono transition cursor-pointer"
            title="Street View Zoom (16)"
          >
            Street
          </button>
          <button
            onClick={() => handleSetZoomPreset(12)}
            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono transition cursor-pointer"
            title="City View Zoom (12)"
          >
            City
          </button>
          <button
            onClick={() => handleSetZoomPreset(6)}
            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono transition cursor-pointer"
            title="Region / State View Zoom (6)"
          >
            Region
          </button>
          <button
            onClick={() => handleSetZoomPreset(2)}
            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono transition cursor-pointer"
            title="Global World View Zoom (2)"
          >
            World
          </button>
        </div>

        {/* Explicit Zoom Controls (Zoom Out / Minimize Zoom, Zoom In) */}
        <div className="flex items-center gap-1 border-l border-slate-700 pl-2 shrink-0">
          <button
            onClick={handleZoomIn}
            title="Zoom In (Magnify)"
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            title="Zoom Out (Minimize Map Scale)"
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Top Right Controls: Theme Selector + Map Size Minimizer + Engine Switcher */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2">
        
        {/* Map Size / Minimizer Segmented Control */}
        <div className="bg-slate-900/95 backdrop-blur-md p-0.5 rounded-lg border border-slate-700 flex items-center text-[11px] font-mono shadow-lg">
          <button
            onClick={() => handleToggleSizeMode('COLLAPSED')}
            className="px-2 py-1 rounded cursor-pointer transition text-slate-400 hover:text-amber-400 hover:bg-slate-800 flex items-center gap-1"
            title="Minimize / Hide Map to Slim Bar"
          >
            <ChevronUp className="w-3 h-3" />
            <span className="hidden sm:inline">Minimize</span>
          </button>

          <button
            onClick={() => handleToggleSizeMode('COMPACT')}
            className={`px-2 py-1 rounded cursor-pointer transition ${
              sizeMode === 'COMPACT' ? 'bg-amber-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
            title="Compact Mini-Radar (170px)"
          >
            Compact
          </button>

          <button
            onClick={() => handleToggleSizeMode('STANDARD')}
            className={`px-2 py-1 rounded cursor-pointer transition ${
              sizeMode === 'STANDARD' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
            title="Standard View (380px)"
          >
            Standard
          </button>

          <button
            onClick={() => handleToggleSizeMode('EXPANDED')}
            className={`p-1 rounded cursor-pointer transition ${
              sizeMode === 'EXPANDED' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
            title="Full Tactical View (600px)"
          >
            {sizeMode === 'EXPANDED' ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Theme Pills for Google Maps */}
        {engine === 'GOOGLE_MAPS' && (
          <div className="bg-slate-900/95 backdrop-blur-md p-0.5 rounded-lg border border-slate-700 hidden sm:flex items-center text-[11px] font-mono shadow-lg">
            <button
              onClick={() => handleSwitchGmapTheme('STANDARD')}
              className={`px-2 py-1 rounded cursor-pointer transition ${
                gmapTheme === 'STANDARD' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Google Maps App Default View"
            >
              Default
            </button>
            <button
              onClick={() => handleSwitchGmapTheme('SATELLITE')}
              className={`px-2 py-1 rounded cursor-pointer transition ${
                gmapTheme === 'SATELLITE' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Satellite & Aerial Photography"
            >
              Satellite
            </button>
            <button
              onClick={() => handleSwitchGmapTheme('TACTICAL_NIGHT')}
              className={`px-2 py-1 rounded cursor-pointer transition ${
                gmapTheme === 'TACTICAL_NIGHT' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Tactical EOC Night View"
            >
              Night
            </button>
          </div>
        )}

        {/* Engine Switcher */}
        <div className="bg-slate-900/95 backdrop-blur-md p-0.5 rounded-lg border border-slate-700 flex items-center text-[11px] font-mono shadow-lg">
          <button
            onClick={() => handleSwitchEngine('GOOGLE_MAPS')}
            className={`px-2.5 py-1 rounded cursor-pointer transition flex items-center gap-1 ${
              engine === 'GOOGLE_MAPS' ? 'bg-red-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapIcon className="w-3 h-3" />
            <span>Google</span>
          </button>
          <button
            onClick={() => handleSwitchEngine('TACTICAL_LEAFLET')}
            className={`px-2.5 py-1 rounded cursor-pointer transition ${
              engine === 'TACTICAL_LEAFLET' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Free
          </button>
        </div>

        {engine === 'GOOGLE_MAPS' && (
          <button
            onClick={() => setShowKeyModal(true)}
            title="Configure Google Maps API Key"
            className="p-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-lg text-slate-300 hover:text-white cursor-pointer shadow-lg"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
          </button>
        )}
      </div>

      {/* Google Maps API Key Configuration Modal */}
      {showKeyModal && (
        <div className="absolute inset-0 z-[2000] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl text-xs font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-red-500" />
                Google Maps API Configuration
              </span>
              <button onClick={() => setShowKeyModal(false)} className="text-slate-400 hover:text-white text-base cursor-pointer">✕</button>
            </div>

            <p className="text-slate-300 text-[11px] leading-relaxed">
              GuardianBand integrates directly with the **Official Google Maps JavaScript API** with single-map street-level focus, satellite imagery, and Street View.
            </p>

            <div>
              <label className="text-slate-400 block mb-1">Google Maps Platform API Key:</label>
              <input
                type="text"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500 text-xs"
              />
            </div>

            <div className="text-[10px] text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
              <p className="text-amber-400 font-bold">💡 No billing account? Use the Maps Demo Key:</p>
              <p>You can get a free, instant prototyping key without billing at:</p>
              <a
                href="https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_git_agentskills_v1"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 underline flex items-center gap-1"
              >
                <span>mapsplatform.google.com/maps-demo-key</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  handleSwitchEngine('TACTICAL_LEAFLET');
                  setShowKeyModal(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                Use Tactical Map (No Key)
              </button>
              <button
                onClick={handleSaveKey}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold cursor-pointer"
              >
                Save & Load Google Maps
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Maps Error Overlay / Fallback prompt */}
      {engine === 'GOOGLE_MAPS' && gmapError && (
        <div className="absolute inset-0 z-[1000] bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center mb-3">
            ⚠️
          </div>
          <p className="text-amber-400 font-bold text-sm tracking-wider uppercase font-mono">
            {gmapError}
          </p>
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => setShowKeyModal(true)}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold rounded-lg cursor-pointer"
            >
              Enter API Key
            </button>
            <button
              onClick={() => handleSwitchEngine('TACTICAL_LEAFLET')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-lg cursor-pointer"
            >
              Switch to Tactical Map (Free / Ready)
            </button>
          </div>
        </div>
      )}

      {/* Coordinates Unavailable Overlay */}
      {!hasCoords && (
        <div className="absolute inset-0 z-[1000] bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center mb-3">
            ⚠️
          </div>
          <p className="text-amber-400 font-bold text-base tracking-wider uppercase font-mono">
            GPS LOCATION UNAVAILABLE
          </p>
          <p className="text-slate-400 text-xs mt-1 max-w-sm font-mono">
            Distress signal active via cellular telemetry. Cellular tower triangulation in progress.
          </p>
        </div>
      )}

      {/* Movement Path Indicator badge */}
      {locationHistory.length > 1 && (
        <div className="absolute bottom-3 left-3 z-[1000] bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded border border-rose-900/50 text-[11px] font-mono text-rose-300 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          MOVEMENT TRAIL: {locationHistory.length} GPS PINGS
        </div>
      )}

      {/* Map DOM Container */}
      <div ref={mapContainerRef} style={{ width: '100%', height: currentHeight }} />
    </div>
  );
};
