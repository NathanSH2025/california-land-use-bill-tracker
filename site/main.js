const S={records:[],meta:null,status:new Set(),category:new Set(),impact:new Set(),removed:new Set(JSON.parse(localStorage.getItem("billTrackerRemoved-v1")||"[]"))};
const impacts=["Development Code Update","Review Impacts","General Plan Update","Procedure Update","Monitor / FYI","No Changes Required"];
const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
const slug=(v="")=>v.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const statusLabel=s=>s==="Active"?"Active Bill":s==="Inactive"?"Inactive Bill":s;

async function start(){
  const [m,b]=await Promise.all([fetch("./data/tracker-meta.json",{cache:"no-store"}),fetch("./data/bills-active.json",{cache:"no-store"})]);
  S.meta=await m.json(); S.records=(await b.json()).records||[];
  const c=S.meta.snapshot_counts||{};
  [["metric-tracked",c.bills_tracked],["metric-chaptered",c.chaptered],["metric-vetoed",c.vetoed],["metric-recent",c.changes_last_7_days],["metric-removed",c.removed_not_tracking]].forEach(([id,v])=>{if(v!=null)document.getElementById(id).textContent=v});
  ["Active","Amended","Inactive"].forEach(x=>S.status.add(x));
  [...new Set(S.records.flatMap(r=>r.categories||[]))].forEach(x=>S.category.add(x));
  impacts.forEach(x=>S.impact.add(x));
  filters(); events(); render();
}
function filters(){
  options("status",["Active","Amended","Inactive","Chaptered","Vetoed"],S.status);
  options("category",[...new Set(S.records.flatMap(r=>r.categories||[]))].sort(),S.category);
  options("impact",impacts,S.impact);
  counts();
}
function options(kind,arr,set){
  const host=document.querySelector('[data-filter-options="'+kind+'"]');
  host.innerHTML=arr.map(v=>'<label class="check-option"><input type="checkbox" data-filter-kind="'+kind+'" value="'+esc(v)+'" '+(set.has(v)?"checked":"")+'><span>'+esc(statusLabel(v))+'</span></label>').join("");
}
function counts(){
  document.getElementById("status-count").textContent="("+S.status.size+")";
  document.getElementById("category-count").textContent="("+S.category.size+")";
  document.getElementById("impact-count").textContent="("+S.impact.size+")";
}
function shown(){
  const q=document.getElementById("search").value.trim().toLowerCase();
  return S.records.filter(r=>!S.removed.has(r.id)).filter(r=>S.status.has(r.status)).filter(r=>(r.categories||[]).some(c=>S.category.has(c))).filter(r=>S.impact.has(r.county_impact_category)).filter(r=>!q||[r.id,r.title,r.summary,r.county_impact,r.recommended_action,(r.categories||[]).join(" ")].join(" ").toLowerCase().includes(q));
}
function render(){
  const rows=shown(), total=S.meta?.snapshot_counts?.bills_tracked||202;
  document.getElementById("showing").textContent="Showing "+rows.length+" of "+total+" tracked bills";
  document.getElementById("bill-list").innerHTML=rows.length?rows.map(card).join(""):'<div class="empty-state">No bills match the selected filters.</div>';
  removed();
}
function card(r,isRemoved=false){
  return '<article class="bill-card"><div class="card-head"><div><div><span class="bill-id">'+esc(r.id)+'</span><span class="session">'+esc(r.session)+'</span></div><div class="bill-title">'+esc(r.title)+'</div></div><span class="status-pill status-'+slug(r.status)+'">'+esc(statusLabel(r.status))+'</span></div>'+
  '<div class="impact-row"><span class="impact-pill impact-'+slug(r.county_impact_category)+'">'+esc(r.county_impact_category)+'</span></div>'+
  '<div class="meta-row">Last Updated: '+esc(r.last_updated)+' · '+esc(r.legislative_stage)+'<br>Category: '+esc((r.categories||[]).join(", "))+'</div>'+
  block("BILL SUMMARY",r.summary)+block("COUNTY IMPACT",r.county_impact)+block("RECOMMENDED ACTION",r.recommended_action)+
  '<div class="card-actions"><a href="'+esc(r.official_bill_text)+'" target="_blank" rel="noopener">Official bill text ↗</a><a href="'+esc(r.status_history)+'" target="_blank" rel="noopener">Status &amp; history ↗</a>'+
  (isRemoved?'<button type="button" data-restore="'+esc(r.id)+'">Add back to tracker</button>':'<button class="remove" type="button" data-remove="'+esc(r.id)+'">Remove from tracker</button>')+'</div></article>';
}
function block(label,text){return '<div class="record-block"><div class="record-label"><span>'+label+'</span></div><p class="record-text">'+esc(text)+'</p></div>'}
function removed(){
  const rows=S.records.filter(r=>S.removed.has(r.id));
  const host=document.getElementById("removed-list");
  host.innerHTML=rows.length?rows.map(r=>card(r,true)).join(""):'<div class="empty-state">No locally removed records yet. Original removed-bill detail is being restored during migration.</div>';
}
function events(){
  document.getElementById("search").addEventListener("input",render);
  document.addEventListener("change",e=>{const x=e.target.closest("[data-filter-kind]");if(!x)return;const set=S[x.dataset.filterKind];x.checked?set.add(x.value):set.delete(x.value);counts();render()});
  document.addEventListener("click",e=>{
    const a=e.target.closest("[data-filter-action]");if(a){const d=a.closest(".filter"),k=d.querySelector("[data-filter-options]").dataset.filterOptions,inputs=[...d.querySelectorAll('input[type="checkbox"]')],yes=a.dataset.filterAction==="select-all";inputs.forEach(x=>{x.checked=yes;yes?S[k].add(x.value):S[k].delete(x.value)});counts();render();return}
    const rm=e.target.closest("[data-remove]");if(rm){S.removed.add(rm.dataset.remove);saveRemoved();render();return}
    const rs=e.target.closest("[data-restore]");if(rs){S.removed.delete(rs.dataset.restore);saveRemoved();render();return}
  });
  document.getElementById("toggle-removed").addEventListener("click",()=>{const x=document.getElementById("removed-list");x.hidden=!x.hidden;document.getElementById("toggle-removed").textContent=x.hidden?"Show removed":"Hide removed"});
  document.getElementById("update-tracker").addEventListener("click",()=>document.getElementById("scan-dialog").showModal());
  document.getElementById("export-tracker").addEventListener("click",exportCsv);
}
function saveRemoved(){localStorage.setItem("billTrackerRemoved-v1",JSON.stringify([...S.removed]))}
function exportCsv(){
  const h=["Bill","Session","Title","Status","Category","County Impact Category","Last Updated","Bill Summary","County Impact","Recommended Action","Official Bill Text"];
  const data=shown().map(r=>[r.id,r.session,r.title,statusLabel(r.status),(r.categories||[]).join("; "),r.county_impact_category,r.last_updated,r.summary,r.county_impact,r.recommended_action,r.official_bill_text]);
  const csv=[h,...data].map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="california-land-use-bills.csv";a.click();
}
start().catch(e=>{console.error(e);document.getElementById("showing").textContent="Tracker data could not be loaded."});