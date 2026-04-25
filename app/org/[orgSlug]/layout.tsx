import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/shared/sidebar';

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: userData } = await supabase
    .from('users')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single();

  const org = userData?.organizations as { slug: string; name: string } | null | undefined;

  if (!userData || org?.slug !== orgSlug) {
    redirect('/login');
  }

  const monthStart = `${format(new Date(), 'yyyy-MM')}-01`;
  const { data: lbRow } = await supabase
    .from('leaderboard')
    .select('score')
    .eq('user_id', user.id)
    .eq('organization_id', userData.organization_id)
    .eq('month', monthStart)
    .maybeSingle();

  return (
    <div className="flex h-screen">
      <Sidebar
        orgSlug={orgSlug}
        orgName={org?.name}
        userRole={userData.role}
        userId={user.id}
        userName={userData.full_name}
        totalXp={lbRow?.score ?? 0}
      />
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-slate-50">
        {children}
      </main>
    </div>
  );
}
