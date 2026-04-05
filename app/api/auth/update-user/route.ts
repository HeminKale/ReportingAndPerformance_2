import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function PATCH(request: Request) {
  try {
    const { userId, email, password, fullName, role, managerId, timezone } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const cookieStore = cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    });

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
        { error: 'Only admins can update users' },
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
        { error: 'Cannot update users from other organizations' },
        { status: 403 }
      );
    }

    if (userId === authUser.id && role && role !== callerData.role) {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 403 }
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    if (email || password) {
      const updateData: any = {};
      if (email) updateData.email = email;
      if (password) updateData.password = password;

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        updateData
      );

      if (authError) {
        return NextResponse.json(
          { error: authError.message },
          { status: 400 }
        );
      }
    }

    const updateFields: any = {};
    if (email) updateFields.email = email;
    if (fullName) updateFields.full_name = fullName;
    if (role) updateFields.role = role;
    if (managerId !== undefined) updateFields.manager_id = managerId || null;
    if (timezone) updateFields.timezone = timezone;

    const { error: userError } = await supabaseAdmin
      .from('users')
      .update(updateFields)
      .eq('id', userId);

    if (userError) {
      return NextResponse.json(
        { error: userError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
    });

  } catch (error: any) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: error.message || 'User update failed' },
      { status: 500 }
    );
  }
}
