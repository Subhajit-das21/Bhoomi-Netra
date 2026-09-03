export function generateDynamicSimulation(centerLon, centerLat, hazardType, radiusKm = 5) {
  // Use a denser grid for a smoother, production-level look
  const GRID_SIZE = 80;
  const CELL_SIZE_KM = (radiusKm * 2) / GRID_SIZE;
  const MAX_TIME = 10;
  
  const latScale = 111.0;
  const lonScale = 111.0 * Math.cos(centerLat * Math.PI / 180);
  
  const getLatLon = (x, y, start_x, start_y) => {
    const lat = centerLat + (y - start_y) * (CELL_SIZE_KM / latScale);
    const lon = centerLon + (x - start_x) * (CELL_SIZE_KM / lonScale);
    return [lon, lat];
  };

  const makePolygon = (lon, lat) => {
    // Add a tiny bit of overlap (1.05 multiplier) to hide seams between cells
    const half_lon = ((CELL_SIZE_KM / lonScale) / 2) * 1.05;
    const half_lat = ((CELL_SIZE_KM / latScale) / 2) * 1.05;
    return [
      [lon - half_lon, lat - half_lat],
      [lon + half_lon, lat - half_lat],
      [lon + half_lon, lat + half_lat],
      [lon - half_lon, lat + half_lat],
      [lon - half_lon, lat - half_lat]
    ];
  };

  const start_x = Math.floor(GRID_SIZE / 2);
  const start_y = Math.floor(GRID_SIZE / 2);
  
  const timesteps = [];
  
  if (hazardType === 'flood') {
    const grid = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      const row = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        const dx = x - start_x;
        const dy = y - start_y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const valleyDist = Math.abs(dx - dy);
        const elevation = 10 + dist * 0.5 + valleyDist * 0.8;
        const noise = (x * 37 + y * 17) % 10 / 5.0;
        row.push(elevation + noise);
      }
      grid.push(row);
    }
    grid[start_y][start_x] = 5; 

    const flooded = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
    let current_water_level = 7.0;
    let flood_queue = [{ x: start_x, y: start_y, time: 0 }];
    flooded[start_y][start_x] = true;

    for (let t = 0; t <= MAX_TIME; t++) {
      current_water_level += 1.5;
      const new_queue = [];
      
      for (const cell of flood_queue) {
        new_queue.push(cell);
        const { x: cx, y: cy } = cell;
        const neighbors = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]];
        
        for (const [dx, dy] of neighbors) {
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
            if (!flooded[ny][nx] && grid[ny][nx] <= current_water_level) {
              flooded[ny][nx] = true;
              new_queue.push({ x: nx, y: ny, time: t + 1 });
            }
          }
        }
      }
      flood_queue = new_queue;
      
      const features = [];
      let total_conf = 0;
      let cell_count = 0;
      
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          if (flooded[y][x]) {
            const floodedCell = flood_queue.find(c => c.x === x && c.y === y);
            const flooded_time = floodedCell ? floodedCell.time : 0;
            const cell_dist = Math.sqrt(Math.pow(x - start_x, 2) + Math.pow(y - start_y, 2));
            const confidence = Math.max(20, 95 - (t * 6) - (cell_dist * 1.5));
            total_conf += confidence;
            cell_count++;
            
            const [lon, lat] = getLatLon(x, y, start_x, start_y);
            features.push({
              type: "Feature",
              geometry: { type: "Polygon", coordinates: [makePolygon(lon, lat)] },
              properties: { confidence: Math.round(confidence), floodedTime: flooded_time }
            });
          }
        }
      }
      
      if (features.length > 0) {
        timesteps.push({
          time: t,
          confidence: Math.round(total_conf / cell_count),
          population_affected: Math.round(cell_count * 15 * (1 + t * 0.1)),
          geojson: { type: "FeatureCollection", features }
        });
      }
    }
  } else if (hazardType === 'fire') {
    const veg = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      const row = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        const density = 0.5 + 0.5 * Math.sin(x * 0.2) * Math.cos(y * 0.2);
        row.push(Math.max(0.1, Math.min(1.0, density)));
      }
      veg.push(row);
    }

    const burning = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
    const burned = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
    
    let burning_cells = [{ x: start_x, y: start_y, time: 0 }];
    burning[start_y][start_x] = true;
    
    const wind_dx = 1, wind_dy = 1;
    const all_burned = [];

    for (let t = 0; t <= MAX_TIME; t++) {
      const new_burning = [];
      for (const cell of burning_cells) {
        all_burned.push(cell);
        const { x: cx, y: cy } = cell;
        burned[cy][cx] = true;
        
        const neighbors = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]];
        for (const [dx, dy] of neighbors) {
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
            if (!burning[ny][nx] && !burned[ny][nx]) {
              let prob = 0.3 * veg[ny][nx];
              if (dx === wind_dx && dy === wind_dy) prob *= 2.0;
              else if (dx === -wind_dx && dy === -wind_dy) prob *= 0.2;
              
              const rnd = ((nx * 13 + ny * 31 + t * 7) % 100) / 100.0;
              if (rnd < prob) {
                burning[ny][nx] = true;
                new_burning.push({ x: nx, y: ny, time: t + 1 });
              }
            }
          }
        }
      }
      burning_cells = new_burning;
      
      const features = [];
      let total_conf = 0;
      let cell_count = 0;
      
      const active_and_past = [...all_burned, ...burning_cells];
      for (const c of active_and_past) {
        const { x: cx, y: cy, time: ctime } = c;
        const cell_dist = Math.sqrt(Math.pow(cx - start_x, 2) + Math.pow(cy - start_y, 2));
        const confidence = Math.max(20, 95 - (t * 6) - (cell_dist * 1.5));
        
        total_conf += confidence;
        cell_count++;
        
        const [lon, lat] = getLatLon(cx, cy, start_x, start_y);
        features.push({
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [makePolygon(lon, lat)] },
          properties: { confidence: Math.round(confidence), isNew: ctime === t }
        });
      }
      
      if (features.length > 0) {
        timesteps.push({
          time: t,
          confidence: Math.round(total_conf / cell_count),
          population_affected: Math.round(cell_count * 10 * (1 + t * 0.1)),
          geojson: { type: "FeatureCollection", features }
        });
      }
    }
  } else if (hazardType === 'earthquake') {
    // EARTHQUAKE SIMULATION (Expanding seismic intensity rings)
    for (let t = 0; t <= MAX_TIME; t++) {
      const features = [];
      let total_conf = 0;
      let cell_count = 0;
      
      const currentRadius = t * 4.5; 
      
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const dx = x - start_x;
          const dy = y - start_y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist <= currentRadius + 5) {
            let intensity = 100 - (dist * (100 / (GRID_SIZE / 1.5)));
            const noise = (Math.sin(x * 13.3) * Math.cos(y * 17.7) * 15);
            intensity = Math.max(10, Math.min(100, intensity + noise));
            
            const isShockwave = Math.abs(dist - currentRadius) < 3.5;
            
            total_conf += intensity;
            cell_count++;
            
            const [lon, lat] = getLatLon(x, y, start_x, start_y);
            features.push({
              type: "Feature",
              geometry: { type: "Polygon", coordinates: [makePolygon(lon, lat)] },
              properties: { confidence: intensity, isNew: isShockwave }
            });
          }
        }
      }
      
      if (features.length > 0) {
        timesteps.push({
          time: t,
          confidence: Math.round(total_conf / cell_count),
          population_affected: Math.round(cell_count * 25), 
          geojson: { type: "FeatureCollection", features }
        });
      }
    }
  }

  return {
    hazardType,
    center: [centerLon, centerLat],
    radiusKm,
    timesteps
  };
}
