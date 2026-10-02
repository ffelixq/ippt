import type {Workout} from './data';

// Export completed evidence, never expand a session ID into its current template.
// Backups deliberately bypass this projection so restoration remains lossless.
export function actualWorkout(w:Workout){
 const {checklist,continuation,...record}=w;
 const skipped=w.status==='skipped';
 const sets=skipped?[]:w.sets.filter(set=>set.reps>0&&!(checklist?.some(row=>row.exercise===set.exercise&&!row.done)&&!checklist.some(row=>row.exercise===set.exercise&&row.done))).map(set=>({...set,rest:set.rest>0?set.rest:null}));
 const segments=skipped?[]:w.runSegments?.map(segment=>({...segment}));
 const hasSegments=!!segments?.length&&segments.every(segment=>segment.distance>0&&segment.seconds>0);
 return {...record,
  minutes:skipped?null:w.minutes,effort:skipped?null:w.effort,sets,
  distance:skipped?0:hasSegments?Math.round(segments!.reduce((sum,segment)=>sum+segment.distance,0)*1000)/1000:w.distance,
  seconds:skipped?0:hasSegments?segments!.reduce((sum,segment)=>sum+segment.seconds,0):w.seconds,
  splits:skipped?[]:hasSegments&&w.runType==='interval'?segments!.map(segment=>segment.seconds):[...w.splits],
  runType:skipped?'none':w.runType,runSegments:segments,
  pushups:skipped?null:w.pushups,situps:skipped?null:w.situps,testType:skipped?'none':w.testType,
 };
}

export function workoutCsv(workouts:Workout[]){
 const quote=(value:unknown)=>'"'+String(value??'').replace(/"/g,'""')+'"';
 const headers=['date','name','status','session','minutes','effort','pushups_1min','situps_1min','distance_km','run_seconds','run_type','test_type','notes','sets_json','splits_seconds_json','workout_id','plan_name','completed_set_count','run_segments_json'];
 const rows=workouts.map(actualWorkout).map(w=>[w.date,w.name,w.status,w.sessionId,w.minutes,w.effort,w.pushups,w.situps,w.distance,w.seconds,w.runType,w.testType,w.notes,JSON.stringify(w.sets),JSON.stringify(w.splits),w.id,w.planName,w.sets.length,JSON.stringify(w.runSegments??[])]);
 return [headers,...rows].map(row=>row.map(quote).join(',')).join('\r\n');
}
