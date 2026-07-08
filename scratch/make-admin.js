const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
});

const targetEmail = 'abishekdr2004@gmail.com';

async function makeAdmin() {
  console.log(`Searching for profile with email: ${targetEmail}...`);
  
  // 1. Check if user profile exists
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', targetEmail)
    .single();

  if (fetchError) {
    console.error("Error fetching profile:", fetchError.message);
    console.log("This might mean the user has not signed up or verified their OTP even once, or the trigger hasn't run.");
    
    // Let's also check if user exists in auth.users
    console.log("Checking auth.users table...");
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
      console.error("Error listing auth users:", authError.message);
    } else {
      const matchedUser = authUsers.users.find(u => u.email?.toLowerCase() === targetEmail.toLowerCase());
      if (matchedUser) {
        console.log(`Found user in auth.users with ID: ${matchedUser.id}. But profile was missing. Attempting to insert profile...`);
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: matchedUser.id,
            email: targetEmail,
            role: 'admin',
            name: 'Eshwar',
            wallet_balance: 2500,
            loyalty_points: 500
          });
        if (insertError) {
          console.error("Error inserting admin profile:", insertError.message);
        } else {
          console.log("Successfully created admin profile!");
        }
      } else {
        console.log(`No user found in auth.users for ${targetEmail}. Please ask them to attempt logging in once first so their auth user is created.`);
      }
    }
    return;
  }

  console.log("Found profile:", profile);
  if (profile.role === 'admin') {
    console.log("User is already set as 'admin' in profiles table.");
    return;
  }

  console.log(`Updating role to 'admin' for ${targetEmail}...`);
  const { data: updatedProfile, error: updateError } = await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('email', targetEmail)
    .select();

  if (updateError) {
    console.error("Error updating profile role:", updateError.message);
  } else {
    console.log("Successfully promoted user to admin! Updated profile data:", updatedProfile);
  }
}

makeAdmin();
