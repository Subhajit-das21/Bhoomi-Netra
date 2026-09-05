/**
 * Earthquake API Client for USGS Live Feeds.
 * Fetches real-time M2.5+ earthquake events from the USGS GeoJSON feed.
 */

const USGS_EARTHQUAKE_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';

/**
 * Fetches live M2.5+ earthquakes from USGS for the past 24 hours.
 *
 * @returns {Promise<Array<{
 *   id: string,
 *   lat: number,
 *   lng: number,
 *   depth: number,
 *   magnitude: number|null,
 *   place: string,
 *   time: number|null,
 *   url: string,
 *   tsunami: number,
 *   type: string,
 *   felt: number|null,
 *   alert: string|null
 * }>>} Array of earthquake records, or an empty array on error.
 */
export async function fetchEarthquakes() {
  try {
    const response = await fetch(USGS_EARTHQUAKE_URL);

    if (!response.ok) {
      console.warn(`USGS Earthquake API error: HTTP ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();

    if (!data || !Array.isArray(data.features)) {
      console.warn('USGS Earthquake API returned unexpected data structure:', data);
      return [];
    }

    return data.features.map((feature) => {
      const coords = feature?.geometry?.coordinates || [];
      const props = feature?.properties || {};

      const lng = typeof coords[0] === 'number' ? coords[0] : parseFloat(coords[0]) || 0;
      const lat = typeof coords[1] === 'number' ? coords[1] : parseFloat(coords[1]) || 0;
      const depth = typeof coords[2] === 'number' ? coords[2] : parseFloat(coords[2]) || 0;

      return {
        id: feature.id || props.code || `eq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        lat,
        lng,
        depth,
        magnitude: typeof props.mag === 'number' ? props.mag : null,
        place: props.place || 'Unknown location',
        time: props.time || null,
        url: props.url || '',
        tsunami: props.tsunami ?? 0,
        type: props.type || 'earthquake',
        felt: props.felt ?? null,
        alert: props.alert ?? null,
      };
    });
  } catch (error) {
    console.warn('Error fetching earthquake data from USGS:', error);
    return [];
  }
}

export default fetchEarthquakes;
