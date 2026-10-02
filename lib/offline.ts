import type { State } from './data';
export type Cache = { data:State,version:number,userKey:string,pending:boolean };
function db():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open('stride-offline',1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
export async function readCache():Promise<Cache|undefined>{const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('drafts','readonly');const r=t.objectStore('drafts').get('latest');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);t.oncomplete=()=>d.close()})}
export async function writeCache(c:Cache){const d=await db();return new Promise<void>((resolve,reject)=>{const t=d.transaction('drafts','readwrite');t.objectStore('drafts').put(c,'latest');t.oncomplete=()=>{d.close();resolve()};t.onerror=()=>{d.close();reject(t.error)}})}
