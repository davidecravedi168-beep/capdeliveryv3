(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.CapPlanningHorizon=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const DAY_MS=86400000;
  const VALID_SHIFT=new Set(['AM','PM','FULL','OFF','UNKNOWN']);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const txt=v=>String(v??'').trim();
  const iso=v=>{const s=txt(v);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;const d=new Date(s+'T12:00:00Z');return Number.isNaN(d.getTime())?null:s};
  const addDays=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
  const normalizeShift=v=>{const s=txt(v).toUpperCase();return VALID_SHIFT.has(s)?s:(s==='RIPOSO'||s==='REST'?'OFF':'UNKNOWN')};
  const normalizeAvailability=v=>{const s=txt(v).toUpperCase();if(['AVAILABLE','DISPONIBILE','OK','SI','SÌ','YES'].includes(s))return 'AVAILABLE';if(['UNAVAILABLE','NON DISPONIBILE','FERIE','MALATTIA','ASSENTE','NO'].includes(s))return 'UNAVAILABLE';return 'UNKNOWN'};
  const stableKey=o=>[o.date||'',o.kind||'',o.route_code||'',o.driver_id||'',o.shift||'',o.source_key||''].join('|');
  function sanitizeEntries(entries){
    const out=[],seen=new Set();
    for(const raw of Array.isArray(entries)?entries:[]){
      const date=iso(raw.date||raw.service_date); if(!date) continue;
      const kind=txt(raw.kind||raw.type).toUpperCase();
      if(!['ROUTE','DRIVER','ABSENCE','NOTE'].includes(kind)) continue;
      const row={
        date,kind,
        route_id:txt(raw.route_id)||null,
        route_code:txt(raw.route_code||raw.code)||null,
        zone:txt(raw.zone)||null,
        time_window:txt(raw.time_window)||null,
        driver_id:txt(raw.driver_id)||null,
        driver_name:txt(raw.driver_name||raw.name)||null,
        shift:normalizeShift(raw.shift),
        availability:normalizeAvailability(raw.availability||raw.status),
        double_ok:raw.double_ok===true||String(raw.double_ok).toLowerCase()==='true',
        reason:txt(raw.reason||raw.notes)||null,
        source_key:txt(raw.source_key)||'planning-import'
      };
      const key=stableKey(row); if(seen.has(key)) continue; seen.add(key); out.push(row);
    }
    return out.sort((a,b)=>a.date.localeCompare(b.date)||a.kind.localeCompare(b.kind)||String(a.route_code||'').localeCompare(String(b.route_code||'')));
  }
  function buildHorizon({entries=[],routes=[],drivers=[],startDate,days=7}={}){
    const start=iso(startDate)||new Date().toISOString().slice(0,10);
    const n=clamp(Number(days)||7,1,14);
    const clean=sanitizeEntries(entries);
    const routeRows=Array.isArray(routes)?routes:[];
    const driverRows=Array.isArray(drivers)?drivers:[];
    const byDate=new Map(); for(let i=0;i<n;i++) byDate.set(addDays(start,i),[]);
    for(const e of clean) if(byDate.has(e.date)) byDate.get(e.date).push(e);
    for(const r of routeRows){const d=iso(r.service_date);if(!d||!byDate.has(d))continue;byDate.get(d).push({date:d,kind:'ROUTE',route_id:txt(r.id)||null,route_code:txt(r.code)||null,zone:txt(r.zone)||null,time_window:txt(r.time_window)||null,driver_id:txt(r.driver_id)||null,shift:'UNKNOWN',availability:'UNKNOWN',double_ok:false,reason:txt(r.notes)||null,source_key:'routes-db'});}
    const daysOut=[];
    for(const [date,rows] of byDate){
      const routeMap=new Map();
      const driverState=new Map();
      for(const e of rows){
        if(e.kind==='ROUTE'){
          const k=e.route_id||e.route_code||stableKey(e); const prev=routeMap.get(k)||{}; routeMap.set(k,{...prev,...e});
        }
        if((e.kind==='DRIVER'||e.kind==='ABSENCE')&&e.driver_id){
          const prev=driverState.get(e.driver_id)||{}; driverState.set(e.driver_id,{...prev,...e,availability:e.kind==='ABSENCE'?'UNAVAILABLE':e.availability});
        }
      }
      const planned=[...routeMap.values()];
      let uncovered=0,assignedUnavailable=0,unknownAssignments=0;
      const assigned=new Map();
      for(const r of planned){
        if(!r.driver_id){uncovered++;continue;}
        assigned.set(r.driver_id,(assigned.get(r.driver_id)||0)+1);
        const st=driverState.get(r.driver_id);
        if(st?.availability==='UNAVAILABLE') assignedUnavailable++;
        else if(!st||st.availability==='UNKNOWN') unknownAssignments++;
      }
      let overload=0;
      for(const [driverId,count] of assigned){
        if(count<=1) continue;
        const st=driverState.get(driverId);
        if(!st?.double_ok) overload+=count-1;
      }
      const knownDriverRows=driverRows.filter(d=>d&&d.id!=null);
      let knownUnavailable=0,knownAvailable=0;
      for(const d of knownDriverRows){const st=driverState.get(String(d.id));if(st?.availability==='UNAVAILABLE')knownUnavailable++;else if(st?.availability==='AVAILABLE')knownAvailable++;}
      const risk=uncovered*4+assignedUnavailable*5+overload*3+unknownAssignments;
      const state=risk>=10?'CRIT':risk>0?'ATT':'OK';
      const completeness=planned.length?Math.round(100*(planned.length-unknownAssignments-uncovered)/planned.length):0;
      daysOut.push({date,state,risk,planned_routes:planned.length,uncovered,assigned_unavailable:assignedUnavailable,double_without_clearance:overload,unknown_assignments:unknownAssignments,known_available:knownAvailable,known_unavailable:knownUnavailable,completeness:clamp(completeness,0,100),routes:planned});
    }
    const totals=daysOut.reduce((a,d)=>({routes:a.routes+d.planned_routes,uncovered:a.uncovered+d.uncovered,assigned_unavailable:a.assigned_unavailable+d.assigned_unavailable,double_without_clearance:a.double_without_clearance+d.double_without_clearance,unknown_assignments:a.unknown_assignments+d.unknown_assignments}),{routes:0,uncovered:0,assigned_unavailable:0,double_without_clearance:0,unknown_assignments:0});
    const overall=daysOut.some(d=>d.state==='CRIT')?'CRIT':daysOut.some(d=>d.state==='ATT')?'ATT':'OK';
    return {schema:'CAP-PLANNING-HORIZON-1',start_date:start,days:n,state:overall,totals,calendar:daysOut,source_quality:{entries:clean.length,rule:'NO_INFERENCE_FROM_MISSING_DATA'}};
  }
  function prioritizedActions(horizon){
    const out=[];
    for(const d of horizon?.calendar||[]){
      if(d.assigned_unavailable) out.push({priority:1,date:d.date,type:'ASSIGNED_UNAVAILABLE',count:d.assigned_unavailable,label:`${d.assigned_unavailable} assegnazioni a personale non disponibile`});
      if(d.uncovered) out.push({priority:2,date:d.date,type:'UNCOVERED',count:d.uncovered,label:`${d.uncovered} giri senza autista`});
      if(d.double_without_clearance) out.push({priority:3,date:d.date,type:'DOUBLE_GUARD',count:d.double_without_clearance,label:`${d.double_without_clearance} doppi senza disponibilità dichiarata`});
      if(d.unknown_assignments) out.push({priority:4,date:d.date,type:'UNKNOWN',count:d.unknown_assignments,label:`${d.unknown_assignments} assegnazioni con disponibilità non verificata`});
    }
    return out.sort((a,b)=>a.priority-b.priority||a.date.localeCompare(b.date));
  }
  return {sanitizeEntries,buildHorizon,prioritizedActions,addDays};
});
