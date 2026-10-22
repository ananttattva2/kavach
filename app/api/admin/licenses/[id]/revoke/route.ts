import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { mustAuthenticate,checkOrigin,licenseResponse,LicenseError } from '@/lib/license';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){try{checkOrigin(request);await mustAuthenticate(request,true);const{id}=await params;if(!ObjectId.isValid(id))throw new LicenseError(400,'Invalid license ID.','INVALID_INPUT');const result=await db().collection('licenses').updateOne({_id:new ObjectId(id)},{$set:{status:'revoked',updatedAt:new Date()}});if(!result.matchedCount)throw new LicenseError(404,'License not found.','NOT_FOUND');await db().collection('session_licenses').deleteMany({licenseId:new ObjectId(id)});return Response.json({success:true});}catch(error){return licenseResponse(error);}}
