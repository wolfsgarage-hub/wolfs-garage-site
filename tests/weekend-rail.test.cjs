const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html=fs.readFileSync(process.env.WG_SOURCE || path.join(__dirname,'../index.html'),'utf8');
const code=html.slice(html.indexOf('  /* weekend rail:'),html.indexOf('  function countUp('));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function run(data,{now='2026-11-05T07:30:00Z',ok=true,reject=false}={}) {
 const rail={innerHTML:''},stat={textContent:'–'},urls=[];
 class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return new Date(now).valueOf();}}
 const ctx=vm.createContext({Date:Clock,Intl,escapeHtml:esc,encodeURIComponent,document:{getElementById:id=>id==='wg2Rail'?rail:stat},countUp:(el,n)=>el.textContent=String(n),fetch:url=>{urls.push(url);return reject?Promise.reject(new Error('fixture')):Promise.resolve({ok,json:async()=>data});}});
 vm.runInContext(code,ctx);await new Promise(setImmediate);return {rail:rail.innerHTML,count:stat.textContent,url:urls[0]};
}
function event(n,flyer=true){return {slug:'show-'+n,title:'Show '+n,local_date:'2026-11-06',city:'Portland',state:'OR',venue_name:'Venue',flyer_url:flyer?'https://example.com/flyer.jpg':null};}
for (const n of [1,2,3,6,8]) test(n+' flyers remain visible (up to six cards)',async()=>{const r=await run({ok:true,total:21,results:Array.from({length:n},(_,i)=>event(i))});assert.equal((r.rail.match(/class="wg2-ev"/g)||[]).length,Math.min(n,6));assert.equal(r.count,'21');});
test('zero flyers keeps a truthful event count',async()=>{const r=await run({ok:true,total:21,results:[event(1,false)]});assert.equal(r.count,'21');assert.match(r.rail,/THE EVENT FINDER/);});
test('an empty successful search displays zero rather than unknown',async()=>{const r=await run({ok:true,total:0,results:[]});assert.equal(r.count,'0');});
test('duplicate event flyers are not repeated',async()=>{const r=await run({ok:true,total:2,results:[event(1),event(1)]});assert.equal((r.rail.match(/class="wg2-ev"/g)||[]).length,1);});
for (const mode of ['network','http','invalid']) test(mode+' failure remains unknown, not zero',async()=>{const r=await run(null,{reject:mode==='network',ok:mode!=='http'});assert.equal(r.count,'–');assert.match(r.rail,/THE EVENT FINDER/);});
test('the Portland rail retains the current Pacific date after UTC midnight',async()=>{const r=await run({ok:true,total:0,results:[]});const q=new URL(r.url,'https://example.com').searchParams;assert.equal(q.get('from'),'2026-11-04');assert.equal(q.get('to'),'2026-11-18');});
test('Pacific date is stable at the DST fall-back boundary',async()=>{const r=await run({ok:true,total:0,results:[]},{now:'2026-11-01T08:30:00Z'});assert.equal(new URL(r.url,'https://example.com').searchParams.get('from'),'2026-11-01');});
