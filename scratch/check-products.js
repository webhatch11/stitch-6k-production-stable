const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

async function main() {
  const supabaseService = createClient(supabaseUrl, serviceKey);
  const supabaseAnon = createClient(supabaseUrl, anonKey);

  const { data: sData, error: sErr } = await supabaseService.from('products').select('*');
  console.log('Service role fetch products:', sData ? sData.length : 0, 'rows', sErr || '');

  const { data: aData, error: aErr } = await supabaseAnon.from('products').select('*');
  console.log('Anon role fetch products:', aData ? aData.length : 0, 'rows', aErr || '');
}

main().catch(console.error);
