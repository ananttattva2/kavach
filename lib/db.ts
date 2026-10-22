import { MongoClient } from 'mongodb';
import { setServers } from 'node:dns';
import { setServers as setPromiseServers } from 'node:dns/promises';
const globalDB = globalThis as unknown as { mongo?: MongoClient };
export function getClient() {
 if (process.env.DNS_SERVERS) {
  const servers=process.env.DNS_SERVERS.split(',');
  setServers(servers);
  setPromiseServers(servers);
 }
 const uri = process.env.MONGODB_URI;
 if (!uri || uri.includes('<db_')) throw new Error('MongoDB configuration missing');
 return globalDB.mongo ??= new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
}
export function db() { return getClient().db(process.env.MONGODB_DB || 'kavach'); }
