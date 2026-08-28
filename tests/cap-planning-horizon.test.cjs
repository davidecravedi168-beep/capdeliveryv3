const assert=require('assert');
const H=require('../cap-planning-horizon.js');

const entries=[
  {date:'2026-08-29',kind:'DRIVER',driver_id:'d1',availability:'AVAILABLE',double_ok:false},
  {date:'2026-08-29',kind:'ABSENCE',driver_id:'d2',reason:'MALATTIA'},
  {date:'2026-08-29',kind:'ROUTE',route_id:'r1',route_code:'G1',driver_id:'d1'},
  {date:'2026-08-29',kind:'ROUTE',route_id:'r2',route_code:'G2',driver_id:'d2'},
  {date:'2026-08-29',kind:'ROUTE',route_id:'r3',route_code:'G3'},
  {date:'2026-08-30',kind:'ROUTE',route_id:'r4',route_code:'G4',driver_id:'d3'},
  {date:'bad',kind:'ROUTE',route_id:'drop'},
];
const drivers=[{id:'d1'},{id:'d2'},{id:'d3'}];
const h=H.buildHorizon({entries,drivers,startDate:'2026-08-29',days:7});
assert.equal(h.schema,'CAP-PLANNING-HORIZON-1');
assert.equal(h.calendar.length,7);
assert.equal(h.calendar[0].planned_routes,3);
assert.equal(h.calendar[0].uncovered,1);
assert.equal(h.calendar[0].assigned_unavailable,1);
assert.equal(h.calendar[1].unknown_assignments,1);
assert.equal(h.state,'ATT');
assert.equal(h.source_quality.rule,'NO_INFERENCE_FROM_MISSING_DATA');
const a=H.prioritizedActions(h);
assert.equal(a[0].type,'ASSIGNED_UNAVAILABLE');
assert(a.some(x=>x.type==='UNCOVERED'));
assert(a.some(x=>x.type==='UNKNOWN'));
const dedup=H.sanitizeEntries([entries[0],entries[0]]);
assert.equal(dedup.length,1);
console.log('PASS CAP planning horizon core');
