import { licenseAccess } from '@/lib/license';
import { getAuth } from '@/lib/auth';
import { db } from '@/lib/db';
export async function GET(request:Request) {
 try {
  const session=await getAuth().api.getSession({headers:request.headers});
  if(!session)return Response.json({error:'Unauthorized'},{status:401});const licenseFailure=await licenseAccess(session);if(licenseFailure)return licenseFailure;
  const [result]=await db().collection('clients').aggregate([
   {$match:{ownerId:session.user.id}},
   {$facet:{total:[{$count:'count'}],status:[{$group:{_id:'$status',count:{$sum:1}}}],streams:[{$group:{_id:{$ifNull:['$wasteStream','plastic']},count:{$sum:1}}}],categories:[{$group:{_id:{$concat:[{$ifNull:['$wasteStream','plastic']},':',{$ifNull:['$registrationCategory','pibo']}]},count:{$sum:1}}}]}}
  ]).toArray();
  const map=(rows:{_id:string;count:number}[])=>Object.fromEntries(rows.map(row=>[row._id,row.count]));
  const status=map(result.status);
  return Response.json({total:result.total[0]?.count||0,draft:status.draft||0,submitted:status.submitted||0,streams:map(result.streams),categories:map(result.categories)});
 }catch{return Response.json({error:'Unable to load dashboard totals'},{status:503});}
}
