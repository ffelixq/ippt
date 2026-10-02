import assert from 'node:assert/strict';
import {freshInterval,startLap,finishLap,advance,togglePause,stopEarly,parseSplits} from '../lib/intervals.ts';
import {time} from '../lib/data.ts';
let s=startLap(freshInterval('test'),1000);
for(let i=0;i<6;i++){
 const end=s.anchor+(130+i)*1000;
 s=finishLap(s,end);
 assert.equal(s.splits.length,i+1);
 const secondTap=finishLap(s,end+50);assert.deepEqual(secondTap,s);
 if(i<5){assert.equal(s.phase,'rest');assert.equal(advance(s,end+119999).phase,'rest');s=advance(s,end+120000);assert.equal(s.phase,'run');assert.equal(s.anchor,end+120000);}
}
assert.equal(s.phase,'done');assert.equal(s.recoveries.length,5);assert.equal(s.splits.reduce((a,b)=>a+b,0),795);
let paused=startLap(freshInterval('pause'),1000);paused=togglePause(paused,61000);paused=togglePause(paused,91000);paused=finishLap(paused,161000);assert.equal(paused.splits[0],130);
paused=togglePause(paused,171000);paused=togglePause(paused,201000);assert.equal(advance(paused,310999).phase,'rest');assert.equal(advance(paused,311000).phase,'run');
let hidden=finishLap(startLap(freshInterval('hidden'),1000),131000);hidden=advance(hidden,251000,false);assert.equal(hidden.phase,'ready');hidden=startLap(hidden,271000);assert.equal(hidden.recoveries[0],140);assert.equal(hidden.anchor,271000);
let late=finishLap(startLap(freshInterval('late'),1000),131000);assert.equal(advance(late,260000,true).phase,'ready');
assert.equal(stopEarly(hidden,280000).splits.length,1);
assert.deepEqual(parseSplits('2:12, 2:08, 2:15'),[132,128,135]);
assert.deepEqual(parseSplits('lap,time\n1,2:12\n2,2:08'),[132,128]);
assert.deepEqual(parseSplits('2:10, 4:25, 6:35',true),[130,135,130]);
assert.throws(()=>parseSplits('2:12, 2:08',true));assert.throws(()=>parseSplits('2:70'));assert.throws(()=>parseSplits(''));assert.throws(()=>parseSplits('0:00'));
assert.equal(time(119.8),'2:00');
console.log('Intervals passed: six laps, automatic rest, final lap, duplicate taps, pause/resume, hidden/delayed recovery, early finish, split imports and time rounding.');
const {initial,updatedRunningPlan,stateSchema}=await import('../lib/data.ts');
const before=structuredClone(initial.plan);const strength=JSON.stringify(before.sessions.find(s=>s.id==='A'));
const updated=updatedRunningPlan(before);
assert.equal(JSON.stringify(updated.sessions.find(s=>s.id==='A')),strength);
assert.ok(updated.sessions.find(s=>s.id==='B').description.includes('2 × 2.4 km'));
assert.ok(updated.sessions.find(s=>s.id==='C').description.includes('3–5 km'));
assert.ok(stateSchema.safeParse({...initial,plan:updated}).success);
console.log('Updated running plan validates and preserves strength session A.');
