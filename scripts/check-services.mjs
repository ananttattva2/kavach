import { loadEnvFile } from 'node:process';
import { setServers } from 'node:dns';
import { MongoClient } from 'mongodb';
loadEnvFile('.env.local');
if (process.env.DNS_SERVERS) setServers(process.env.DNS_SERVERS.split(','));
const results = await Promise.allSettled([
(async()=>{const client=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:10000});try{await client.db(process.env.MONGODB_DB).command({ping:1});console.log('MongoDB: connection verified');}finally{await client.close();}})(),
(async()=>{const res=await fetch(`https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`,{method:'POST',body:new URLSearchParams({client_id:process.env.MS_CLIENT_ID,client_secret:process.env.MS_CLIENT_SECRET,grant_type:'client_credentials',scope:'https://graph.microsoft.com/.default'}),signal:AbortSignal.timeout(15000)});const data=await res.json();if(!res.ok)throw new Error('Microsoft Graph: token request failed ('+(data.error||res.status)+')');const claims=JSON.parse(Buffer.from(data.access_token.split('.')[1],'base64url').toString());console.log('Microsoft Graph: credentials verified; Mail.Send permission '+(claims.roles?.includes('Mail.Send')?'present':'MISSING'));})()
]);
for(let i=0;i<results.length;i++){if(results[i].status==='rejected'){console.error((i===0?'MongoDB':'Microsoft Graph')+': verification failed ('+(results[i].reason.code||results[i].reason.name)+')');process.exitCode=1;}}
