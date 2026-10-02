import type {Session, State, Workout} from './data';

export const FLEXIBLE_PLAN_NOTE='Flexible menu (27 Sep 2026): A = one strength session (Home, Gym, Hybrid or Express); B = one quality run; C = one easy endurance run. Gym replaces Session A, not an extra session. Optional micro-sessions stay optional. Complete the objective, not every exercise.';
type Item=Session['items'][number];
const exercise=(name:string,sets:number,target:string,focus:Item['focus'],location:Item['location']='Home',rest=90):Item=>({name,sets,target,rest,focus,location});
const warm=()=>exercise('Warm-up',1,'3–5 minutes','warmup','Home',0);
export const strengthVersions:Session[]=[
 {id:'A',variant:'Home',name:'Strength · Home',tag:'STRENGTH',minutes:40,description:'Push-up practice and core using a stable surface and a mat. Start with comfortable volume; the full menu is a guide, not a requirement.',items:[warm(),exercise('Standard push-up',3,'Clean submaximal reps, only if ready','skill'),exercise('Incline push-up',3,'8–12 reps','press'),exercise('Negative push-up',3,'4–6 controlled reps','skill'),exercise('Knee push-up',2,'10–15 reps, optional','second'),exercise('Sit-up',3,'15–20 reps','core','Home',60),exercise('Plank',2,'30–60 seconds','bonus','Home',60)]},
 {id:'A',variant:'Gym',name:'Strength · Full gym',tag:'STRENGTH',minutes:55,description:'About 45–60 minutes. One main press, push-up practice, back and core. Swap a press for the machine when needed; do not stack all three presses.',items:[{...warm(),location:'Gym'},exercise('Flat dumbbell bench press',3,'8–12 reps','press','Gym'),exercise('Incline dumbbell bench press',3,'8–12 reps','second','Gym'),exercise('Seated cable row',3,'8–12 reps','back','Gym'),exercise('Triceps pushdown',3,'10–15 reps','triceps','Gym'),exercise('Incline push-up',2,'8–12 clean reps','skill','Gym'),exercise('Sit-up',2,'15–20 reps','core','Gym',60)]},
 {id:'A',variant:'Hybrid',name:'Strength · Gym + home',tag:'STRENGTH',minutes:40,description:'Do the gym block first, then finish at home later. Save a partial session before leaving and resume the same record from Today or your journal.',items:[{...warm(),location:'Gym'},exercise('Flat dumbbell bench press',3,'8–12 reps','press','Gym'),exercise('Triceps pushdown',3,'10–15 reps','triceps','Gym'),exercise('Seated cable row',2,'8–12 reps','back','Gym'),exercise('Incline push-up',2,'8–12 clean reps','skill','Home'),exercise('Sit-up',2,'15–20 reps','core','Home',60)]},
 {id:'A',variant:'Express',name:'Strength · 15-minute express',tag:'STRENGTH',minutes:15,description:'One main press, push-up practice and sit-ups. Choose a dumbbell press if at the gym, or keep the home options. Take a short warm-up first.',items:[exercise('Incline push-up',3,'10 controlled reps','press'),exercise('Negative push-up',3,'5 controlled reps','skill'),exercise('Sit-up',1,'60 seconds; record actual repetitions','core','Home',60)]}
];
export const focusLabels:Record<string,string>={warmup:'Prepare',press:'Priority · main press',skill:'Priority · push-up practice',back:'Useful · back',triceps:'Useful · triceps',core:'Useful · sit-ups',second:'Optional · second press',bonus:'Optional · extra'};
export const swaps:Record<string,string[]>={press:['Flat dumbbell bench press','Machine chest press','Incline push-up','Standard push-up'],second:['Incline dumbbell bench press','Incline push-up','Machine chest press','Knee push-up'],back:['Seated cable row','Lat pulldown'],triceps:['Triceps pushdown','Close-grip incline push-up'],skill:['Standard push-up','Incline push-up','Negative push-up'],core:['Sit-up'],bonus:['Plank','Cable biceps curl','Dumbbell biceps curl']};
export function replacement(item:Item,name:string):Item{
 const target=name==='Negative push-up'?'4–6 controlled reps':name==='Standard push-up'?'Clean submaximal reps, only if ready':/pushdown|curl/.test(name)?'10–15 reps':name==='Plank'?'30–60 seconds':'8–12 reps';
 return {...item,name,target,location:/dumbbell|cable|machine|pulldown|pushdown/i.test(name)?'Gym':'Home'};
}
export function updatedFlexiblePlan(plan:State['plan']):State['plan']{
 return {...plan,notes:plan.notes.includes(FLEXIBLE_PLAN_NOTE)?plan.notes:plan.notes+'\n'+FLEXIBLE_PLAN_NOTE,sessions:plan.sessions.map(a=>a.id==='A'?{...strengthVersions[0],name:'Strength & push-up practice',description:'Choose Home, Gym, Hybrid or Express to suit your day. Each version completes the same Session A; you do not need to do all four.'}:a.id==='C'?{...a,name:'Easy endurance run',tag:'EASY RUN',minutes:40,description:'3–5 km at conversational effort. Push-up and sit-up micro-sessions are optional, not a requirement for this slot.',items:[{name:'Run warm-up',sets:1,target:'5–10 minutes',rest:0},{name:'Easy run',sets:1,target:'3–5 km, conversational',rest:0},{name:'Cooldown',sets:1,target:'5 minutes',rest:0}]}:a)};
}
// Upgrade only the unchanged starter plan. Custom/imported plans remain intact.
export function upgradeStarterPlan(state:State):State{
 if(state.plan.notes.includes(FLEXIBLE_PLAN_NOTE))return state;
 if(JSON.stringify(state.plan)!==JSON.stringify(legacyStarterPlan))return state;
 return {...state,plan:updatedFlexiblePlan(state.plan),planHistory:[...state.planHistory.slice(-199),{date:new Date().toISOString(),plan:state.plan}]};
}
export function previousDate(date:string,days=1){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-days);return d.toISOString().slice(0,10)}
export function upsertWorkout(workouts:Workout[],workout:Workout){return [workout,...workouts.filter(w=>w.id!==workout.id)].sort((a,b)=>b.date.localeCompare(a.date))}
export function canResume(w:Workout){return w.status==='partial'&&!!w.continuation&&w.continuation.nextStep<w.continuation.session.items.reduce((sum,a)=>sum+a.sets,0)}
export const gymGuides=[
 {name:'Flat dumbbell bench press',category:'Strength',purpose:'Main chest and triceps strength exercise for Session A.',steps:['Set the bench flat. Use a load you can control with about two clean reps left.','Lie back with feet supported and shoulder blades gently drawn back.','Lower the dumbbells beside your chest; keep elbows comfortably angled, not flared straight sideways.','Press upward under control. Log kg per dumbbell.'],avoid:'Bouncing, flared elbows or forcing through elbow pain.',progress:'Keep 8–12 controlled reps before gradually increasing the load.'},
 {name:'Incline dumbbell bench press',category:'Strength',purpose:'A second pressing option for the gym version.',steps:['Set a low bench angle, approximately 15–30°.','Use a lighter load than your flat press if needed.','Keep your shoulder blades supported and press smoothly from beside your chest.','Log kg per dumbbell.'],avoid:'A steep angle that turns it into a shoulder press, or adding this plus two other main presses.',progress:'Keep the movement controlled and increase gradually.'},
 {name:'Machine chest press',category:'Strength',purpose:'Swap for one dumbbell press when the bench is busy.',steps:['Adjust the seat so the handles are around chest level.','Keep your back supported and feet planted.','Press and return under control, following the machine instructions.'],avoid:'Doing the machine plus both dumbbell presses just to complete every option.',progress:'Start light. Record the displayed machine load.'},
 {name:'Seated cable row',category:'Strength',purpose:'Back work to balance pressing.',steps:['Use the low cable with a seated row setup.','Sit tall with your chest up.','Pull toward your lower ribs, then return under control.'],avoid:'Jerking the weight or swinging your body.',progress:'Use 8–12 controlled repetitions; a lat pulldown is an alternative.'},
 {name:'Triceps pushdown',category:'Strength',purpose:'Direct triceps work in the gym or hybrid version.',steps:['Use the high cable with a bar or rope.','Keep elbows near your sides.','Push down to straighten your arms, then return under control.'],avoid:'Swinging your shoulders or loading through localized elbow discomfort.',progress:'Start light and use 10–15 controlled repetitions.'},
 {name:'Lat pulldown',category:'Strength',purpose:'An alternative to the cable row when equipment is occupied.',steps:['Use the top cable and adjust the seat support.','Pull the bar toward your upper chest.','Return slowly without swinging.'],avoid:'Pulling behind your neck or jerking the load.',progress:'Use a controlled weight for 8–12 reps.'},
 {name:'Close-grip incline push-up',category:'Strength',purpose:'A home alternative to triceps pushdowns.',steps:['Use a sturdy, non-slip raised surface.','Place hands a little closer than your normal incline position, at a comfortable width.','Keep your body straight and lower under control.','Stop if the narrower position causes elbow discomfort.'],avoid:'Forcing a very narrow hand position or training through pain.',progress:'Keep the incline high enough for comfortable, clean repetitions.'},
 ...['Cable biceps curl','Dumbbell biceps curl'].map(name=>({name,category:'Strength',purpose:'Optional arm accessory; not an extra required workout.',steps:[name.startsWith('Cable')?'Use the bottom cable.':'Hold a comfortable pair of dumbbells.','Keep elbows near your sides with palms facing upward.','Curl and lower smoothly without swinging.'],avoid:'Adding accessories when you still need time for your main press and push-up practice.',progress:'Use a comfortable weight for 10–15 reps.'}))
];

