-- Update existing product_variants rows
UPDATE public.product_variants 
SET color = 'Default' 
WHERE color = 'Atelier Choice';

-- Update existing products colors array if needed
UPDATE public.products
SET colors = array_replace(colors, 'Atelier Choice', 'Default')
WHERE 'Atelier Choice' = ANY(colors);
