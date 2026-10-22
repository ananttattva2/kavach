import { MongoClient } from 'mongodb';
import { setServers } from 'node:dns';
import { setServers as setPromiseServers } from 'node:dns/promises';
process.loadEnvFile('.env.local');
if(process.env.DNS_SERVERS){const servers=process.env.DNS_SERVERS.split(',');setServers(servers);setPromiseServers(servers);}
const client=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:10000});
try{const database=client.db(process.env.MONGODB_DB||'kavach');const email=process.argv[2];if(email){const result=await database.collection('user').updateOne({email:email.toLowerCase()},{$set:{role:'admin',updatedAt:new Date()}});console.log('Administrator account matched:',result.matchedCount);if(!result.matchedCount)throw new Error('Account not found; sign in first.');}await Promise.all([database.collection('licenses').createIndex({keyHash:1},{unique:true}),database.collection('licenses').createIndex({assignedEmail:1,createdAt:-1}),database.collection('session_licenses').createIndex({verifiedUntil:1},{expireAfterSeconds:0}),database.collection('license_rate_limits').createIndex({expiresAt:1},{expireAfterSeconds:0})]);console.log('License indexes ready.');}finally{await client.close();}
