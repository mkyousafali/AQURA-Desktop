-- RPC Function to discover all public tables in Supabase
-- Run this SQL in your Supabase SQL Editor or via SSH

CREATE OR REPLACE FUNCTION get_public_tables()
RETURNS TABLE (
  tablename text,
  schemaname text,
  tableowner text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.tablename::text,
    t.schemaname::text,
    t.tableowner::text
  FROM pg_catalog.pg_tables t
  WHERE t.schemaname = 'public'
    AND t.tablename NOT LIKE 'pg_%'
    AND t.tablename NOT LIKE 'sql_%'
    AND t.tablename != 'spatial_ref_sys'
    AND t.tablename != 'geography_columns'
    AND t.tablename != 'geometry_columns'
    AND t.tablename != 'raster_columns'
    AND t.tablename != 'raster_overviews'
  ORDER BY t.tablename;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION get_public_tables() TO service_role;
GRANT EXECUTE ON FUNCTION get_public_tables() TO anon;
GRANT EXECUTE ON FUNCTION get_public_tables() TO authenticated;

-- Test the function
SELECT * FROM get_public_tables();