export const legacyStarterPlan:State['plan']={
  "name": "Foundation • Flexible IPPT",
  "notes": "Three movable sessions each week. A/B are priorities during busy weeks. Avoid consecutive hard runs; leave recovery between hard push-up sessions. These are adjustable guideposts, not guarantees. Begin with comfortable volume and stop movements that cause pain.\nRunning update (25 Sep 2026): alternate the quality session between 4–6 × 400 m and 2 × 2.4 km. Keep the other run 3–5 km easy. Every 3–4 weeks, a rested 2.4 km time trial replaces the quality session. Sessions stay flexible; avoid consecutive hard runs.",
  "sessions": [
    {
      "id": "A",
      "name": "Build your first full rep",
      "tag": "STRENGTH",
      "minutes": 35,
      "description": "Push-up strength and core control. Use a comfortable incline and keep 1–2 good reps in reserve. Extra knee sets are optional.",
      "items": [
        {
          "name": "Warm-up",
          "sets": 1,
          "target": "3–5 minutes",
          "rest": 0
        },
        {
          "name": "Incline push-up",
          "sets": 3,
          "target": "8–12 reps",
          "rest": 90
        },
        {
          "name": "Negative push-up",
          "sets": 2,
          "target": "3 controlled reps",
          "rest": 90
        },
        {
          "name": "Standard push-up",
          "sets": 3,
          "target": "1–3 clean reps, only if ready",
          "rest": 90
        },
        {
          "name": "Plank",
          "sets": 2,
          "target": "20–40 seconds",
          "rest": 60
        },
        {
          "name": "Sit-up",
          "sets": 3,
          "target": "15–20 reps",
          "rest": 60
        },
        {
          "name": "Cooldown",
          "sets": 1,
          "target": "5 minutes",
          "rest": 0
        }
      ]
    },
    {
      "id": "B",
      "name": "Your quality run",
      "tag": "TRACK",
      "minutes": 45,
      "description": "Alternate each week: 4–6 × 400 m at a controlled, repeatable effort with 90–120 seconds recovery, OR 2 × 2.4 km at about 6–7/10 effort with 3–5 minutes walking/easy recovery. Earlier guide for each long repeat: 14:20–14:50; adjust to effort. The second repeat should stay controlled.",
      "items": [
        {
          "name": "Run warm-up",
          "sets": 1,
          "target": "5–10 minutes",
          "rest": 0
        },
        {
          "name": "Quality run — choose one",
          "sets": 1,
          "target": "4–6 × 400 m OR 2 × 2.4 km; use the interval stopwatch",
          "rest": 0
        },
        {
          "name": "Cooldown",
          "sets": 1,
          "target": "5 minutes",
          "rest": 0
        }
      ]
    },
    {
      "id": "C",
      "name": "Easy endurance + IPPT practice",
      "tag": "MIXED",
      "minutes": 45,
      "description": "Keep push-up and core practice moderate, then run 3–5 km at conversational effort. The easy run builds endurance. Every 3–4 weeks, do a rested 2.4 km test in place of Session B, not as an extra hard run.",
      "items": [
        {
          "name": "Warm-up",
          "sets": 1,
          "target": "5 minutes",
          "rest": 0
        },
        {
          "name": "Standard push-up",
          "sets": 2,
          "target": "Clean submaximal reps",
          "rest": 90
        },
        {
          "name": "Incline push-up",
          "sets": 2,
          "target": "8–12 reps",
          "rest": 90
        },
        {
          "name": "Sit-up",
          "sets": 2,
          "target": "15–20 reps",
          "rest": 60
        },
        {
          "name": "Easy run",
          "sets": 1,
          "target": "3–5 km, conversational",
          "rest": 0
        },
        {
          "name": "Cooldown",
          "sets": 1,
          "target": "5 minutes",
          "rest": 0
        }
      ]
    }
  ]
};
