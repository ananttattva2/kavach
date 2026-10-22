import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { ModuleExperience } from '@/components/module-experience';
import { preload } from 'react-dom';
export const dynamic = 'force-dynamic';
export default async function ModulesPage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  preload('/images/plastic.webp', { as: 'image', fetchPriority: 'high' });
  return <ModuleExperience name={session.user.name || session.user.email.split('@')[0]}/>;
}
