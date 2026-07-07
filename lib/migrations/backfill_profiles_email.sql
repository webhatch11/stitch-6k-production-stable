-- Backfill profiles.email for users whose trigger may have missed it
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
AND (p.email IS NULL OR p.email = '')
AND u.email IS NOT NULL;

-- Report: before vs after
SELECT 
  COUNT(*) as total_profiles,
  COUNT(email) as profiles_with_email,
  COUNT(*) - COUNT(email) as missing_email
FROM public.profiles;
