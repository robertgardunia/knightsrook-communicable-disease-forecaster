CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
LOAD 'age';
CREATE EXTENSION IF NOT EXISTS age;
SET search_path = ag_catalog, "$user", public;
SELECT * FROM ag_catalog.create_graph('graph');
