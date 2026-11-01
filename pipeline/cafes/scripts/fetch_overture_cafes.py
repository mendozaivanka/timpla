import duckdb, json, sys
out = sys.argv[1]
con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';")
q = """
SELECT id, names.primary AS name, taxonomy.primary AS cat, basic_category AS basic, confidence,
       brand.names.primary AS brand, ST_X(geometry) AS lon, ST_Y(geometry) AS lat, operating_status AS status,
       list_transform(sources, lambda s: s.dataset) AS datasets,
       list_max(list_transform(sources, lambda s: s.update_time)) AS updated,
       len(socials) AS nsocial, len(websites) AS nweb
FROM read_parquet('s3://overturemaps-us-west-2/release/2026-09-23.1/theme=places/type=place/*', hive_partitioning=1)
WHERE bbox.xmin BETWEEN 120.90 AND 121.15 AND bbox.ymin BETWEEN 14.35 AND 14.80
  AND taxonomy.primary IN ('cafe','coffee_shop','tea_room','coffee_roastery','bakery_cafe')
"""
rows = con.execute(q).fetchall()
cols = ["id","name","cat","basic","confidence","brand","lon","lat","status","datasets","updated","nsocial","nweb"]
json.dump([dict(zip(cols, r)) for r in rows], open(out, "w"), default=str)
print(len(rows), "overture rows")
