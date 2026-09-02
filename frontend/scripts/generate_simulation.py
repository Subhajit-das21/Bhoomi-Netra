import json
import math
import os

# Configuration
GRID_SIZE = 40
CENTER = [76.32, 9.98] # Kochi, Kerala
CELL_SIZE_KM = 0.1 # 100 meters per cell
MAX_TIME = 10

# Create a synthetic elevation grid
grid = []
for y in range(GRID_SIZE):
    row = []
    for x in range(GRID_SIZE):
        dx = x - GRID_SIZE / 2
        dy = y - GRID_SIZE / 2
        dist = math.sqrt(dx * dx + dy * dy)
        valleyDist = abs(dx - dy)
        elevation = 10 + dist * 0.5 + valleyDist * 0.8
        # small pseudo-random noise
        noise = (x * 37 + y * 17) % 10 / 5.0
        row.append(elevation + noise)
    grid.append(row)

start_x = int(GRID_SIZE / 2)
start_y = int(GRID_SIZE / 2)
grid[start_y][start_x] = 5 # lowest point

flooded = [[False for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
current_water_level = 7.0
flood_queue = [{"x": start_x, "y": start_y, "time": 0}]
flooded[start_y][start_x] = True

timesteps = []

def get_lat_lon(x, y):
    lat = CENTER[1] + (y - start_y) * (CELL_SIZE_KM / 111.0)
    lon = CENTER[0] + (x - start_x) * (CELL_SIZE_KM / 109.0)
    return lon, lat

for t in range(MAX_TIME + 1):
    current_water_level += 1.5
    
    new_queue = []
    for cell in flood_queue:
        new_queue.append(cell)
        cx, cy = cell["x"], cell["y"]
        neighbors = [
            (0, 1), (1, 0), (0, -1), (-1, 0),
            (1, 1), (-1, -1), (1, -1), (-1, 1)
        ]
        for dx, dy in neighbors:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < GRID_SIZE and 0 <= ny < GRID_SIZE:
                if not flooded[ny][nx] and grid[ny][nx] <= current_water_level:
                    flooded[ny][nx] = True
                    new_queue.append({"x": nx, "y": ny, "time": t + 1})
    
    flood_queue = new_queue
    
    # generate geometry for currently flooded cells
    # We will output a GeoJSON feature collection of cell squares
    features = []
    
    total_conf = 0
    cell_count = 0
    
    for y in range(GRID_SIZE):
        for x in range(GRID_SIZE):
            if flooded[y][x]:
                # Find flooded time
                flooded_time = 0
                for c in flood_queue:
                    if c["x"] == x and c["y"] == y:
                        flooded_time = c["time"]
                        break
                
                dx = x - start_x
                dy = y - start_y
                cell_dist = math.sqrt(dx*dx + dy*dy)
                confidence = max(20, 95 - (t * 6) - (cell_dist * 1.5))
                total_conf += confidence
                cell_count += 1
                
                lon, lat = get_lat_lon(x, y)
                half_cell_lon = (CELL_SIZE_KM / 109.0) / 2
                half_cell_lat = (CELL_SIZE_KM / 111.0) / 2
                
                polygon = [
                    [lon - half_cell_lon, lat - half_cell_lat],
                    [lon + half_cell_lon, lat - half_cell_lat],
                    [lon + half_cell_lon, lat + half_cell_lat],
                    [lon - half_cell_lon, lat + half_cell_lat],
                    [lon - half_cell_lon, lat - half_cell_lat]
                ]
                
                features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [polygon]
                    },
                    "properties": {
                        "confidence": round(confidence),
                        "elevation": grid[y][x],
                        "floodedTime": flooded_time
                    }
                })
    
    if len(features) > 0:
        avg_conf = round(total_conf / cell_count)
        pop = round(cell_count * 15 * (1 + t * 0.1))
        
        timesteps.append({
            "time": t,
            "confidence": avg_conf,
            "population_affected": pop,
            "geojson": {
                "type": "FeatureCollection",
                "features": features
            }
        })

data = {
    "hazardType": "flood",
    "center": CENTER,
    "timesteps": timesteps
}

os.makedirs('public', exist_ok=True)
with open('public/simulation.json', 'w') as f:
    json.dump(data, f)
print("Simulation data generated at public/simulation.json")
