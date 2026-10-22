import { licenseAccess } from '@/lib/license';
import { getAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';
import type { WorkspaceNotification } from '@/lib/notifications';
type ReadState={_id:string;readIds:string[];updatedAt:Date};
export async function GET(request:Request){
 try{
  const session=await getAuth().api.getSession({headers:request.headers});
  if(!session)return Response.json({error:'Unauthorized'},{status:401});const licenseFailure=await licenseAccess(session);if(licenseFailure)return licenseFailure;
  const [clients,state,profile]=await Promise.all([db().collection('clients').find({ownerId:session.user.id}).sort({updatedAt:-1}).limit(30).toArray(),db().collection<ReadState>('notification_state').findOne({_id:session.user.id}),db().collection<{_id:string;preferences?:{clientUpdates?:boolean;documentUpdates?:boolean;draftReminders?:boolean}}>('user_profiles').findOne({_id:session.user.id},{projection:{preferences:1}})]);
  const read=new Set(state?.readIds||[]);const items:WorkspaceNotification[]=[];
  for(const client of clients){
   const clientId=String(client._id);const company=client.basic?.['Client legal name']||'Untitled company';
   const createdAt=new Date(client.createdAt||client.updatedAt).toISOString(),updatedAt=new Date(client.updatedAt||client.createdAt).toISOString();
   const target={clientId,wasteStream:client.wasteStream||'plastic',category:client.registrationCategory||'pibo'};
   const label=target.wasteStream==='ewaste'?'E-Waste':'Plastic Waste';
   const registeredId='client:'+clientId;
   items.push({...target,id:registeredId,title:'Client registration created',description:company+' · '+label,createdAt,type:'client',read:read.has(registeredId)});
   if(client.status==='draft'){const id='draft:'+clientId+':'+updatedAt;items.push({...target,id,title:'Onboarding pending',description:company+' · Continue your saved draft.',createdAt:updatedAt,type:'reminder',read:read.has(id)});}
   const files=(client.documents||[]).filter((document:{fileId?:string})=>document.fileId).length;
   if(files){const id='documents:'+clientId+':'+updatedAt;items.push({...target,id,title:'Client documents available',description:company+' · '+files+' uploaded document'+(files===1?'':'s'),createdAt:updatedAt,type:'document',read:read.has(id)});}
  }
  const welcomeId='welcome:'+session.user.id;
  items.push({id:welcomeId,title:'Welcome to KAVACH',description:'Your workspace is ready. Start by adding a client.',createdAt:new Date(session.user.createdAt).toISOString(),type:'welcome',read:read.has(welcomeId)});
  items.sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
  const visible=items.filter(item=>item.type==='client'?profile?.preferences?.clientUpdates!==false:item.type==='document'?profile?.preferences?.documentUpdates!==false:item.type==='reminder'?profile?.preferences?.draftReminders!==false:true);return Response.json({items:visible,unreadCount:visible.filter(item=>!item.read).length},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({error:'Unable to load notifications'},{status:503});}
}
export async function PATCH(request:Request){
 try{
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
  const session=await getAuth().api.getSession({headers:request.headers});
  if(!session)return Response.json({error:'Unauthorized'},{status:401});const licenseFailure=await licenseAccess(session);if(licenseFailure)return licenseFailure;
  const parsed=z.object({ids:z.array(z.string().min(1).max(150)).min(1).max(100)}).safeParse(await request.json());
  if(!parsed.success)return Response.json({error:'Invalid notification selection'},{status:400});
  await db().collection<ReadState>('notification_state').updateOne({_id:session.user.id},{$addToSet:{readIds:{$each:parsed.data.ids}},$set:{updatedAt:new Date()}},{upsert:true});
  return Response.json({success:true});
 }catch{return Response.json({error:'Unable to update notifications'},{status:503});}
}
