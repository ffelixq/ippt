import {z} from 'zod';
export const intervalSchema=z.object({id:z.string(),rounds:z.number().int().min(1).max(20),metres:z.number().int().min(50).max(5000),rest:z.number().int().min(5).max(600),auto:z.boolean(),phase:z.enum(['idle','run','rest','ready','done']),anchor:z.number().nonnegative(),started:z.number().nonnegative(),finished:z.number().nonnegative(),paused:z.number().nonnegative(),splits:z.array(z.number().positive()).max(20),recoveries:z.array(z.number().nonnegative()).max(20)});
export type IntervalState=z.infer<typeof intervalSchema>;
export function freshInterval(id:string):IntervalState{return {id,rounds:6,metres:400,rest:120,auto:true,phase:'idle',anchor:0,started:0,finished:0,paused:0,splits:[],recoveries:[]}}
export function advance(s:IntervalState,now:number,visible=true):IntervalState {
 if(s.phase!=='rest'||s.paused||now<s.anchor+s.rest*1000)return s;
 const deadline=s.anchor+s.rest*1000;
 // Never silently start a lap without delivering its on-screen cue.
 if(!s.auto||!visible||now-deadline>2000)return {...s,phase:'ready'};
 return {...s,phase:'run',anchor:deadline,recoveries:[...s.recoveries,s.rest]};
}
export function startLap(s:IntervalState,now:number):IntervalState {
 if(s.phase==='idle')return {...s,phase:'run',anchor:now,started:now};
 if(s.phase==='ready')return {...s,phase:'run',anchor:now,recoveries:[...s.recoveries,Math.max(0,(now-s.anchor)/1000)]};
 return s;
}
export function finishLap(s:IntervalState,now:number):IntervalState {
 if(s.phase!=='run'||s.paused||now-s.anchor<1000)return s;
 const splits=[...s.splits,Math.round((now-s.anchor)/1000)];
 return {...s,splits,phase:splits.length>=s.rounds?'done':'rest',anchor:now,finished:splits.length>=s.rounds?now:0};
}
export function togglePause(s:IntervalState,now:number):IntervalState {
 if(!['run','rest'].includes(s.phase))return s;
 return s.paused?{...s,anchor:s.anchor+(now-s.paused),paused:0}:{...s,paused:now};
}
export function stopEarly(s:IntervalState,now:number):IntervalState {
 if(s.phase==='idle'||s.phase==='done')return s;
 return {...s,phase:'done',paused:0,finished:now};
}
export function parseSplits(text:string,cumulative=false):number[]{
 const clean=text.trim().replace(/^\uFEFF/,'');if(!clean)throw Error('Enter at least one lap time.');
 let entries:string[];
 if(clean.includes('\n')){entries=clean.split(/\r?\n/).filter(x=>x.trim()).filter((x,i)=>!(i===0&&/^(lap|split|time|duration)[,\t ]/i.test(x))).flatMap(line=>{const parts=line.trim().split(/[,;\t]/).map(x=>x.trim().replace(/^"|"$/g,''));if(parts.length===2&&/^\d+$/.test(parts[0]))return [parts[1]];return parts;});}
 else entries=clean.split(/[,;\s]+/);
 const values=entries.map(v=>{if(!/^\d{1,3}:[0-5]\d(?:\.\d{1,3})?$/.test(v))throw Error('Use lap times like 2:12, 2:08. CSV may use lap,time columns.');const [m,s]=v.split(':').map(Number);const n=Math.round(m*60+s);if(n<=0||n>3600)throw Error('Each time must be between 0:01 and 60:00.');return n;});
 if(values.length>20)throw Error('Import up to 20 laps at a time.');
 if(!cumulative)return values;
 return values.map((n,i)=>{const split=n-(values[i-1]??0);if(split<=0)throw Error('Cumulative times must increase on every lap.');return split;});
}
