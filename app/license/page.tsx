import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { userLicenseStatus } from '@/lib/license';
import { LicenseActivation } from '@/components/license-pages';
export const dynamic='force-dynamic';
export default async function LicensePage(){const session=await getAuth().api.getSession({headers:await headers()});if(!session)redirect('/login');if((await userLicenseStatus(session)).isActive)redirect('/dashboard');return <LicenseActivation email={session.user.email} role={session.user.role||'user'}/>;}
