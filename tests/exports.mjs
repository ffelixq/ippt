import assert from 'node:assert/strict';
import {initial,report,stateSchema} from '../lib/data.ts';
import {actualWorkout,workoutCsv} from '../lib/exports.ts';
import {checklistRows,checklistResult} from '../lib/logging.ts';
import {strengthVersions,upsertWorkout} from '../lib/training.ts';

const blank={id:'gym',date:'2026-09-26',name:'Gym',sessionId:'A',planName:'Original plan',status:'partial',minutes:null,effort:null,notes:'Only these two exercises, with "actual" sets.\nNo extras.',sets:[],distance:0,seconds:0,splits:[],runType:'none',pushups:null,situps:null,testType:'none'};
const rows=checklistRows(blank,strengthVersions[1]);
for(const [original,exercise] of [['Flat dumbbell bench press','Machine chest press'],['Seated cable row','Lat pulldown']]){
 const row=rows.find(r=>r.exercise===original);row.exercise=exercise;row.done=true;row.sets=row.sets.map(s=>({...s,exercise,reps:10,location:'Gym'}));
}
const gym={...blank,...checklistResult(rows),continuation:{session:strengthVersions[1],nextStep:6,skipped:true}};
gym.sets[0].weight=20;gym.sets[1].weight=22.5;
const run={...blank,id:'run',date:'2026-09-24',name:'2 × 2.2 km run repeats',sessionId:'B',status:'complete',notes:'About one minute recovery',distance:4.4,seconds:1594,splits:[763,831],runType:'interval',runSegments:[{distance:2.2,seconds:763,recoveryAfter:60,recoveryApproximate:true},{distance:2.2,seconds:831,recoveryAfter:null}]};
const state={...structuredClone(initial),workouts:[gym,run]};
const before=JSON.stringify(state);
const exported=actualWorkout(gym);
assert.equal(exported.sets.length,6);assert.equal(exported.sets.reduce((sum,s)=>sum+s.reps,0),60);
assert.deepEqual([...new Set(exported.sets.map(s=>s.exercise))],['Machine chest press','Lat pulldown']);
assert.equal(exported.status,'partial');assert.equal(exported.minutes,null);assert.equal(exported.pushups,null);
assert.equal(exported.sets[0].weight,20);assert.equal(exported.sets[1].weight,22.5);assert.equal(exported.sets[2].weight,undefined);assert.equal(exported.sets[0].rest,null);
assert.ok(!('checklist' in exported));assert.ok(!('continuation' in exported));
function activity(text){return JSON.parse(text.split('\n\n## Recovery and nutrition')[0].split('\n\n').at(-1))}
assert.deepEqual(activity(report(state)),JSON.parse(JSON.stringify(state.workouts.map(actualWorkout))));
const replanned={...state,plan:strengthVersions[0]};
assert.deepEqual(activity(report(replanned)),activity(report(state)),'Changing the current plan must never change past exported work');
// A real edit unticks a movement and changes the remaining actual set amounts.
const editedRows=checklistRows(gym);editedRows.find(r=>r.exercise==='Lat pulldown').done=false;
editedRows.find(r=>r.exercise==='Machine chest press').sets[1].reps=8;
const edited={...gym,...checklistResult(editedRows)};
const workouts=upsertWorkout(state.workouts,edited);
assert.equal(workouts.length,2);assert.deepEqual(actualWorkout(workouts[0]).sets.map(s=>s.reps),[10,8,10]);
assert.equal(actualWorkout({...gym,status:'skipped'}).sets.length,0);
assert.equal(actualWorkout({...run,status:'skipped'}).distance,0);
assert.equal(actualWorkout({...run,status:'skipped'}).seconds,0);
assert.deepEqual(actualWorkout({...run,status:'skipped'}).runSegments,[]);
// Earlier records without a checklist retain their actual sets; zero placeholders do not become activity.
const legacy={...blank,sets:[{exercise:'Plank',reps:30,unit:'seconds',rest:60,incline:0},{exercise:'Not done',reps:0,unit:'reps',rest:0,incline:0}]};
assert.equal(actualWorkout(legacy).sets.length,1);assert.equal(actualWorkout(legacy).sets[0].unit,'seconds');assert.equal(actualWorkout(legacy).sets[0].rest,60);
const stale={...gym,sets:[...gym.sets,{exercise:'Triceps pushdown',reps:10,unit:'reps',rest:0,incline:0}]};
assert.equal(actualWorkout(stale).sets.length,6,'Explicitly unchecked movements must not leak into completed exports');
// Read the generated CSV with quoting, commas and multiline notes intact.
function parseCsv(csv){let rows=[],row=[],cell='',quoted=false;for(let i=0;i<csv.length;i++){const c=csv[i];if(c==='"'){if(quoted&&csv[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=''}else if(c==='\r'&&csv[i+1]==='\n'&&!quoted){row.push(cell);rows.push(row);row=[];cell='';i++}else cell+=c}row.push(cell);rows.push(row);return rows}
const [headers,...csvRows]=parseCsv(workoutCsv(state.workouts));
const records=csvRows.map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]])));
assert.equal(records.length,2);assert.equal(records[0].notes,gym.notes);assert.equal(records[0].minutes,'');assert.equal(records[0].effort,'');
assert.equal(records[0].completed_set_count,'6');assert.deepEqual(JSON.parse(records[0].sets_json),JSON.parse(JSON.stringify(exported.sets)));
assert.equal(records[1].distance_km,'4.4');assert.equal(records[1].run_seconds,'1594');assert.equal(records[1].run_type,'interval');assert.equal(records[1].test_type,'none');
assert.deepEqual(JSON.parse(records[1].run_segments_json),run.runSegments);assert.deepEqual(JSON.parse(records[1].splits_seconds_json),[763,831]);
const unknown=actualWorkout({...run,runSegments:run.runSegments.map(s=>({...s,recoveryAfter:null}))});assert.equal(unknown.runSegments[0].recoveryAfter,null);
assert.equal(actualWorkout({...run,distance:99,seconds:99}).seconds,1594,'Recorded segments determine actual run totals');
assert.equal(parseCsv(workoutCsv([])).length,1);
assert.equal(JSON.stringify(state),before,'Export must not change stored history or resume state');
assert.deepEqual(stateSchema.parse(JSON.parse(before)),state,'The full backup still restores checklists and resume state exactly');
console.log('Export checks passed: exact partial sets, edits, plan independence, skipped/legacy logs, run recovery, CSV quoting, unknown values and lossless backups.');
