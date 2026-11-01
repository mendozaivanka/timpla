[out:json][timeout:240];
area["name"="Metro Manila"]["admin_level"="3"]->.a;
(
  nwr["amenity"="cafe"](area.a);
  nwr["shop"="coffee"](area.a);
  nwr["cuisine"~"coffee"](area.a);
);
out center meta;
