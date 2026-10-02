import type {Session,Workout} from './data';
export type ChecklistRow={key:string,exercise:string,target:string,plannedSets:number,done:boolean,sets:Workout['sets']};
const key=()=>Math.random().toString(36).slice(2);
export function checklistRows(workout:Workout,session?:Session):ChecklistRow[]{
 const grouped=new Map<string,Workout['sets']>();
 for(const set of workout.sets)grouped.set(set.exercise,[...(grouped.get(set.exercise)??[]),{...set}]);
 const rawPlan=workout.checklist??session?.items.map(x=>({exercise:x.name,plannedSets:x.sets,target:x.target,done:false}))??[];
 const planned=Array.from(rawPlan.reduce((map,p)=>{const prior=map.get(p.exercise);map.set(p.exercise,prior?{...prior,plannedSets:prior.plannedSets+p.plannedSets}:p);return map},new Map<string,NonNullable<Workout['checklist']>[number]>()).values());
 const rows:ChecklistRow[]=planned.map(p=>{const actual=grouped.get(p.exercise);grouped.delete(p.exercise);return {key:key(),...p,done:!!actual?.length,sets:actual??Array.from({length:p.plannedSets},()=>({exercise:p.exercise,reps:0,unit:p.exercise==='Sit-up'?'reps':/seconds|minutes/.test(p.target)?'seconds':'reps',incline:0,rest:0}))}});
 for(const [exercise,sets]of grouped)rows.push({key:key(),exercise,plannedSets:0,target:'Added exercise',done:true,sets});
 return rows;
}
export function changeChecklist(rows:ChecklistRow[],session:Session){return checklistRows({sets:rows.filter(r=>r.done).flatMap(r=>r.sets.map(s=>({...s,exercise:r.exercise})))} as Workout,session)}
export function checklistResult(rows:ChecklistRow[]){
 const checked=rows.filter(r=>r.done);
 if(checked.some(r=>!r.exercise.trim()||r.sets.some(s=>!Number.isFinite(s.reps)||s.reps<=0)))throw Error('Enter the actual amount for every checked set, or untick the exercise.');
 return {sets:checked.flatMap(r=>r.sets.map(s=>({...s,exercise:r.exercise}))),checklist:rows.map(({exercise,target,plannedSets,done})=>({exercise,target,plannedSets,done})),status:(!checked.length?'skipped':rows.some(r=>r.plannedSets>0&&(!r.done||r.sets.length<r.plannedSets))?'partial':'complete') as Workout['status']};
}
export function parseRunTime(value:string){const match=value.trim().match(/^(\d{1,3})[:.]([0-5]\d)$/);return match?Number(match[1])*60+Number(match[2]):NaN}
export function runSummary(segments:NonNullable<Workout['runSegments']>,repeats:boolean){
 if(!segments.length||segments.some(s=>!Number.isFinite(s.distance)||s.distance<=0||!Number.isFinite(s.seconds)||s.seconds<=0))throw Error('Enter a positive distance and a time such as 12:43 for each run.');
 const distance=Math.round(segments.reduce((a,b)=>a+b.distance,0)*1000)/1000,seconds=segments.reduce((a,b)=>a+b.seconds,0);
 const same=segments.every(s=>s.distance===segments[0].distance);
 const name=repeats?`${same?`${segments.length} × ${segments[0].distance} km`:`${distance} km`} run repeats`:`${distance} km run`;
 const rests=segments.slice(0,-1);const elapsed=rests.every(s=>s.recoveryAfter!==null)?seconds+rests.reduce((a,b)=>a+(b.recoveryAfter??0),0):null;
 return {distance,seconds,name,runType:repeats?'interval' as const:'run' as const,splits:repeats?segments.map(s=>s.seconds):[],elapsed,approximate:rests.some(s=>s.recoveryApproximate)};
}
export function sameWorkout(a:Workout,b:Workout){return a.id===b.id||(a.date===b.date&&a.distance===b.distance&&a.seconds===b.seconds&&a.sets.length===b.sets.length&&a.sets.every((s,i)=>s.exercise===b.sets[i]?.exercise&&s.reps===b.sets[i]?.reps))}
