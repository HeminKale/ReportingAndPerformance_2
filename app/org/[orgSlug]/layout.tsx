import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TopNav } from '@/components/shared/top-nav';

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

  if (!userData || (userData.organizations as any)?.slug !== orgSlug) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <TopNav orgSlug={orgSlug} userRole={userData.role} userId={user.id} userName={userData.full_name} />
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-16">
        {children}
      </main>
    </div>
  );
}
