import fs from 'fs';
import * as turf from '@turf/turf';

// Configuration
const GRID_SIZE = 40;
const CENTER = [76.32, 9.98]; // Kochi
const CELL_SIZE_KM = 0.1; // 100 meters per cell

// Create a synthetic elevation grid (lower in middle, higher at edges, with a slope)
const grid = [];
for (let y = 0; y < GRID_SIZE; y++) {
  const row = [];
  for (let x = 0; x < GRID_SIZE; x++) {
    // distance from center (approx)
    const dx = x - GRID_SIZE / 2;
    const dy = y - GRID_SIZE / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Create a valley running diagonally
    const valleyDist = Math.abs(dx - dy);
    
    let elevation = 10 + dist * 0.5 + valleyDist * 0.8;
    // add some noise
    elevation += Math.random() * 2;
    row.push(elevation);
  }
  grid.push(row);
}

const startX = Math.floor(GRID_SIZE / 2);
const startY = Math.floor(GRID_SIZE / 2);
grid[startY][startX] = 5; // force low point

// BFS Flood Fill
let flooded = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(false));
let currentWaterLevel = 7;
let floodQueue = [{ x: startX, y: startY, time: 0 }];
flooded[startY][startX] = true;

const timesteps = [];
const maxTime = 10;

for (let t = 0; t <= maxTime; t++) {
  // Increase water level
  currentWaterLevel += 1.5;
  
  // Find all cells that get flooded at this timestep
  let newQueue = [];
  while (floodQueue.length > 0) {
    const cell = floodQueue.shift();
    newQueue.push(cell); // keep it for next time
    
    // Check neighbors
    const neighbors = [
      { dx: 0, dy: 1 }, { dx: 1, dy: 0 },
      { dx: 0, dy: -1 }, { dx: -1, dy: 0 },
      { dx: 1, dy: 1 }, { dx: -1, dy: -1 },
      { dx: 1, dy: -1 }, { dx: -1, dy: 1 }
    ];
    
    for (const n of neighbors) {
      const nx = cell.x + n.dx;
      const ny = cell.y + n.dy;
      
      if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
        if (!flooded[ny][nx] && grid[ny][nx] <= currentWaterLevel) {
          flooded[ny][nx] = true;
          newQueue.push({ x: nx, y: ny, time: t + 1 });
        }
      }
    }
  }
  
  floodQueue = newQueue;
  
  // Generate geometry for currently flooded cells
  let cellsGeoJSON = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (flooded[y][x]) {
        // Find time it was flooded
        const floodedCell = floodQueue.find(c => c.x === x && c.y === y);
        const floodedTime = floodedCell ? floodedCell.time : 0;
        
        // Compute dist from center
        const dx = x - startX;
        const dy = y - startY;
        const cellDist = Math.sqrt(dx*dx + dy*dy);
        
        // confidence = max(20, 95 - (timestep * 8) - (cell_distance_from_source * 2))
        const confidence = Math.max(20, 95 - (t * 6) - (cellDist * 1.5));
        
        // compute lat/lon for cell
        // 1 degree lat is ~ 111km. 1 degree lon at 10 deg is ~ 109km.
        const lat = CENTER[1] + (y - startY) * (CELL_SIZE_KM / 111);
        const lon = CENTER[0] + (x - startX) * (CELL_SIZE_KM / 109);
        
        const pt = turf.point([lon, lat], {
          confidence: Math.round(confidence),
          elevation: grid[y][x],
          floodedTime: floodedTime
        });
        cellsGeoJSON.push(pt);
      }
    }
  }
  
  if (cellsGeoJSON.length > 0) {
    const fc = turf.featureCollection(cellsGeoJSON);
    // Create a buffered polygon representing the flood zone
    // Wait, let's just output the points and frontend can render them as Hexagons or we output the concave hull
    try {
      const hull = turf.concave(fc, { maxEdge: CELL_SIZE_KM * 2, units: 'kilometers' });
      if (hull) {
          // We can attach the average confidence to the polygon
          let totalConf = 0;
          fc.features.forEach(f => totalConf += f.properties.confidence);
          hull.properties = {
              confidence: Math.round(totalConf / fc.features.length),
              population_affected: Math.round(cellsGeoJSON.length * 15 * (1 + t*0.1)) // proxy for people
          };
          timesteps.push({
            time: t,
            polygon: hull
          });
      }
    } catch(e) {
      // If concave fails (e.g., too few points), use bounding box or convex hull
      try {
         const hull = turf.convex(fc);
         if (hull) {
             timesteps.push({
               time: t,
               polygon: hull
             });
         }
      } catch(e2) {
         // ignore
      }
    }
  }
}

const data = {
  hazardType: "flood",
  center: CENTER,
  timesteps: timesteps
};

fs.writeFileSync('./public/simulation.json', JSON.stringify(data, null, 2));
console.log("Simulation data generated at public/simulation.json");
