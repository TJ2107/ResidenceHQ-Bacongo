// Brazzaville GPS Coordinate & Geolocation Engine for Brazzaville Express

export interface GpsCoordinates {
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number | null;
  heading?: number | null;
  timestamp?: number;
  isRealGps: boolean;
}

export interface MapPoint {
  x: number;
  y: number;
}

// Bounding box for Brazzaville urban area on our SVG canvas (600x450)
export const BRAZZAVILLE_BOUNDS = {
  northLat: -4.220, // North limit (Talangaï / Ouenzé nord)
  southLat: -4.330, // South limit (Makélékélé / Djoué)
  westLng: 15.220,  // West limit (Makélékélé ouest)
  eastLng: 15.330,  // East limit (Mpila / Fleuve Congo)
};

/**
 * Converts real device GPS (lat, lng) into SVG coordinate space (600x450).
 * Handles coordinates anywhere in the world gracefully by clamping and interpolating.
 */
export function convertGpsToMap(lat: number, lng: number): MapPoint {
  const { northLat, southLat, westLng, eastLng } = BRAZZAVILLE_BOUNDS;
  
  // Normalization
  const normX = (lng - westLng) / (eastLng - westLng);
  const normY = (lat - northLat) / (southLat - northLat);

  // Map into SVG viewBox bounds (width: 600, height: 450) with margins
  const x = Math.round(Math.max(40, Math.min(560, 50 + normX * 500)));
  const y = Math.round(Math.max(40, Math.min(410, 40 + normY * 360)));

  return { x, y };
}

/**
 * Converts SVG map point (x, y) into realistic Brazzaville GPS coordinates.
 */
export function convertMapToGps(x: number, y: number): { lat: number; lng: number } {
  const { northLat, southLat, westLng, eastLng } = BRAZZAVILLE_BOUNDS;
  
  const normX = Math.max(0, Math.min(1, (x - 50) / 500));
  const normY = Math.max(0, Math.min(1, (y - 40) / 360));

  const lng = Number((westLng + normX * (eastLng - westLng)).toFixed(6));
  const lat = Number((northLat + normY * (southLat - northLat)).toFixed(6));

  return { lat, lng };
}

/**
 * Calculates accurate real-world distance in meters using the Haversine formula.
 */
export function calculateHaversineDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Calculates distance in meters directly between two SVG map coordinate points
 * using the Brazzaville scale (~25 meters per map pixel).
 */
export function calculateMapDistanceMeters(p1: MapPoint, p2: MapPoint): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const distPixels = Math.sqrt(dx * dx + dy * dy);
  return Math.round(distPixels * 24); // 1 SVG pixel ≈ 24 meters in urban grid
}

/**
 * Formats distance in meters to a clean human-readable string (e.g., "450 m" or "3.2 km").
 */
export function formatGpsDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Calculates estimated travel time in minutes based on distance in meters.
 */
export function calculateGpsEtaMinutes(meters: number, avgSpeedKmh: number = 28): string {
  const speedMps = (avgSpeedKmh * 1000) / 3600;
  const seconds = meters / speedMps;
  const minutes = Math.ceil(seconds / 60);
  if (minutes <= 1) return '< 1 min';
  return `${minutes} min`;
}

/**
 * Calculates compass heading bearing from point A to point B in degrees (0..360).
 */
export function calculateBearingDegrees(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((bearing + 360) % 360);
}

/**
 * Generates an external Google Maps turn-by-turn navigation URL.
 */
export function getGoogleMapsNavigationUrl(destLat: number, destLng: number, originLat?: number, originLng?: number): string {
  if (originLat && originLng) {
    return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=driving`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${destLat},${destLng}`;
}
