import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

type Status = 'Open' | 'In Progress' | 'Clarify' | 'Done'
const VALID_STATUSES: Status[] = ['Open', 'In Progress', 'Clarify', 'Done']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: commentId } = await params
    const body = await req.json()
    const restoreToStatus: Status = body.restoreToStatus

    if (!VALID_STATUSES.includes(restoreToStatus)) {
      return NextResponse.json({ error: `Invalid status: ${restoreToStatus}` }, { status: 400 })
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('comments')
      .select('status')
      .eq('id', commentId)
      .eq('user_id', user.id)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    const { error: updateError } = await supabase
      .from('comments')
      .update({ status: restoreToStatus })
      .eq('id', commentId)
      .eq('user_id', user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    await supabase.from('status_changes').insert({
      comment_id: commentId,
      old_status: existing.status,
      new_status: restoreToStatus,
      changed_by: user.email,             // ✅ correct column
      changed_at: new Date().toISOString(),
    })

    return NextResponse.json({ success: true, restoredTo: restoreToStatus })
  } catch (err) {
    console.error('[POST /api/comments/[id]/restore] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}