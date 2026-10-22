import { isAdministrator } from '@/lib/roles';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuth } from '@/lib/auth';
import { LicenseManagement } from '@/components/license-pages';
import { KavachBrand } from '@/components/kavach-brand';
export const dynamic='force-dynamic';
export default async function LicensesPage(){const session=await getAuth().api.getSession({headers:await headers()});if(!session)redirect('/login');if(!isAdministrator(session.user.role))redirect('/license');return <div className="account-page"><header className="account-topbar"><KavachBrand href="/license"/><div><Link href="/license">License verification</Link><Link href="/profile">My profile</Link></div></header><main className="account-main"><LicenseManagement/></main></div>;}
