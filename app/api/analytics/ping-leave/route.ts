import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const { sessionId } = JSON.parse(body)
    
    if (!sessionId) {
      return NextResponse.json({ ok: false })
    }

    // Mark as inactive by backdating last_seen
    // 2 minutes in past = outside active window
    await supabase
      .from('page_views')
      .update({ 
        last_seen: new Date(
          Date.now() - 2 * 60 * 1000
        ).toISOString()
      })
      .eq('session_id', sessionId)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
