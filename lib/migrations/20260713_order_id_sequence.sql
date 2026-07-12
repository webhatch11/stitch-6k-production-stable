CREATE SEQUENCE IF NOT EXISTS public.order_id_seq START 1;

CREATE OR REPLACE FUNCTION public.get_next_order_sequence()
RETURNS INTEGER
LANGUAGE sql
AS $$
  SELECT nextval('public.order_id_seq')::INTEGER;
$$;

SELECT setval('public.order_id_seq', 
  COALESCE(
    (SELECT MAX(
      CAST(regexp_replace(id, '^6K-(RPO|WPO)-0*', '') AS INTEGER)
    ) FROM public.orders 
    WHERE id ~ '^6K-(RPO|WPO)-\d+$'),
    0
  )
);
