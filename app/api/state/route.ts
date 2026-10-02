import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/lib/store';
import { stateSchema } from '@/lib/data';
export async function GET() {
 const user=await getChatGPTUser(); if(!user) return Response.json({error:'Sign in to load your training.'},{status:401});
 try { const row=await database().prepare('SELECT data, version FROM athlete_state WHERE user_id = ?').bind(user.userId).first<{data:string,version:number}>(); return Response.json({data:row?JSON.parse(row.data):null,version:row?.version??0,userKey:user.userId},{headers:{'Cache-Control':'no-store'}}); } catch(e) {console.error(e);return Response.json({error:'Your training could not be loaded. Please retry.'},{status:503});}
}
export async function PUT(req:Request) {
 const user=await getChatGPTUser(); if(!user) return Response.json({error:'Sign in to save your training.'},{status:401});
 if(req.headers.get('origin') && req.headers.get('origin')!==new URL(req.url).origin) return Response.json({error:'Invalid origin'},{status:403});
 try {const raw=await req.text(); if(raw.length>3000000) return Response.json({error:'Backup exceeds 3 MB.'},{status:413});const body=JSON.parse(raw);if(body.userKey!==user.userId)return Response.json({error:"Account changed. Export your unsaved changes, then reload."},{status:409});const parsed=stateSchema.safeParse(body.data);if(!parsed.success || !Number.isInteger(body.version)||body.version<0)return Response.json({error:'Invalid training data. Check the file format and values.'},{status:400});
 const db=database();let result;const json=JSON.stringify(parsed.data);const now=new Date().toISOString();
 if(body.version===0) result=await db.prepare('INSERT OR IGNORE INTO athlete_state (user_id,data,version,updated_at) VALUES (?,?,1,?)').bind(user.userId,json,now).run();
 else result=await db.prepare('UPDATE athlete_state SET data=?,version=version+1,updated_at=? WHERE user_id=? AND version=?').bind(json,now,user.userId,body.version).run();
 if(!result.meta.changes)return Response.json({error:'Your records changed on another device. Export your unsaved changes, then reload before saving.'},{status:409});return Response.json({version:body.version+1});
 } catch(e){console.error(e);return Response.json({error:'Could not save. Your changes are still open; retry when connected.'},{status:503});}
}
