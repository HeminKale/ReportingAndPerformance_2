import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabase = await createClient();

    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (userId === authUser.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 403 }
      );
    }

    const { data: callerData } = await supabase
      .from('users')
      .select('role, organization_id')
      .eq('id', authUser.id)
      .single();

    if (callerData?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can delete users' },
        { status: 403 }
      );
    }

    const { data: targetUser } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .single();

    if (targetUser?.organization_id !== callerData.organization_id) {
      return NextResponse.json(
        { error: 'Cannot delete users from other organizations' },
        { status: 403 }
      );
    }

    const supabaseAdmin = createAdminClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
    });

  } catch (error: any) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: error.message || 'User deletion failed' },
      { status: 500 }
    );
  }
}
