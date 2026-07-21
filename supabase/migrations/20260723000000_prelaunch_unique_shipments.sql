-- Add unique constraint on shipments(order_id) to prevent duplicate fulfillment dispatch
ALTER TABLE public.shipments DROP CONSTRAINT IF EXISTS unique_shipment_order_id;
ALTER TABLE public.shipments ADD CONSTRAINT unique_shipment_order_id UNIQUE (order_id);
