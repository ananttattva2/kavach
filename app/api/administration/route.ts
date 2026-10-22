import { isAdministrator } from '@/lib/roles';
import { licenseAccess } from '@/lib/license';
import { getAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ObjectId } from 'mongodb';
export async function GET(request:Request){
 try{
  const session=await getAuth().api.getSession({headers:request.headers});
  if(!session)return Response.json({error:'Unauthorized'},{status:401});const licenseFailure=await licenseAccess(session);if(licenseFailure)return licenseFailure;
  if(!isAdministrator(session.user.role))return Response.json({error:'Administrator access required'},{status:403});
  const sessionRows=await db().collection('session').find({}, {projection:{token:0}}).sort({createdAt:-1}).limit(50).toArray();
  const userIds=sessionRows.map(row=>row.userId).filter(Boolean);
  const users=await db().collection('user').find({_id:{$in:userIds.map(id=>ObjectId.isValid(String(id))?new ObjectId(String(id)):id)}}).project({name:1,email:1}).toArray();
  const userMap=new Map(users.map(user=>[String(user._id),user]));
  const companies=await db().collection('clients').aggregate([{$group:{_id:'$basic.Client legal name',count:{$sum:1},updatedAt:{$max:'$updatedAt'}}},{$sort:{updatedAt:-1}},{$limit:100}]).toArray();
  const [userCount,clientCount,activeSessions]=await Promise.all([db().collection('user').countDocuments(),db().collection('clients').countDocuments(),db().collection('session').countDocuments({expiresAt:{$gt:new Date()}})]);
  return Response.json({userCount,clientCount,activeSessions,companies:companies.map(row=>({name:row._id||'Untitled company',records:row.count,updatedAt:row.updatedAt})),sessions:sessionRows.map(row=>({id:String(row._id),name:userMap.get(String(row.userId))?.name||'Account',email:userMap.get(String(row.userId))?.email||'',createdAt:row.createdAt,expiresAt:row.expiresAt,ipAddress:row.ipAddress||''}))});
 }catch{return Response.json({error:'Unable to load administration data'},{status:503});}
}
