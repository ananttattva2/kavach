import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { Workspace } from '@/components/workspace';
export const dynamic='force-dynamic';
export default async function Dashboard(){const session=await getAuth().api.getSession({headers:await headers()});if(!session)redirect('/login');return <Workspace name={session.user.name||session.user.email.split('@')[0]} email={session.user.email}/>;}
