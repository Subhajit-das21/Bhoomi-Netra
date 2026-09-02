import json
import math
import os
import random

# Configuration
GRID_SIZE = 40
CENTER = [88.435, 22.632] # Rajarhat, Kolkata
CELL_SIZE_KM = 0.1
MAX_TIME = 10

def get_lat_lon(x, y, start_x, start_y):
    # 1 deg lat ~ 111 km, 1 deg lon at 22 deg ~ 103 km
    lat = CENTER[1] + (y - start_y) * (CELL_SIZE_KM / 111.0)
    lon = CENTER[0] + (x - start_x) * (CELL_SIZE_KM / 103.0)
    return lon, lat

def make_polygon(lon, lat):
    half_cell_lon = (CELL_SIZE_KM / 103.0) / 2
    half_cell_lat = (CELL_SIZE_KM / 111.0) / 2
    return [
        [lon - half_cell_lon, lat - half_cell_lat],
        [lon + half_cell_lon, lat - half_cell_lat],
        [lon + half_cell_lon, lat + half_cell_lat],
        [lon - half_cell_lon, lat + half_cell_lat],
        [lon - half_cell_lon, lat - half_cell_lat]
    ]

# -----------------
# 1. FLOOD SIMULATION
# -----------------
def generate_flood():
    grid = []
    for y in range(GRID_SIZE):
        row = []
        for x in range(GRID_SIZE):
            dx = x - GRID_SIZE / 2
            dy = y - GRID_SIZE / 2
            dist = math.sqrt(dx * dx + dy * dy)
            valleyDist = abs(dx - dy)
            elevation = 10 + dist * 0.5 + valleyDist * 0.8
            noise = (x * 37 + y * 17) % 10 / 5.0
            row.append(elevation + noise)
        grid.append(row)

    start_x = int(GRID_SIZE / 2)
    start_y = int(GRID_SIZE / 2)
    grid[start_y][start_x] = 5 

    flooded = [[False for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
    current_water_level = 7.0
    flood_queue = [{"x": start_x, "y": start_y, "time": 0}]
    flooded[start_y][start_x] = True

    timesteps = []
    for t in range(MAX_TIME + 1):
        current_water_level += 1.5
        new_queue = []
        for cell in flood_queue:
            new_queue.append(cell)
            cx, cy = cell["x"], cell["y"]
            neighbors = [(0, 1), (1, 0), (0, -1), (-1, 0), (1, 1), (-1, -1), (1, -1), (-1, 1)]
            for dx, dy in neighbors:
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < GRID_SIZE and 0 <= ny < GRID_SIZE:
                    if not flooded[ny][nx] and grid[ny][nx] <= current_water_level:
                        flooded[ny][nx] = True
                        new_queue.append({"x": nx, "y": ny, "time": t + 1})
        
        flood_queue = new_queue
        
        features = []
        total_conf = 0
        cell_count = 0
        
        for y in range(GRID_SIZE):
            for x in range(GRID_SIZE):
                if flooded[y][x]:
                    flooded_time = next((c["time"] for c in flood_queue if c["x"] == x and c["y"] == y), 0)
                    dx = x - start_x
                    dy = y - start_y
                    cell_dist = math.sqrt(dx*dx + dy*dy)
                    confidence = max(20, 95 - (t * 6) - (cell_dist * 1.5))
                    total_conf += confidence
                    cell_count += 1
                    
                    lon, lat = get_lat_lon(x, y, start_x, start_y)
                    features.append({
                        "type": "Feature",
                        "geometry": { "type": "Polygon", "coordinates": [make_polygon(lon, lat)] },
                        "properties": { "confidence": round(confidence), "floodedTime": flooded_time }
                    })
        
        if features:
            avg_conf = round(total_conf / cell_count)
            pop = round(cell_count * 15 * (1 + t * 0.1))
            timesteps.append({
                "time": t, "confidence": avg_conf, "population_affected": pop,
                "geojson": { "type": "FeatureCollection", "features": features }
            })

    return {"hazardType": "flood", "center": CENTER, "timesteps": timesteps}


# -----------------
# 2. FIRE SIMULATION
# -----------------
def generate_fire():
    # Vegetation density grid
    veg = []
    for y in range(GRID_SIZE):
        row = []
        for x in range(GRID_SIZE):
            # some patchy vegetation
            density = 0.5 + 0.5 * math.sin(x * 0.2) * math.cos(y * 0.2)
            row.append(max(0.1, min(1.0, density)))
        veg.append(row)

    start_x = int(GRID_SIZE / 2)
    start_y = int(GRID_SIZE / 2)
    
    burning = [[False for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
    burned = [[False for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
    
    burning_cells = [{"x": start_x, "y": start_y, "time": 0}]
    burning[start_y][start_x] = True
    
    # Wind blowing towards North-East (dx=1, dy=1 roughly in grid logic, wait up is dy=-1 depending on mapping)
    # Let's say wind favors x increasing, y increasing
    wind_dx = 1
    wind_dy = 1

    timesteps = []
    all_burned = []
    
    for t in range(MAX_TIME + 1):
        new_burning = []
        for cell in burning_cells:
            cx, cy = cell["x"], cell["y"]
            all_burned.append(cell)
            burned[cy][cx] = True
            
            # Spread to neighbors
            neighbors = [(0, 1), (1, 0), (0, -1), (-1, 0), (1, 1), (-1, -1), (1, -1), (-1, 1)]
            for dx, dy in neighbors:
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < GRID_SIZE and 0 <= ny < GRID_SIZE:
                    if not burning[ny][nx] and not burned[ny][nx]:
                        # Base prob * vegetation
                        prob = 0.3 * veg[ny][nx]
                        # Wind factor
                        if dx == wind_dx and dy == wind_dy:
                            prob *= 2.0
                        elif dx == -wind_dx and dy == -wind_dy:
                            prob *= 0.2
                        
                        # Use pseudo-random seeded by coords to keep it deterministic for demo
                        rnd = ((nx * 13 + ny * 31 + t * 7) % 100) / 100.0
                        if rnd < prob:
                            burning[ny][nx] = True
                            new_burning.append({"x": nx, "y": ny, "time": t + 1})
                            
        burning_cells = new_burning
        
        # Build features from all_burned + burning_cells
        features = []
        total_conf = 0
        cell_count = 0
        
        active_and_past = all_burned + burning_cells
        for c in active_and_past:
            cx, cy, ctime = c["x"], c["y"], c["time"]
            
            dx = cx - start_x
            dy = cy - start_y
            cell_dist = math.sqrt(dx*dx + dy*dy)
            confidence = max(20, 95 - (t * 6) - (cell_dist * 1.5))
            
            total_conf += confidence
            cell_count += 1
            
            lon, lat = get_lat_lon(cx, cy, start_x, start_y)
            features.append({
                "type": "Feature",
                "geometry": { "type": "Polygon", "coordinates": [make_polygon(lon, lat)] },
                "properties": { 
                    "confidence": round(confidence), 
                    "isNew": ctime == t # True if just ignited
                }
            })
            
        if features:
            avg_conf = round(total_conf / cell_count)
            pop = round(cell_count * 10 * (1 + t * 0.1))
            timesteps.append({
                "time": t, "confidence": avg_conf, "population_affected": pop,
                "geojson": { "type": "FeatureCollection", "features": features }
            })
            
    return {"hazardType": "fire", "center": CENTER, "timesteps": timesteps}


os.makedirs('public', exist_ok=True)
with open('public/flood_sim.json', 'w') as f:
    json.dump(generate_flood(), f)
with open('public/fire_sim.json', 'w') as f:
    json.dump(generate_fire(), f)

print("Generated flood_sim.json and fire_sim.json")
