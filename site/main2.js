const S={records:[],meta:null,status:new Set(),category:new Set(),impact:new Set(),removed:new Set(JSON.parse(localStorage.getItem("billTrackerRemoved-v1")||"[]")),overrides:JSON.parse(localStorage.getItem("billTrackerOverrides-v2")||"{}")};
const impacts=["Development Code Update","Review Impacts","General Plan Update","Procedure Update","Monitor / FYI","No Changes Required"];
const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
const slug=(v="")=>v.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const statusLabel=s=>s==="Active"?"Active Bill":s==="Inactive"?"Inactive Bill":s;
const chunkNames=[1,2,3,4,5,6,7].map(n=>"./data/workbook-recovery-"+n+".json");

async function start(){
  const responses=await Promise.all([
    fetch("./data/tracker-meta.json",{cache:"no-store"}),
    fetch("./data/bills-active.json",{cache:"no-store"}),
    ...chunkNames.map(x=>fetch(x,{cache:"no-store"}))
  ]);
  S.meta=await responses[0].json();
  const active=await responses[1].json();
  const recovery=(await Promise.all(responses.slice(2).map(r=>r.json()))).flatMap(x=>x.records||[]);
  const map=new Map((active.records||[]).map(r=>[r.id,r]));
  recovery.filter(r=>r.signed_status).forEach(r=>{
    const old=map.get(r.id);
    if(old){map.set(r.id,{...old,status:r.signed_status,recovered_completed_status:true});return}
    map.set(r.id,completedRecord(r));
  });
  S.records=[...map.values()];
  header(); filters(); events(); render();
}
function completedRecord(r){
  const text=((r.type||"")+" "+(r.subtype||"")+" "+(r.title||"")+" "+(r.description||"")).toLowerCase();
  const category=/housing|residential|adu|jadu|rhna|density bonus|shelter|care facilit/.test(text)?"Residential":/data center|warehouse|industrial|logistics/.test(text)?"Industrial":/commercial/.test(text)?"Commercial":"Other / Cross-cutting";
  return {id:r.id,session:r.session||"2025–2026",title:r.title||r.type||r.id,status:r.signed_status,legislative_stage:r.signed_status==="Chaptered"?"Enacted":"Did not become law",county_impact_category:"Review Impacts",last_updated:"",categories:[category],summary:r.description||"",county_impact:"County impact note pending recovery review.",recommended_action:r.signed_status==="Vetoed"?"No implementation action; the proposal did not become law.":"Implementation note pending recovery review.",official_bill_text:r.official_bill_text,status_history:r.status_history,tracking_state:"tracked",migration_review:true};
}
function current(r){return {...r,...(S.overrides[r.id]||{})}}
function header(){
  const c=S.meta.snapshot_counts||{};
  [["metric-tracked",c.bills_tracked],["metric-chaptered",c.chaptered],["metric-vetoed",c.vetoed],["metric-recent",c.changes_last_7_days],["metric-removed",c.removed_not_tracking]].forEach(([id,v])=>{if(v!=null)document.getElementById(id).textContent=v});
}
function filters(){
  ["Active","Amended","Inactive"].forEach(x=>S.status.add(x));
  [...new Set(S.records.flatMap(r=>r.categories||[]))].forEach(x=>S.category.add(x));
  impacts.forEach(x=>S.impact.add(x));
  options("status",["Active","Amended","Inactive","Chaptered","Vetoed"],S.status);
  options("category",[...new Set(S.records.flatMap(r=>r.categories||[]))].sort(),S.category);
  options("impact",impacts,S.impact); counts();
}
function options(kind,arr,set){const host=document.querySelector('[data-filter-options="'+kind+'"]');host.innerHTML=arr.map(v=>'<label class="check-option"><input type="checkbox" data-filter-kind="'+kind+'" value="'+esc(v)+'" '+(set.has(v)?"checked":"")+'><span>'+esc(statusLabel(v))+'</span></label>').join("")}
function counts(){document.getElementById("status-count").textContent="("+S.status.size+")";document.getElementById("category-count").textContent="("+S.category.size+")";document.getElementById("impact-count").textContent="("+S.impact.size+")"}
function shown(){
  const q=document.getElementById("search").value.trim().toLowerCase();
  return S.records.filter(r=>!S.removed.has(r.id)).map(current).filter(r=>S.status.has(r.status)).filter(r=>(r.categories||[]).some(c=>S.category.has(c))).filter(r=>S.impact.has(r.county_impact_category)).filter(r=>!q||[r.id,r.title,r.summary,r.county_impact,r.recommended_action,(r.categories||[]).join(" ")].join(" ").toLowerCase().includes(q));
}
function render(){
  const rows=shown(),total=S.meta?.snapshot_counts?.bills_tracked||202;
  document.getElementById("showing").textContent="Showing "+rows.length+" of "+total+" tracked bills";
  document.getElementById("bill-list").innerHTML=rows.length?rows.map(r=>card(r,false)).join(""):'<div class="empty-state">No bills match the selected filters.</div>';
  renderRemoved();
}
function block(label,text,id){return '<div class="record-block"><div class="record-label"><span>'+label+'</span><button type="button" data-edit="'+esc(id)+'">Edit</button></div><p class="record-text">'+esc(text)+'</p></div>'}
function card(r,isRemoved){
  return '<article class="bill-card"><div class="card-head"><div><div><span class="bill-id">'+esc(r.id)+'</span><span class="session">'+esc(r.session)+'</span></div><div class="bill-title">'+esc(r.title)+'</div></div><span class="status-pill status-'+slug(r.status)+'">'+esc(statusLabel(r.status))+'</span></div>'+
  '<div class="impact-row"><span class="impact-pill impact-'+slug(r.county_impact_category)+'">'+esc(r.county_impact_category)+'</span></div>'+
  '<div class="meta-row">'+(r.last_updated?"Last Updated: "+esc(r.last_updated)+" · ":"")+esc(r.legislative_stage)+'<br>Category: '+esc((r.categories||[]).join(", "))+'</div>'+
  block("BILL SUMMARY",r.summary,r.id)+block("COUNTY IMPACT",r.county_impact,r.id)+block("RECOMMENDED ACTION",r.recommended_action,r.id)+
  '<div class="card-actions"><a href="'+esc(r.official_bill_text)+'" target="_blank" rel="noopener">Official bill text ↗</a><a href="'+esc(r.status_history)+'" target="_blank" rel="noopener">Status &amp; history ↗</a>'+
  (isRemoved?'<button type="button" data-restore="'+esc(r.id)+'">Add back to tracker</button>':'<button class="remove" type="button" data-remove="'+esc(r.id)+'">Remove from tracker</button>')+'</div></article>';
}
function renderRemoved(){
  const rows=S.records.filter(r=>S.removed.has(r.id)).map(current),host=document.getElementById("removed-list");
  host.innerHTML=rows.length?rows.map(r=>card(r,true)).join(""):'<div class="empty-state">No locally removed records yet. Original removed-bill detail is still being reconciled.</div>';
}
function events(){
  document.getElementById("search").addEventListener("input",render);
  document.addEventListener("change",e=>{const x=e.target.closest("[data-filter-kind]");if(!x)return;const set=S[x.dataset.filterKind];x.checked?set.add(x.value):set.delete(x.value);counts();render()});
  document.addEventListener("click",e=>{
    const a=e.target.closest("[data-filter-action]");if(a){const d=a.closest(".filter"),k=d.querySelector("[data-filter-options]").dataset.filterOptions,inputs=[...d.querySelectorAll('input[type="checkbox"]')],yes=a.dataset.filterAction==="select-all";inputs.forEach(x=>{x.checked=yes;yes?S[k].add(x.value):S[k].delete(x.value)});counts();render();return}
    const rm=e.target.closest("[data-remove]");if(rm){S.removed.add(rm.dataset.remove);saveRemoved();render();return}
    const rs=e.target.closest("[data-restore]");if(rs){S.removed.delete(rs.dataset.restore);saveRemoved();render();return}
    const ed=e.target.closest("[data-edit]");if(ed){openEdit(ed.dataset.edit);return}
    const info=e.target.closest("[data-info]");if(info){showInfo(info.dataset.info);return}
  });
  document.getElementById("toggle-removed").addEventListener("click",()=>{const x=document.getElementById("removed-list");x.hidden=!x.hidden;document.getElementById("toggle-removed").textContent=x.hidden?"Show removed":"Hide removed"});
  document.getElementById("update-tracker").addEventListener("click",()=>document.getElementById("scan-dialog").showModal());
  document.getElementById("export-tracker").addEventListener("click",exportCsv);
  document.getElementById("save-edit").addEventListener("click",e=>{e.preventDefault();saveEdit()});
}
function saveRemoved(){localStorage.setItem("billTrackerRemoved-v1",JSON.stringify([...S.removed]))}
function openEdit(id){
  const r=current(S.records.find(x=>x.id===id));if(!r)return;
  document.getElementById("edit-bill-id").value=id;document.getElementById("edit-title").textContent=id+" — "+r.title;
  document.getElementById("edit-summary").value=r.summary||"";document.getElementById("edit-impact").value=r.county_impact||"";document.getElementById("edit-action").value=r.recommended_action||"";document.getElementById("edit-official-link").value=r.official_bill_text||"";document.getElementById("edit-dialog").showModal();
}
function saveEdit(){
  const id=document.getElementById("edit-bill-id").value;
  S.overrides[id]={...(S.overrides[id]||{}),summary:document.getElementById("edit-summary").value.trim(),county_impact:document.getElementById("edit-impact").value.trim(),recommended_action:document.getElementById("edit-action").value.trim(),official_bill_text:document.getElementById("edit-official-link").value.trim()};
  localStorage.setItem("billTrackerOverrides-v2",JSON.stringify(S.overrides));document.getElementById("edit-dialog").close();render();
}
function showInfo(kind){
  const status={Active:"Pending in the legislative process.",Amended:"Bill text has changed.",Inactive:"Not currently moving forward or did not become law in its tracked form.",Chaptered:"Enacted and assigned a chapter in the Statutes.",Vetoed:"Formally rejected by the Governor after passage by the Legislature."};
  const impact={"Development Code Update":"Evaluate a likely Title 8 or other LUS development-standard change.","Review Impacts":"Needs staff review before a more specific Planning classification is assigned.","General Plan Update":"A Countywide Plan, Housing Element, or other General Plan change may be needed.","Procedure Update":"A Planning review, noticing, CEQA, reporting, permit, or administrative workflow may need to change.","Monitor / FYI":"No immediate Planning change identified; watch later implementation or guidance.","No Changes Required":"No LUS Planning code, plan, or workflow change identified at the current status."};
  let defs=kind==="status"?status:kind==="impact"?impact:Object.fromEntries([...new Set(S.records.flatMap(r=>r.categories||[]))].sort().map(c=>[c,"Groups bills with similar land-use subject matter."]));
  document.getElementById("info-title").textContent=kind==="status"?"Status definitions":kind==="impact"?"County impact definitions":"Category definitions";
  document.getElementById("info-content").innerHTML=Object.entries(defs).map(([k,v])=>'<div class="info-item"><div class="info-term">'+esc(k)+'</div><div class="info-definition">'+esc(v)+'</div></div>').join("");document.getElementById("info-dialog").showModal();
}
function exportCsv(){
  const h=["Bill","Session","Title","Status","Category","County Impact Category","Last Updated","Bill Summary","County Impact","Recommended Action","Official Bill Text"];
  const data=shown().map(r=>[r.id,r.session,r.title,statusLabel(r.status),(r.categories||[]).join("; "),r.county_impact_category,r.last_updated,r.summary,r.county_impact,r.recommended_action,r.official_bill_text]);
  const csv=[h,...data].map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="california-land-use-bills.csv";a.click();
}
start().catch(e=>{console.error(e);document.getElementById("showing").textContent="Tracker data could not be loaded."});