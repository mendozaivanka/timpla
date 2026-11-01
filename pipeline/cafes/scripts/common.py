"""Helpers shared by build_dataset.py (specialty layer) and build_directory.py (independent directory)."""
import csv, json, os, re, unicodedata

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
DATA = os.path.join(ROOT, "data")

# Brands that appear under more than one name in the sources → one canonical display name
ALIASES = {
    "harlan + holden coffee / because coffee": "harlan coffee (harlan + holden / Because Coffee)",
    "harlan + holden coffee": "harlan coffee (harlan + holden / Because Coffee)",
    "harlan+holden coffee": "harlan coffee (harlan + holden / Because Coffee)",
    "because coffee": "harlan coffee (harlan + holden / Because Coffee)",
    "craft coffee workshop": "Craft Coffee Revolution (ex Craft Coffee Workshop)",
    "craft coffee revolution": "Craft Coffee Revolution (ex Craft Coffee Workshop)",
    "commune cafe + bar + roaster": "Commune",
    "commune cafe + bar": "Commune",
    "yardstick": "Yardstick Coffee",
    "angkan": "ANGKAN Coffee Company",
    "angkan coffee": "ANGKAN Coffee Company",
    "pocket (pocket makati)": "Pocket",
    "oltre": "Oltre Specialty Coffee",
    "kape benito": "Kape Benito Community Cafe",
    "epic coffee roastery / epic bike cafe": "Epic Coffee Roastery",
    "ydg coffee (your daily grind)": "YDG Coffee",
    "twelve labors (coffee bar at the underbelly)": "Twelve Labors",
    "cafe barrios (inside ritual general store)": "Cafe Barrios (Ritual)",
}
def canonical(name):
    return ALIASES.get((name or "").strip().lower(), (name or "").strip())

def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[’'`.]", "", s)
    s = re.sub(r"\b(the|cafe|café|coffee|roasters?|roastery|co|ph|and|bar|bakery|kitchen|haus|house)\b", " ", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

def read_psv(path):
    if not os.path.exists(path):
        print(f"  ! missing {os.path.relpath(path, ROOT)}")
        return []
    rows, hdr = [], None
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line.strip() or line.startswith("#"):
                continue
            parts = [x.strip() for x in line.split("|")]
            if hdr is None:
                hdr = [h.lower().strip() for h in parts]
                continue
            rows.append(dict(zip(hdr, parts)))
    print(f"  {os.path.relpath(path, ROOT)}: {len(rows)} rows")
    return rows

def to_float(x):
    try:
        return float(str(x).replace(",", ""))
    except Exception:
        return None

# ───────── NCR point-in-polygon (ray casting over the ADM3 multipolygons) ─────────
def point_in_ring(x, y, ring):
    inside, n = False, len(ring)
    for i in range(n):
        x1, y1 = ring[i][0], ring[i][1]
        x2, y2 = ring[(i + 1) % n][0], ring[(i + 1) % n][1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1 + 1e-18) + x1:
            inside = not inside
    return inside

def point_in_geom(x, y, geom):
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    return any(point_in_ring(x, y, p[0]) and not any(point_in_ring(x, y, h) for h in p[1:]) for p in polys)

ncr = json.load(open(os.path.join(DATA, "ncr_adm3.geojson")))["features"]
MANILA_DISTRICTS = {"Binondo", "Ermita", "Intramuros", "Malate", "Paco", "Pandacan", "Port Area", "Quiapo", "Sampaloc",
                    "San Miguel", "San Nicolas", "Santa Ana", "Santa Cruz", "Tondo", "San Andres", "Santa Mesa"}
NCR_CITIES = {"caloocan", "las pinas", "makati", "malabon", "mandaluyong", "manila", "marikina", "muntinlupa", "navotas",
              "paranaque", "pasay", "pasig", "pateros", "quezon city", "quezon", "san juan", "taguig", "valenzuela", "bgc", "ortigas"}
CITY_SPELLING = {"Paranaque": "Parañaque", "Las Pinas": "Las Piñas", "BGC": "Taguig", "Ortigas": "Pasig"}
def clean_city(s):
    """'City of Makati' → 'Makati'; 'Quezon' → 'Quezon City'; Manila districts → 'Manila'; 'Makati; Taguig' → 'Makati'."""
    s = (s or "").split(";")[0].split("(")[0].strip()
    s = re.sub(r"^City of\s+", "", s).replace(" City", "").strip()
    if s == "Quezon": s = "Quezon City"
    if s in MANILA_DISTRICTS: s = "Manila"
    return CITY_SPELLING.get(s, s)
def ncr_unit(lat, lon):
    for f in ncr:
        if point_in_geom(lon, lat, f["geometry"]):
            return clean_city(f["properties"].get("shapeName"))
    return None
def city_in_ncr(city):
    return unicodedata.normalize("NFKD", clean_city(city)).encode("ascii", "ignore").decode().lower() in NCR_CITIES
