import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { ObjectId } from 'mongodb';
import { getAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { userLicenseStatus } from '@/lib/license';
import { type ClientData } from '@/lib/schema';
import { PreAuditWorkspace } from '@/components/pre-audit-workspace';
export const dynamic='force-dynamic';
export default async function PreAudit({params}:{params:Promise<{id:string}>}) {
 const session=await getAuth().api.getSession({headers:await headers()});
 if(!session)redirect('/login');
 if(!(await userLicenseStatus(session)).isActive)redirect('/license');
 const {id}=await params;if(!ObjectId.isValid(id))notFound();
 const record=await db().collection('clients').findOne({_id:new ObjectId(id),ownerId:session.user.id});
 if(!record)notFound();
 const client=JSON.parse(JSON.stringify({...record,id,_id:undefined})) as ClientData;
 return <PreAuditWorkspace client={client}/>;
}
