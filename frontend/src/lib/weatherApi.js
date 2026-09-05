/**
 * Weather API Client for Open-Meteo.
 * Provides live meteorological forecasts without requiring an API key.
 */

/**
 * Maps standard WMO weather interpretation codes to human-readable descriptions.
 *
 * @param {number|string|null|undefined} code - WMO weather code.
 * @returns {string} Human-readable weather description.
 */
export function getWeatherDescription(code) {
  if (code == null) return 'Unknown';
  const num = Number(code);
  if (isNaN(num)) return 'Unknown';

  if (num === 0) return 'Clear';
  if (num >= 1 && num <= 3) return 'Partly cloudy';
  if (num >= 45 && num <= 48) return 'Foggy';
  if (num >= 51 && num <= 55) return 'Drizzle';
  if (num >= 61 && num <= 65) return 'Rain';
  if (num >= 71 && num <= 75) return 'Snow';
  if (num >= 80 && num <= 82) return 'Showers';
  if (num >= 95 && num <= 99) return 'Thunderstorm';

  return 'Unknown';
}

/**
 * Fetches current weather data for given latitude and longitude coordinates.
 *
 * @param {number|string} lat - Latitude coordinate.
 * @param {number|string} lng - Longitude coordinate.
 * @returns {Promise<{
 *   temperature: number|null,
 *   humidity: number|null,
 *   windSpeed: number|null,
 *   precipitation: number|null,
 *   weatherCode: number|null,
 *   description: string
 * }|null>} Current weather details, or null on failure.
 */
export async function fetchWeather(lat, lng) {
  if (lat == null || lng == null || isNaN(Number(lat)) || isNaN(Number(lng))) {
    console.warn('fetchWeather: lat and lng must be valid numbers', { lat, lng });
    return null;
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code&timezone=auto`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`Open-Meteo API error: HTTP ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const current = data?.current;

    if (!current) {
      console.warn('Open-Meteo API returned response without current weather data:', data);
      return null;
    }

    const weatherCode = current.weather_code ?? null;

    return {
      temperature: current.temperature_2m ?? null,
      humidity: current.relative_humidity_2m ?? null,
      windSpeed: current.wind_speed_10m ?? null,
      precipitation: current.precipitation ?? 0,
      weatherCode,
      description: getWeatherDescription(weatherCode),
    };
  } catch (error) {
    console.warn(`Error fetching weather data for (${lat}, ${lng}):`, error);
    return null;
  }
}

export default fetchWeather;
