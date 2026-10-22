import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { userLicenseStatus } from '@/lib/license';
import { ProfilePage } from '@/components/profile-page';
export const dynamic='force-dynamic';
export default async function Profile(){const session=await getAuth().api.getSession({headers:await headers()});if(!session)redirect('/login');const licensed=(await userLicenseStatus(session)).isActive;return <ProfilePage backHref={licensed?'/dashboard':'/license'}/>;}
