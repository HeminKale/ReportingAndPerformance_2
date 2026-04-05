import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id, organizations(slug)')
    .eq('id', user.id)
    .single();

  if (userData?.organizations) {
    const orgSlug = (userData.organizations as any).slug;
    redirect(`/org/${orgSlug}/dashboard`);
  }

  redirect('/login');
}
