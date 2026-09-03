/**
 * Fetches data from OpenStreetMap via the Overpass API.
 */

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export async function checkWaterProximity(lat, lon, radius = 2000) {
  // Query for water bodies (rivers, lakes, etc) within radius (meters)
  const query = `
    [out:json][timeout:10];
    (
      way["waterway"](around:${radius},${lat},${lon});
      relation["waterway"](around:${radius},${lat},${lon});
      way["natural"="water"](around:${radius},${lat},${lon});
      relation["natural"="water"](around:${radius},${lat},${lon});
    );
    out body 1;
  `;
  
  try {
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      body: query
    });
    const data = await response.json();
    return data && data.elements && data.elements.length > 0;
  } catch (error) {
    console.error("Error fetching water data:", error);
    return false; // default to false on error
  }
}

export async function fetchRoads(lat, lon, radius = 2000) {
  // Query for major and minor roads within the radius
  const query = `
    [out:json][timeout:25];
    (
      way["highway"~"motorway|trunk|primary|secondary|tertiary|residential"](around:${radius},${lat},${lon});
    );
    out geom;
  `;
  
  try {
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      body: query
    });
    const data = await response.json();
    
    // Convert to simple GeoJSON LineStrings
    const features = [];
    if (data && data.elements) {
      data.elements.forEach(element => {
        if (element.geometry && element.geometry.length > 1) {
          const coordinates = element.geometry.map(pt => [pt.lon, pt.lat]);
          features.push({
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: coordinates
            },
            properties: {
              name: element.tags?.name || "Unknown Road",
              highway: element.tags?.highway
            }
          });
        }
      });
    }
    return {
      type: "FeatureCollection",
      features: features
    };
  } catch (error) {
    console.error("Error fetching road data:", error);
    return { type: "FeatureCollection", features: [] };
  }
}
