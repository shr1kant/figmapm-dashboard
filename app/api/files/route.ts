import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ files: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ✅ Safe body parse
  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid or empty request body' }, { status: 400 })
  }

  const { figma_file_key, file_name, thumbnail_url, pat } = body

  if (!figma_file_key || !file_name) {
    return NextResponse.json({ error: 'figma_file_key and file_name are required' }, { status: 400 })
  }

  if (pat) {
    // ✅ Fixed upsert
    const { error: tokenError } = await supabase
      .from('figma_tokens')
      .upsert(
        { user_id: user.id, figma_access_token: pat, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    if (tokenError) console.error('Failed to save PAT:', tokenError.message)
  }

  const { data, error } = await supabase
    .from('files')
    .insert({ user_id: user.id, figma_file_key, file_name, thumbnail_url })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ file: data }, { status: 201 })
}