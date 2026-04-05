import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { email, password, fullName, role, managerId, timezone } = await request.json();

    if (!email || !password || !fullName || !role) {
      return NextResponse.json(
        { error: 'Email, password, full name, and role are required' },
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

    const { data: callerData } = await supabase
      .from('users')
      .select('role, organization_id')
      .eq('id', authUser.id)
      .single();

    if (callerData?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can create users' },
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

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        organization_id: callerData.organization_id,
        email,
        full_name: fullName,
        role,
        manager_id: managerId || null,
        timezone: timezone || 'UTC',
      });

    if (userError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: userError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      userId: authData.user.id,
    });

  } catch (error: any) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: error.message || 'User creation failed' },
      { status: 500 }
    );
  }
}
