import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

type FigmaComment = {
  id: string
  message: string
  file_key: string
  parent_id?: string | null
  order_id?: number | null
  created_at: string
  resolved_at?: string | null
  user?: { id: string; handle: string; name: string }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const fileKey = req.nextUrl.searchParams.get('fileKey')
    if (!fileKey) {
      return NextResponse.json({ error: 'fileKey query param is required' }, { status: 400 })
    }

    const { data: tokenRow, error: tokenError } = await supabase
      .from('figma_tokens')
      .select('figma_access_token')
      .eq('user_id', user.id)
      .single()

    if (tokenError || !tokenRow?.figma_access_token) {
      return NextResponse.json(
        { error: 'No Figma PAT found. Please add a file with your PAT first.' },
        { status: 403 }
      )
    }

    const figmaRes = await fetch(
      `https://api.figma.com/v1/files/${fileKey}/comments`,
      {
        method: 'GET',
        headers: {
          'X-Figma-Token': tokenRow.figma_access_token,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!figmaRes.ok) {
      const text = await figmaRes.text()
      console.error('[/api/comments] Figma API error:', figmaRes.status, text)
      // ✅ Always return 500 internally — never pass Figma's status code to client
      return NextResponse.json(
        { error: `Figma API error ${figmaRes.status}: ${text.slice(0, 200)}` },
        { status: 500 }
      )
    }

    const figmaData = await figmaRes.json()
    const allComments: FigmaComment[] = figmaData.comments ?? []
    const activeComments = allComments.filter((c) => !c.resolved_at)

    if (activeComments.length > 0) {
      const rows = activeComments.map((c) => ({
        id: c.id,
        file_key: fileKey,
        user_id: user.id,
        figma_user_name: c.user?.name ?? null,
        figma_user_handle: c.user?.handle ?? null,
        message: c.message,
        parent_id: c.parent_id ?? null,
        order_id: c.order_id ?? null,
        created_at: c.created_at,
        resolved_at: c.resolved_at ?? null,
        raw: c,
      }))

      const { error: upsertError } = await supabase
        .from('comments')
        .upsert(rows, { onConflict: 'id', ignoreDuplicates: false })

      if (upsertError) {
        console.error('[/api/comments] Upsert error:', upsertError)
        return NextResponse.json({ error: upsertError.message }, { status: 500 })
      }
    }

    const { data: savedComments, error: fetchError } = await supabase
      .from('comments')
      .select('id, file_key, figma_user_name, message, parent_id, order_id, status, created_at, raw')
      .eq('file_key', fileKey)
      .eq('user_id', user.id)
      .is('resolved_at', null)
      .order('order_id', { ascending: true })

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const { data: fileRow } = await supabase
      .from('files')
      .select('file_name')
      .eq('figma_file_key', fileKey)
      .eq('user_id', user.id)
      .single()

    return NextResponse.json({
      comments: savedComments ?? [],
      file_name: fileRow?.file_name ?? fileKey,
    })
  } catch (err) {
    console.error('[/api/comments] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}