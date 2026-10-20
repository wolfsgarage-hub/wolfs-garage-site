'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const current=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
const old=JSON.parse(cp.execFileSync('git',['show','aae75a0977472317bc0767c23d50ed7ce83dac0b:vercel.json'],{cwd:root,encoding:'utf8'}));
test('only the paired Instagram owner-entry version queries change',()=>{
  const versions={'/post-maker':'39.1.0','/social-queue':'1.4.0'};
  for(const r of current.redirects.filter(r=>versions[r.source])){
    const u=new URL(r.destination);
    assert.equal(u.searchParams.get('v'),versions[r.source]);
    assert.equal(u.hostname,'raw.githack.com');
    assert.equal(r.permanent,false);
    if(r.source==='/post-maker')assert.equal(u.searchParams.get('tab'),'studio');
  }
  const normalized=structuredClone(current);
  for(const r of normalized.redirects){const prev=old.redirects.find(p=>p.source===r.source);if(versions[r.source])r.destination=prev.destination;}
  assert.deepEqual(normalized,old);
});
