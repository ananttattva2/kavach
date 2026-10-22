import { createHash, randomBytes } from 'node:crypto';
import { ObjectId, type Filter } from 'mongodb';
import { db } from './db';
import { getAuth } from './auth';
import { z } from 'zod';
import { authOrigins } from './auth-origins';

export type SignedInSession=NonNullable<Awaited<ReturnType<ReturnType<typeof getAuth>['api']['getSession']>>>;
type Device={deviceId:string;deviceName:string;appVersion:string;activatedAt:Date;lastValidatedAt:Date;lastSeenAt:Date;tokenHash?:string;tokenExpiresAt?:Date};
export type LicenseRecord={_id:ObjectId;keyHash:string;keyPrefix:string;keyLast4:string;assignedEmail:string;issuedToName:string;assignedUser?:string|ObjectId|null;status:'active'|'revoked'|'expired'|'suspended';maxDevices:number;expiresAt:Date|null;notes:string;createdBy:string;activatedDevices:Device[];createdAt:Date;updatedAt:Date;lastIssuedAt:Date;lastValidatedAt?:Date|null;userActivatedAt?:Date|null};
type Verification={_id:string;userId:string;licenseId:ObjectId;verifiedUntil:Date;verifiedAt:Date};
type Attempts={_id:string;failedAttempts:number;lockedUntil:Date|null;busyUntil?:Date};
export class LicenseError extends Error{constructor(public status:number,message:string,public code='LICENSE_REQUIRED'){super(message);}}
export const normalizeKey=(key:string)=>key.toUpperCase().replace(/[^A-Z0-9]/g,'');
export const hashKey=(key:string)=>createHash('sha256').update(normalizeKey(key)).digest('hex');
const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');
const licenses=()=>db().collection<LicenseRecord>('licenses');
export const label=(record:LicenseRecord)=>record.keyPrefix+'-****-****-'+record.keyLast4;
export const effectiveStatus=(record:LicenseRecord)=>record.status==='revoked'?'revoked':record.expiresAt&&record.expiresAt.getTime()<=Date.now()?'expired':record.status;
const activeFilter=():Filter<LicenseRecord>=>({status:'active',$or:[{expiresAt:null},{expiresAt:{$gt:new Date()}}]});
function belongs(record:LicenseRecord,session:SignedInSession){return record.assignedEmail.toLowerCase()===session.user.email.toLowerCase()&&(!record.assignedUser||String(record.assignedUser)===session.user.id);}
export function publicLicense(record:LicenseRecord){return{id:String(record._id),status:effectiveStatus(record),assignedEmail:record.assignedEmail,issuedToName:record.issuedToName,keyLabel:label(record),maxDevices:record.maxDevices,expiresAt:record.expiresAt,notes:record.notes,createdAt:record.createdAt,lastIssuedAt:record.lastIssuedAt,lastValidatedAt:record.lastValidatedAt||null,activatedDevices:(record.activatedDevices||[]).map(({deviceId,deviceName,appVersion,activatedAt,lastValidatedAt,lastSeenAt})=>({deviceId,deviceName,appVersion,activatedAt,lastValidatedAt,lastSeenAt}))};}
export async function userLicenseStatus(session:SignedInSession){
 const [verified,attempts]=await Promise.all([db().collection<Verification>('session_licenses').findOne({_id:session.session.id,userId:session.user.id}),db().collection<Attempts>('license_attempts').findOne({_id:session.user.id})]);
 let record=verified?await licenses().findOne({_id:verified.licenseId}):null;
 if(!record)record=await licenses().find({assignedEmail:session.user.email.toLowerCase()}).sort({createdAt:-1}).limit(1).next();
 const isActive=Boolean(record&&verified&&String(verified.licenseId)===String(record._id)&&verified.verifiedUntil>new Date()&&effectiveStatus(record)==='active'&&belongs(record,session));
 return {status:record?effectiveStatus(record):'unassigned',isActive,requiresVerification:!isActive,license:record?publicLicense(record):null,verifiedUntil:isActive?verified!.verifiedUntil:null,activationLockedUntil:attempts?.lockedUntil&&attempts.lockedUntil>new Date()?attempts.lockedUntil:null};
}
export async function licenseAccess(session:SignedInSession){const status=await userLicenseStatus(session);return status.isActive?null:Response.json({error:'Verify an active license to access your workspace.',code:'LICENSE_REQUIRED'},{status:403});}
export async function mustAuthenticate(request:Request,admin=false){const session=await getAuth().api.getSession({headers:request.headers});if(!session)throw new LicenseError(401,'Please sign in.','UNAUTHORIZED');if(admin&&session.user.role!=='admin')throw new LicenseError(403,'Administrator access required.','FORBIDDEN');return session;}
export function checkOrigin(request:Request){if(!authOrigins(process.env.BETTER_AUTH_URL).includes(request.headers.get('origin')||''))throw new LicenseError(403,'Invalid origin.','INVALID_ORIGIN');}
export function licenseResponse(error:unknown){if(error instanceof LicenseError)return Response.json({error:error.message,code:error.code},{status:error.status,headers:{'Cache-Control':'no-store'}});if(error instanceof z.ZodError)return Response.json({error:error.issues[0]?.message||'Invalid license request',code:'INVALID_INPUT'},{status:400});console.error('License operation failed:',error instanceof Error?error.name:'Unknown error');return Response.json({error:'License service unavailable. Please try again.'},{status:503});}
export const issueSchema=z.object({assignedEmail:z.email().transform(value=>value.trim().toLowerCase()),issuedToName:z.string().trim().min(2).max(100),maxDevices:z.coerce.number().int().min(1).max(10),expiresAt:z.string().datetime().nullable().optional(),notes:z.string().trim().max(1000).default('')}).refine(value=>!value.expiresAt||new Date(value.expiresAt)>new Date(),{message:'Expiry must be in the future',path:['expiresAt']});
export async function issueLicense(input:z.infer<typeof issueSchema>,admin:SignedInSession){
 await licenses().createIndex({keyHash:1},{unique:true});
 const compact='KVCH'+randomBytes(16).toString('hex').toUpperCase();const licenseKey=compact.match(/.{1,4}/g)!.join('-');
 const assigned=await db().collection('user').findOne({email:input.assignedEmail});const now=new Date();
 const record:LicenseRecord={_id:new ObjectId(),keyHash:hashKey(compact),keyPrefix:compact.slice(0,4),keyLast4:compact.slice(-4),assignedEmail:input.assignedEmail,issuedToName:input.issuedToName,assignedUser:assigned?String(assigned._id):null,status:'active',maxDevices:input.maxDevices,expiresAt:input.expiresAt?new Date(input.expiresAt):null,notes:input.notes,createdBy:admin.user.id,activatedDevices:[],createdAt:now,updatedAt:now,lastIssuedAt:now};
 await licenses().insertOne(record);return{licenseKey,license:publicLicense(record)};
}
export async function activateWeb(session:SignedInSession,key:string){
 const collection=db().collection<Attempts>('license_attempts');const now=new Date();
 await collection.updateOne({_id:session.user.id},{$setOnInsert:{failedAttempts:0,lockedUntil:null}},{upsert:true});
 const lease=await collection.findOneAndUpdate({_id:session.user.id,$or:[{busyUntil:{$lte:now}},{busyUntil:{$exists:false}}]},{$set:{busyUntil:new Date(Date.now()+30000)}},{returnDocument:'after'});
 if(!lease)throw new LicenseError(429,'An activation is in progress. Please try again.','ACTIVATION_BUSY');
 try{
  if(lease.lockedUntil&&lease.lockedUntil>now)throw new LicenseError(429,'Five incorrect attempts. Activation is locked for 15 minutes.','ACTIVATION_LOCKED');
  const record=await licenses().findOne({keyHash:hashKey(key)});
  if(!record||!belongs(record,session)||effectiveStatus(record)!=='active'){
   const attempts=lease.lockedUntil&&lease.lockedUntil<=now?1:(lease.failedAttempts||0)+1;const locked=attempts>=5;
   await collection.updateOne({_id:session.user.id},{$set:{failedAttempts:locked?0:attempts,lockedUntil:locked?new Date(Date.now()+900000):null}});
   throw new LicenseError(locked?429:403,locked?'Five incorrect attempts. Activation is locked for 15 minutes.':'Invalid, expired, revoked or differently assigned license key.',locked?'ACTIVATION_LOCKED':'INVALID_LICENSE');
  }
  const changed=await licenses().updateOne({_id:record._id,...activeFilter()},{$set:{assignedUser:session.user.id,userActivatedAt:record.userActivatedAt||now,lastValidatedAt:now,updatedAt:now}});
  if(!changed.matchedCount)throw new LicenseError(403,'This license is no longer active.','INVALID_LICENSE');
  const verifiedUntil=new Date(Math.min(Date.now()+7*86400000,new Date(session.session.expiresAt).getTime(),record.expiresAt?.getTime()||Infinity));
  await db().collection<Verification>('session_licenses').updateOne({_id:session.session.id},{$set:{userId:session.user.id,licenseId:record._id,verifiedUntil,verifiedAt:now}},{upsert:true});
  await collection.updateOne({_id:session.user.id},{$set:{failedAttempts:0,lockedUntil:null}});
  return userLicenseStatus(session);
 }finally{await collection.updateOne({_id:session.user.id},{$unset:{busyUntil:''}});}
}
export async function desktopRateLimit(){const minute=Math.floor(Date.now()/60000);const row=await db().collection<{_id:string;count:number;expiresAt:Date}>('license_rate_limits').findOneAndUpdate({_id:'desktop:'+minute},{$inc:{count:1},$setOnInsert:{expiresAt:new Date(Date.now()+120000)}},{upsert:true,returnDocument:'after'});if(row&&row.count>120)throw new LicenseError(429,'Too many activation requests. Try again shortly.','RATE_LIMITED');}
export const deviceSchema=z.object({deviceId:z.string().trim().min(3).max(200),deviceName:z.string().trim().max(100).default(''),appVersion:z.string().trim().max(50).default('')});
export async function activateDesktop(input:z.infer<typeof deviceSchema>&{licenseKey:string}){
 await desktopRateLimit();const record=await licenses().findOne({keyHash:hashKey(input.licenseKey)});if(!record||effectiveStatus(record)!=='active')throw new LicenseError(403,'Invalid or unavailable license key.','INVALID_LICENSE');
 for(let attempt=0;attempt<2;attempt++){
  const now=new Date(),activationToken=randomBytes(32).toString('hex');const tokenExpiresAt=new Date(Math.min(Date.now()+30*86400000,record.expiresAt?.getTime()||Infinity));
  let updated=await licenses().findOneAndUpdate({_id:record._id,...activeFilter(),'activatedDevices.deviceId':input.deviceId},{$set:{'activatedDevices.$.deviceName':input.deviceName,'activatedDevices.$.appVersion':input.appVersion,'activatedDevices.$.tokenHash':hashToken(activationToken),'activatedDevices.$.tokenExpiresAt':tokenExpiresAt,'activatedDevices.$.lastValidatedAt':now,'activatedDevices.$.lastSeenAt':now,lastValidatedAt:now}},{returnDocument:'after'});
  if(!updated)updated=await licenses().findOneAndUpdate({_id:record._id,...activeFilter(),'activatedDevices.deviceId':{$ne:input.deviceId},$expr:{$lt:[{$size:{$ifNull:['$activatedDevices',[]]}},'$maxDevices']}},{$push:{activatedDevices:{deviceId:input.deviceId,deviceName:input.deviceName,appVersion:input.appVersion,activatedAt:now,lastValidatedAt:now,lastSeenAt:now,tokenHash:hashToken(activationToken),tokenExpiresAt}},$set:{lastValidatedAt:now}},{returnDocument:'after'});
  if(updated)return{activationToken,tokenExpiresAt,license:{id:String(updated._id),keyLabel:label(updated),deviceId:input.deviceId,status:effectiveStatus(updated),expiresAt:updated.expiresAt},validatedAt:now};
 }
 throw new LicenseError(403,'Device limit reached or license is unavailable.','DEVICE_LIMIT');
}
export async function validateDesktop(input:z.infer<typeof deviceSchema>&{activationToken:string}){
 await desktopRateLimit();const now=new Date(),oldHash=hashToken(input.activationToken),activationToken=randomBytes(32).toString('hex');
 const record=await licenses().findOneAndUpdate({...activeFilter(),activatedDevices:{$elemMatch:{deviceId:input.deviceId,tokenHash:oldHash,tokenExpiresAt:{$gt:now}}}},{$set:{'activatedDevices.$.tokenHash':hashToken(activationToken),'activatedDevices.$.lastSeenAt':now,'activatedDevices.$.lastValidatedAt':now,lastValidatedAt:now}},{returnDocument:'after'});
 if(!record)throw new LicenseError(403,'Invalid, expired, revoked or differently bound activation.','INVALID_ACTIVATION');
 return{activationToken,license:{id:String(record._id),keyLabel:label(record),deviceId:input.deviceId,status:effectiveStatus(record),expiresAt:record.expiresAt},validatedAt:now};
}
