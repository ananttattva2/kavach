export const accountRoles=['admin','user','manager','client','super_admin'] as const;
export type AccountRole=typeof accountRoles[number];
export function isAdministrator(role:string|undefined|null){return role==='admin'||role==='super_admin';}
export function roleLabel(role:string|undefined|null){return ({admin:'Administrator',super_admin:'Super Admin',manager:'Manager',client:'Client',user:'User'} as Record<string,string>)[role||'user']||'User';}
