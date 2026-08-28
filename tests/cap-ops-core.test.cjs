const assert=require('assert');
const core=require('../cap-ops-core.js');
const data={
 drivers:[
  {id:'d1',name:'Anna',status:'Disponibile',shift:'AM',double_ok:true,extra_hours:2},
  {id:'d2',name:'Luca',status:'Malattia',shift:'AM',double_ok:true,extra_hours:0},
  {id:'d3',name:'Sara',status:'Disponibile',shift:'PM',double_ok:false,extra_hours:7}
 ],
 vans:[{id:'v1',plate:'AA111AA',status:'OK'},{id:'v2',plate:'BB222BB',status:'Officina'}],
 routes:[
  {id:'r1',code:'G1',zone:'Pisa',time_window:'08:00-12:00',driver_id:null,status:'SCOPERTO'},
  {id:'r2',code:'G2',zone:'Lucca',time_window:'08:00-12:00',driver_id:'d2',status:'ATTIVO'}
 ],
 emergencies:[{id:'e1',priority:'Alta',title:'Incremento giri',description:'Serve copertura',is_open:true}]
};
const s=core.buildSnapshot(data);
assert.equal(s.metrics.routes_uncovered,1);
assert.equal(s.metrics.emergencies_open,1);
assert.equal(s.metrics.vans_unavailable,1);
assert.equal(s.metrics.drivers_unavailable,1);
assert.equal(s.situation,'CRIT');
assert(s.pressure>=70);
const ranked=core.rankDrivers(data.routes[0],data.drivers,data.routes);
assert.equal(ranked[0].name,'Anna');
assert(ranked[0].score>ranked[1].score);
assert(s.actions.some(a=>/Copri G1/.test(a.title)));
assert.equal(s.trust.predictive_eta,false);
console.log('CAP Ops Core regression tests: OK');
