import { authentication } from '@/lib/auth';
import { sameOrigin,authResponse } from '@/lib/auth-core';
import { database } from '@/lib/store';
import { stateSchema } from '@/lib/data';
export async function GET(req:Request) {
 try { const user=await authentication().session(req); if(!user) return authResponse({error:'Sign in to load your training.'},401);
 const row=await database().prepare('SELECT data, version FROM athlete_state WHERE user_id = ?').bind(user.userId).first<{data:string,version:number}>(); return authResponse({data:row?JSON.parse(row.data):null,version:row?.version??0,userKey:user.userId}); } catch(e) {return authResponse({error:'Your training could not be loaded. Please retry.'},503);}
}
export async function PUT(req:Request) {
 try { const user=await authentication().session(req); if(!user) return authResponse({error:'Sign in to save your training.'},401);
 if(!sameOrigin(req)) return authResponse({error:'Invalid origin'},403);
 const raw=await req.text(); if(raw.length>3000000) return authResponse({error:'Backup exceeds 3 MB.'},413);const body=JSON.parse(raw);if(body.userKey!==user.userId)return authResponse({error:"Account changed. Export your unsaved changes, then reload."},409);const parsed=stateSchema.safeParse(body.data);if(!parsed.success || !Number.isInteger(body.version)||body.version<0)return authResponse({error:'Invalid training data. Check the file format and values.'},400);
 const db=database();let result;const json=JSON.stringify(parsed.data);const now=new Date().toISOString();
 if(body.version===0) result=await db.prepare('INSERT OR IGNORE INTO athlete_state (user_id,data,version,updated_at) VALUES (?,?,1,?)').bind(user.userId,json,now).run();
 else result=await db.prepare('UPDATE athlete_state SET data=?,version=version+1,updated_at=? WHERE user_id=? AND version=?').bind(json,now,user.userId,body.version).run();
 if(!result.meta.changes)return authResponse({error:'Your records changed on another device. Export your unsaved changes, then reload before saving.'},409);return authResponse({version:body.version+1});
 } catch(e){return authResponse({error:'Could not save. Your changes are still open; retry when connected.'},503);}
}
