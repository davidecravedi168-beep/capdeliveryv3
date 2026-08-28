const fs=require('fs');
const doc=fs.readFileSync('DATA_OWNERSHIP_V64.md','utf8');
for(const marker of ['Zucchetti HR','Excel / weekly planning','CAP Delivery','Driver delivery application','departure temperature','return temperature','departure odometer/km','return odometer/km','DATA GAP']){
  if(!doc.includes(marker)) throw new Error('Missing ownership marker: '+marker);
}
console.log('PASS CAP data ownership contract');
