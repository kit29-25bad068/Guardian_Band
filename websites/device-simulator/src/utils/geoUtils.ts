export interface GeocodedLocation {
  latitude: number;
  longitude: number;
  address: string;
  accuracy?: number;
  raw?: any;
}

export interface PlaceSearchResult {
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  category?: string;
}

/**
 * Intelligently formats OpenStreetMap Nominatim data into a clean, human-readable address.
 * Prioritizes: Landmark/College/Hospital/Building -> Area/Locality -> City/District -> State -> Pincode
 */
export function formatNominatimAddress(data: any): string {
  if (!data) return 'Location Unknown';
  const addr = data.address || {};

  const poi = 
    data.name || 
    addr.amenity || 
    addr.building || 
    addr.college || 
    addr.university || 
    addr.school || 
    addr.hospital || 
    addr.office || 
    addr.shop || 
    addr.tourism || 
    addr.leisure || 
    '';

  const road = addr.road || addr.street || addr.pedestrian || '';
  const area = addr.suburb || addr.neighbourhood || addr.village || addr.residential || addr.locality || '';
  const city = addr.city || addr.town || addr.municipality || addr.state_district || addr.county || '';
  const state = addr.state || '';
  const pincode = addr.postcode || '';

  const components: string[] = [];
  if (poi) components.push(poi);
  if (road && road !== poi && !road.startsWith('KM ') && !road.includes('Nagapattinam-Mysore')) {
    components.push(road);
  }
  if (area && area !== poi && !components.includes(area)) {
    components.push(area);
  }
  if (city && city !== area && city !== poi && !components.includes(city)) {
    components.push(city);
  }
  if (state && !components.includes(state)) {
    components.push(state);
  }
  if (pincode) {
    components.push(pincode);
  }

  if (components.length > 0) {
    return components.join(', ');
  }

  if (data.display_name) {
    return data.display_name.split(',').map((p: string) => p.trim()).slice(0, 4).join(', ');
  }

  return 'Coordinates Recorded';
}

/**
 * Reverse geocodes latitude/longitude into a high-precision landmark/street address
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'GuardianBand-Safety-System/2.0'
        }
      }
    );
    if (res.ok) {
      const data = await res.json();
      return formatNominatimAddress(data);
    }
  } catch (err) {
    console.warn('[geoUtils] Reverse geocode error:', err);
  }
  return `${lat.toFixed(5)}°, ${lon.toFixed(5)}°`;
}

/**
 * Search places/landmarks/colleges by text query
 */
export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&addressdetails=1&limit=5`,{
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'GuardianBand-Safety-System/2.0'
        }
      }
    );
    if (res.ok) {
      const results = await res.json();
      return results.map((item: any) => ({
        name: item.name || formatNominatimAddress(item),
        displayName: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        category: item.type || item.class
      }));
    }
  } catch (err) {
    console.warn('[geoUtils] Place search error:', err);
  }
  return [];
}
