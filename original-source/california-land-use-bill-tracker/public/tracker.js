const rows = document.getElementById('rows');
const search = document.getElementById('search');
const statusSelect = document.getElementById('status');
const hiddenByDefault = new Set(['Approved by Governor','Chaptered','Vetoed']);
const area = document.getElementById('area');
const impactFilter = document.getElementById('impact-filter');
const canonicalStatus=status=>({Pending:'Active Bill',Inactive:'Inactive Bill',Enacted:'Chaptered',Signed:'Approved by Governor'})[status]||status;
const filterDefinitions={
  status:{
    'Active Bill':['Still active in this legislative session. This label does not mean the bill has become law.'],
    'Inactive Bill':['No longer active in this session. Check the dated action to see whether it failed, was vetoed, or became law.'],
    Chaptered:['Assigned a chapter number by the Secretary of State. The bill became law, though its effective date may be later.'],
    'Approved by Governor':['Signed by the Governor. The tracker has not yet recorded a chapter number.'],
    Enrolled:['The final bill was prepared for delivery to the Governor after passing the Legislature. It is not law yet.'],
    Amended:['The bill text was revised. This describes its latest action, not its final outcome.'],
    Vetoed:['Rejected by the Governor. It does not become law unless the Legislature overrides the veto.']
  },
  area:{
    Residential:['The bill specifically regulates housing, dwellings, ADUs, residential lots, housing elements, or residential development.'],
    Commercial:['The bill specifically regulates retail, offices, lodging, services, or other commercial development.'],
    Industrial:['The bill specifically regulates warehouses, logistics, manufacturing, data centers, or other industrial facilities.'],
    Agricultural:['The bill specifically regulates farming, farmland, ranches, Williamson Act contracts, or agricultural conservation.'],
    'Other / Cross-cutting':['The bill addresses a general planning, zoning, CEQA, permitting, infrastructure, or other issue that does not clearly fit one of the four specific land uses.']
  },
  'impact-filter':{
    'Review Impacts':['Planning has not yet determined whether a code, plan, or process change is needed.'],
    'Development Code Update':['The bill appears to require a change to the County Development Code or zoning standards. Verify the enacted text and timing.','https://lus.sbcounty.gov/planning-home/development-code/'],
    'General Plan Update':['The bill may require changes to the Countywide Plan, its elements, maps, or implementation. Verify the enacted text.','https://opr.ca.gov/planning/general-plan/'],
    'Procedure Update':['Planning may need to change application, noticing, review, reporting, or permit procedures.'],
    'Monitor / FYI':['No immediate Planning change identified, but follow developments or share the bill with affected County staff.'],
    'No Changes Required':['No LUS Planning change has been identified at this bill’s current status. Recheck if it is amended or becomes law.']
  }
};
function installFilterHelp(){
  for(const filter of [statusSelect,area,impactFilter]){
    const definitions=filterDefinitions[filter.id];
    const toolbar=filter.querySelector('.filter-quick');
    const wrap=document.createElement('div');wrap.className='filter-help-wrap';
    const button=document.createElement('button');
    button.type='button';button.className='filter-info';
    button.innerHTML='<span aria-hidden="true">i</span>';
    button.setAttribute('aria-label',`Explain ${filter.dataset.noun}`);
    button.setAttribute('aria-expanded','false');
    const help=document.createElement('div');
    help.className='filter-help';help.id=`filter-help-${filter.id}`;
    help.setAttribute('role','region');help.setAttribute('aria-label',`${filter.dataset.noun} explained`);
    button.setAttribute('aria-controls',help.id);
    const close=document.createElement('button');
    close.type='button';close.className='filter-help-close';close.textContent='Close';
    close.setAttribute('aria-label',`Close ${filter.dataset.noun} definitions`);
    help.append(close);
    if(filter.id==='impact-filter'){const note=document.createElement('p');note.className='filter-help-note';note.textContent='County impact labels are tracker assessments, not legal status categories.';help.append(note);}
    if(filter.id==='area'){const note=document.createElement('p');note.className='filter-help-note';note.textContent='A bill gets a specific use when its current subject identifies that use or a reviewer assigns it. General or unclear bills appear in Other / Cross-cutting. A bill can have more than one category.';help.append(note);}
    for(const label of filter.querySelectorAll('fieldset > label')){
      const value=label.querySelector('input').value;
      const [description]=definitions[value];
      const item=document.createElement('div');item.className='filter-help-item';
      const heading=document.createElement('strong');heading.textContent=label.textContent.trim();
      const explanation=document.createElement('p');explanation.textContent=description;
      item.append(heading,explanation);
      help.append(item);
    }
    wrap.append(button,help);toolbar.append(wrap);
    button.addEventListener('click',()=>{
      const open=!wrap.classList.contains('is-open');
      for(const other of document.querySelectorAll('.filter-help-wrap.is-open')){other.classList.remove('is-open');other.querySelector('.filter-info').setAttribute('aria-expanded','false');}
      wrap.classList.toggle('is-open',open);button.setAttribute('aria-expanded',String(open));
    });
    close.addEventListener('click',()=>{
      wrap.classList.remove('is-open');button.setAttribute('aria-expanded','false');button.focus();
    });
    filter.addEventListener('toggle',()=>{
      if(filter.open)return;
      wrap.classList.remove('is-open');button.setAttribute('aria-expanded','false');
    });
  }
}
installFilterHelp();
function checkedValues(filter){return [...filter.querySelectorAll('input[type="checkbox"]:checked')].map(item=>item.value);}
function matchesSelection(filter, matches){const choices=checkedValues(filter);return choices.length===filter.querySelectorAll('input[type="checkbox"]').length||choices.some(matches);}
function updateFilterLabel(filter){
  if(filter===statusSelect){filter.querySelector('.filter-caption').textContent='Status';return;}
  const selected=checkedValues(filter);
  const total=filter.querySelectorAll('input[type="checkbox"]').length;
  const noun=filter.dataset.noun;
  filter.querySelector('.filter-caption').textContent=selected.length===total?({status:'Status',area:'Category','impact-filter':'County Impact'}[filter.id]||`All ${noun}`):selected.length?`${selected.length} ${noun} selected`:`No ${noun} selected`;
}
const impactOptions = ['Review Impacts','Development Code Update','General Plan Update','Procedure Update','Monitor / FYI','No Changes Required'];
const impactClasses = {'Review Impacts':'review','Development Code Update':'code','General Plan Update':'plan','Procedure Update':'procedure','No Changes Required':'none','Monitor / FYI':'monitor'};
const scanMessage = document.getElementById('scan-result');
const workStatus = document.getElementById('work-status');
function scanError(message) {
  scanMessage.textContent = message;
  scanMessage.hidden = !message;
}
function showWork(message,working=false){
  workStatus.textContent=message;
  workStatus.hidden=!message;
  workStatus.classList.toggle('working',working);
}
const updateButton = document.getElementById('update');
const reviewSection = document.getElementById('review-section');
const reviewList = document.getElementById('review-list');
let bills = [];
let pending = [];
let excludedBills = [];
const confirmedLocalRemovals = new Map();
const selectedRemoved = new Set();
const billSummaries = new Map();
const summaryInFlight = new Set();
let reviewedImpacts = {};
let auditedActions = {auditedAt:'',actions:{}};
let savedActions = {};
let savedSummaries = {};
let savedImpactText = {};
let textVersions = {};
let landUseOverrides = {};
let summaryObserver;
let catalog = new Map(curatedBills.map(b => [b.id, b]));
let summaryFilter = 'all';
let trackerLoaded = false;
function californiaDay() {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type,part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function recentWindow() {
  const today = californiaDay();
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 6);
  return {start:start.toISOString().slice(0,10),end:today};
}
function datedWithin(b,window) {
  return /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') && b.date >= window.start && b.date <= window.end;
}
function recentlyChanged(b,window){
  if(datedWithin(b,window))return true;
  const changed=b.textVersion?.changedAt;
  if(!changed)return false;
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(changed));
  const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  const date=`${values.year}-${values.month}-${values.day}`;
  return date>=window.start&&date<=window.end;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function officialLink(url) {
  return typeof url === 'string' && url.startsWith('https://leginfo.legislature.ca.gov/') ? esc(url) : '#';
}
function hydrate(record) {
  const context = catalog.get(record.id) || {};
  const assessment = reviewedImpacts[record.id];
  const existingNote = context.curatedImpact || (curatedBills.find(b => b.id === record.id)?.impact) || record.impact;
  return {
    ...context, ...record,
    category: context.category || '', subtype: context.subtype || '',
    sheet: context.sheet || '',
    impact: assessment?.note || existingNote,
    codeUrl: assessment?.codeUrl,
    action: assessment?.action || context.curatedAction || (curatedBills.find(b => b.id === record.id)?.action) || record.action,
    text: record.bill_text || record.billText || record.text,
  };
}
function countyAction(record, manual, textVersion, fallback) {
  const status=canonicalStatus(record.status);
  if(status==='Vetoed'||status==='Inactive Bill')return {text:'No LUS Planning implementation action; this bill did not become law.',needsReview:false};
  const audited=auditedActions.actions[record.id];
  const changed=audited&&textVersion?.changedAt&&Date.parse(textVersion.changedAt)>Date.parse(auditedActions.auditedAt);
  const boilerplate=/^(Assign a planner to review|Identify affected review steps|Track implementation guidance|Reassess the current bill text)/i;
  const own=manual?.text&&!boilerplate.test(manual.text)?manual.text:null;
  if(own)return {text:own,needsReview:!!(canonicalStatus(manual.status)!==status||manual.date!==record.date||(textVersion?.changedAt&&Date.parse(textVersion.changedAt)>Date.parse(manual.editedAt)))};
  if(changed)return {text:'Bill text changed since this County action was drafted. Review the new text against the Development Code, Countywide Plan, and application procedures before acting.',needsReview:true};
  const action=audited||fallback;
  if(status==='Approved by Governor'&&!/^No (?:immediate |new |LUS |Planning |Development Code)/i.test(action))return {text:`Prepare to ${action.charAt(0).toLowerCase()}${action.slice(1)}`,needsReview:false};
  if(['Active Bill','Amended','Enrolled'].includes(status)&&!/^No (?:immediate |new |LUS |Planning |Development Code)|^If |^Wait |^Monitor /i.test(action))return {text:`If enacted, ${action.charAt(0).toLowerCase()}${action.slice(1)}`,needsReview:false};
  return {text:action,needsReview:false};
}
const landUseGroups=['Residential','Commercial','Industrial','Agricultural','Other / Cross-cutting'];
function landUsesFor(b){
  const override=landUseOverrides[b.id];
  if(override&&Array.isArray(override.groups)){
    const current=textVersions[b.id]?.hash;
    return override.hash&&current&&override.hash!==current?['Other / Cross-cutting']:(override.groups.length?override.groups:['Other / Cross-cutting']);
  }
  if(b.id==='AB 2118')return ['Residential','Commercial'];
  const description=String(b.subject||'').toLowerCase();
  const groups=[];
  if(/\b(housing|dwelling|residential|adu|jadu|rhna|density bonus|multifamily|single.family|housing element|urban lot split)\b/i.test(description))groups.push('Residential');
  if(/\b(commercial|retail|shopping center|office buildings?|hotels?|motels?|restaurants?|business parks?|short.term rental)\b/i.test(description))groups.push('Commercial');
  if(/\b(industrial|warehous\w*|logistics|manufactur\w*|data centers?|distribution centers?|freight terminals?|truck terminals?)\b/i.test(description))groups.push('Industrial');
  if(/\b(agricultur\w*|farmland|farm\w*|ranch\w*|williamson act|cropland)\b/i.test(description))groups.push('Agricultural');
  return groups.length?groups:['Other / Cross-cutting'];
}
function visibleTrackedBills() {
  if(summaryFilter === 'removed')return [];
  const query = search.value.trim().toLowerCase();
  const window = recentWindow();
  return bills.filter(b =>
    (summaryFilter === 'all' || (summaryFilter === 'chaptered' ? b.status === 'Chaptered' : summaryFilter === 'vetoed' ? b.status === 'Vetoed' : recentlyChanged(b,window))) &&
    matchesSelection(statusSelect,value=>b.status===value) &&
    matchesSelection(area,value=>b.landUses.includes(value)) &&
    matchesSelection(impactFilter,value=>b.impactCategory===value) &&
    [b.id,b.subject,b.status,b.impact,b.impactCategory,b.action,b.category,b.summaryOverride?.text,billSummaries.get(b.id)].join(' ').toLowerCase().includes(query)
  );
}
function visiblePendingBills() {
  if(summaryFilter === 'removed')return [];
  const query = search.value.trim().toLowerCase();
  const window = recentWindow();
  return pending.filter(b =>
    (summaryFilter === 'all' || (summaryFilter === 'chaptered' ? b.status === 'Chaptered' : summaryFilter === 'vetoed' ? b.status === 'Vetoed' : recentlyChanged(b,window))) &&
    (summaryFilter==='all'||matchesSelection(statusSelect,value=>b.status===value)) &&
    matchesSelection(area,value=>b.landUses.includes(value)) &&
    matchesSelection(impactFilter,value=>b.impactCategory===value) &&
    [b.id,b.subject,b.status,b.impact,b.impactCategory,b.action,b.category,b.summaryOverride?.text,billSummaries.get(b.id)].join(' ').toLowerCase().includes(query)
  );
}
function billSummary(b) {
  if (b.summaryOverride?.text) return cleanSummaryStart(b.summaryOverride.text,b.id);
  const official = billSummaries.get(b.id);
  return official ? cleanSummaryStart(official,b.id) : 'Loading official bill summary…';
}
function cleanSummaryStart(value,id){
  const number=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return value.replace(new RegExp(`^${number}\\s*(?:[:—–-]\\s*)?`,'i'),'').replace(/^./,letter=>letter.toUpperCase()).trim();
}
function renderBillCard(b,awaitingReview=false){
  const proposal=['Active Bill','Inactive Bill','Amended','Enrolled'].includes(b.status);
  const summary=billSummary(b);
  const select=`<select class="impact-category ${impactClasses[b.impactCategory]||'review'}" data-impact-id="${esc(b.id)}" aria-label="County impact category for ${esc(b.id)}">${impactOptions.map(option=>`<option value="${esc(option)}" ${b.impactCategory===option?'selected':''}>${esc(option)}</option>`).join('')}</select>`;
  const block=(field,label,value,stale=false)=>`<section class="card-block" data-edit-block="${field}"><div class="card-label">${label}</div><p class="card-copy" ${field==='summary'&&!b.summaryOverride?`data-summary-id="${esc(b.id)}"`:''}>${esc(value)}</p>${stale?'<p class="action-stale">Bill changed since this text was edited. Review the current version.</p>':''}${field==='summary'&&stale&&b.summaryOverride?`<p class="card-copy">Current official summary: <span data-summary-id="${esc(b.id)}">${esc(billSummaries.get(b.id)||'Loading…')}</span></p>`:''}<button class="edit-action" type="button" data-edit-field="${field}" data-id="${esc(b.id)}" aria-label="Edit ${label.toLowerCase()} for ${esc(b.id)}">Edit</button></section>`;
  const landUseEditor=`<details class="land-use-editor"><summary>Category: ${esc(b.landUses.join(', '))}${b.landUseNeedsReview?' · review after text change':''} · Edit</summary><form data-landuse-id="${esc(b.id)}"><p>Select the categories that apply. Use Other / Cross-cutting for a general or unclear bill.</p><div class="land-use-checks">${landUseGroups.map(group=>`<label><input type="checkbox" value="${group}" ${b.landUses.includes(group)?'checked':''}> ${group}</label>`).join('')}</div><button type="submit">Save categories</button>${landUseOverrides[b.id]?` <button type="submit" data-auto="true">Reset automatic</button>`:''}</form></details>`;
  return `<article class="bill-card impact-${impactClasses[b.impactCategory]||'review'}" role="listitem" aria-label="${esc(b.id)} ${esc(b.subject)}"><div class="card-heading"><div class="card-title"><div class="bill">${esc(b.id)} <span class="session-label">2025–2026</span></div><h3>${esc(b.subject)}</h3></div><div class="card-badges"><span class="status ${['Chaptered','Approved by Governor'].includes(b.status)?'enacted':b.status==='Vetoed'?'vetoed':'proposed'}">${esc(b.status)}</span>${select}</div></div><div class="card-date"><strong>Last Updated:</strong> ${esc(b.date||'Date unavailable')}${b.chapter?' · '+esc(b.chapter):''}${proposal?' · Proposed text':''}${b.textVersion?.changedAt?' · Official text changed '+esc(new Date(b.textVersion.changedAt).toLocaleDateString()):''}</div>
    ${landUseEditor}
    ${block('summary','Bill summary',summary,!!b.summaryNeedsReview)}
    ${block('impact','County impact',b.impact,!!b.impactNeedsReview)}
    ${b.codeUrl?`<a class="code-ref" href="${esc(b.codeUrl)}" target="_blank" rel="noopener">County code reference ↗</a>`:''}
    ${block('action','Recommended action',b.action,!!b.actionNeedsReview)}
    <div class="card-footer"><div class="card-sources"><a href="${officialLink(b.text||b.bill_text||b.billText)}" target="_blank" rel="noopener">Official bill text ↗</a><a href="${officialLink(b.url)}" target="_blank" rel="noopener">Status &amp; history ↗</a></div><div class="card-actions">${awaitingReview?`<button type="button" class="approve" data-action="approve" data-id="${esc(b.id)}">Approve addition</button><button type="button" class="remove" data-action="remove" data-id="${esc(b.id)}">Remove and exclude</button>`:`<button type="button" class="remove" data-action="remove" data-id="${esc(b.id)}">Remove from tracker</button>`}</div></div></article>`;
}
function observeBillSummaries(){
  if(summaryObserver)summaryObserver.disconnect();
  const nodes=[...document.querySelectorAll('[data-summary-id]')];
  if(!('IntersectionObserver' in window)){loadBillSummaries(nodes.slice(0,12).map(node=>({id:node.dataset.summaryId})));return;}
  summaryObserver=new IntersectionObserver(entries=>{
    const ids=entries.filter(entry=>entry.isIntersecting).map(entry=>entry.target.dataset.summaryId);
    for(const entry of entries)if(entry.isIntersecting)summaryObserver.unobserve(entry.target);
    if(ids.length)loadBillSummaries([...new Set(ids)].map(id=>({id})));
  },{rootMargin:'250px'});
  for(const node of nodes)summaryObserver.observe(node);
}
function render() {
  const window = recentWindow();
  const recentBills = bills.filter(b => recentlyChanged(b,window));
  const visible = visibleTrackedBills();
  const visiblePending = visiblePendingBills();
  const removedView=summaryFilter==='removed';
  document.getElementById('export-visible').disabled=removedView||!trackerLoaded||!(visible.length+visiblePending.length);
  document.querySelector('.controls').hidden=removedView;
  rows.hidden=removedView;
  document.getElementById('excluded-section').hidden=!removedView;
  document.getElementById('count').textContent = removedView ? `Showing ${excludedBills.length} removed bills` : summaryFilter === 'recent' ? `Showing ${visible.length} bills with official activity in the last 7 days` : `Showing ${visible.length} of ${bills.length} tracked bills`;
  const recentNote = document.getElementById('recent-note');
  recentNote.hidden = summaryFilter !== 'recent';
  recentNote.textContent = `Official action or detected bill text changes ${window.start}–${window.end} (California time). Source checks rotate through bills and keyword searches; unscanned changes may be missing.`;
  document.getElementById('total').textContent = bills.length;
  document.getElementById('enacted').textContent = bills.filter(b => b.status === 'Chaptered').length;
  document.getElementById('vetoed').textContent = bills.filter(b => b.status === 'Vetoed').length;
  document.getElementById('recent').textContent = recentBills.length;
  document.getElementById('removed-total').textContent = excludedBills.length;
  rows.innerHTML=visible.length?visible.map(b=>renderBillCard(b)).join(''):`<p class="empty">${summaryFilter==='recent'?'No tracked bills match the last 7 days and current filters.':'No bills match these filters.'}</p>`;
  reviewSection.hidden = removedView || visiblePending.length === 0;
  document.getElementById('review-count').textContent = visiblePending.length ? `(${visiblePending.length})` : '';
  reviewList.innerHTML=visiblePending.map(b=>renderBillCard(b,true)).join('');
  observeBillSummaries();
  document.getElementById('excluded-count').textContent = `(${excludedBills.length})`;
  document.getElementById('excluded-list').innerHTML = excludedBills.length ? excludedBills.map(b => `<div class="review-item"><label class="excluded-check"><input type="checkbox" data-removed-id="${esc(b.id)}" ${selectedRemoved.has(b.id)?'checked':''} aria-label="Select ${esc(b.id)} for permanent deletion"><span><strong>${esc(b.id)} · ${esc(b.subject)}</strong><br><small>${esc(b.status)}${b.date ? ' · last checked ' + esc(b.date) : ''} · Removed ${esc(new Date(b.decided_at).toLocaleDateString())}</small></span></label><button type="button" class="add-back" data-action="restore" data-id="${esc(b.id)}">Add back to tracker</button></div>`).join('') : '<p class="count">No bills removed.</p>';
  updateRemovalSelection();
}
function updateRemovalSelection(){
  const available=new Set(excludedBills.map(b=>b.id));
  for(const id of selectedRemoved)if(!available.has(id))selectedRemoved.delete(id);
  const all=document.getElementById('select-all-removed');
  all.checked=excludedBills.length>0&&selectedRemoved.size===excludedBills.length;
  all.indeterminate=selectedRemoved.size>0&&selectedRemoved.size<excludedBills.length;
  all.disabled=!excludedBills.length;
  const button=document.getElementById('delete-selected');
  button.disabled=!selectedRemoved.size;
  button.textContent=selectedRemoved.size?`Delete ${selectedRemoved.size} selected permanently`:'Delete selected permanently';
}
async function loadBillSummaries(items) {
  const queue=[...new Map(items.map(b=>[b.id,b])).values()].filter(b=>!billSummaries.has(b.id)&&!summaryInFlight.has(b.id));
  for(const b of queue)summaryInFlight.add(b.id);
  async function worker(){
    while(queue.length){
      const b=queue.shift();
      try{
        const response=await fetch(`/api/tracker?summary=${encodeURIComponent(b.id)}`);
        const data=await readApiJson(response,'Official bill description temporarily unavailable. Read official text.');
        billSummaries.set(b.id,data.summary);
      }catch(error){billSummaries.set(b.id,error.message || 'Official bill description temporarily unavailable. Read official text.');}
      finally{summaryInFlight.delete(b.id);}
      for(const card of document.querySelectorAll('[data-summary-id]'))if(card.dataset.summaryId===b.id){
        const record=bills.find(item=>item.id===b.id)||pending.find(item=>item.id===b.id);
        card.textContent=record?.summaryOverride?.text?billSummaries.get(b.id):(record?billSummary(record):billSummaries.get(b.id));
      }
    }
  }
  await Promise.all(Array.from({length:Math.min(4,queue.length)},()=>worker()));
}
function applyData(data) {
  trackerLoaded=true;
  landUseOverrides=data.landUseOverrides||{};
  const nextVersions=data.textVersions||{};
  billSummaries.clear();
  for(const [id,summary] of Object.entries(data.auditedSummaries||{}))billSummaries.set(id,summary);
  textVersions=nextVersions;
  savedActions=data.actionOverrides||{};
  savedSummaries=data.summaryOverrides||{};
  savedImpactText=data.impactOverrides||{};
  excludedBills = data.excluded || [];
  for(const [id,record] of confirmedLocalRemovals){
    if(excludedBills.some(b=>b.id===id))confirmedLocalRemovals.delete(id);
    else excludedBills.unshift(record);
  }
  const excluded = new Set(excludedBills.map(b => b.id));
  bills = (data.bills || []).filter(b => !excluded.has(b.id)).map(b => {
    const review = reviewedImpacts[b.id];
    const stale = review && (canonicalStatus(review.statusAtReview) !== canonicalStatus(b.status) || review.dateAtReview !== b.date);
    const saved = data.impactCategories?.[b.id];
    const hydrated = hydrate(b);
    const manual=savedActions[b.id],impactEdit=savedImpactText[b.id],summaryEdit=savedSummaries[b.id];
    const textVersion=textVersions[b.id];
    const newer=edit=>!!(textVersion?.changedAt&&edit?.editedAt&&Date.parse(textVersion.changedAt)>Date.parse(edit.editedAt));
    const ab1573=b.id==='AB 1573'&&b.date==='2026-09-27',ab2118=b.id==='AB 2118'&&b.date==='2026-09-27';
    const action=countyAction(b,manual,textVersion,hydrated.action);
    return {...hydrated,landUses:landUsesFor(hydrated),landUseNeedsReview:!!(landUseOverrides[b.id]?.hash&&textVersion?.hash&&landUseOverrides[b.id].hash!==textVersion.hash),textVersion,impactCategory:impactOptions.includes(saved) ? saved : stale ? 'Review Impacts' : review?.category || 'Review Impacts', impact:impactEdit?.text||(ab2118?'County objective zoning, subdivision, and design standards used for eligible streamlined housing projects cannot bar or limit the allowed mix of residential and commercial uses.':ab1573?'The County may include these survivors when identifying target populations for supportive housing in the Housing Element. The bill allows their inclusion but does not require an immediate Housing Element amendment.':stale ? 'Bill changed since this first-pass assessment. Recheck its current text and County requirements.' : hydrated.impact),impactNeedsReview:!!impactEdit&&(canonicalStatus(impactEdit.status)!==canonicalStatus(b.status)||impactEdit.date!==b.date||newer(impactEdit)),summaryOverride:summaryEdit,summaryNeedsReview:!!summaryEdit&&(canonicalStatus(summaryEdit.status)!==canonicalStatus(b.status)||summaryEdit.date!==b.date||newer(summaryEdit)),action:action.text,actionNeedsReview:action.needsReview};
  }).sort((a,b) => b.date.localeCompare(a.date));
  pending = (data.pending || []).filter(b => !excluded.has(b.id)).map(b=>({
    ...b,category:catalog.get(b.id)?.category||'',subtype:catalog.get(b.id)?.subtype||'',landUses:landUsesFor(b),landUseNeedsReview:!!(landUseOverrides[b.id]?.hash&&textVersions[b.id]?.hash&&landUseOverrides[b.id].hash!==textVersions[b.id].hash),text:b.bill_text||b.billText,textVersion:textVersions[b.id],impactCategory:data.impactCategories?.[b.id]||'Review Impacts',impact:savedImpactText[b.id]?.text||b.impact,impactNeedsReview:!!savedImpactText[b.id]&&(canonicalStatus(savedImpactText[b.id].status)!==canonicalStatus(b.status)||savedImpactText[b.id].date!==b.date||Date.parse(textVersions[b.id]?.changedAt)>Date.parse(savedImpactText[b.id].editedAt)),summaryOverride:savedSummaries[b.id],summaryNeedsReview:!!savedSummaries[b.id]&&(canonicalStatus(savedSummaries[b.id].status)!==canonicalStatus(b.status)||savedSummaries[b.id].date!==b.date||Date.parse(textVersions[b.id]?.changedAt)>Date.parse(savedSummaries[b.id].editedAt)),action:countyAction(b,savedActions[b.id],textVersions[b.id],b.action).text,actionNeedsReview:countyAction(b,savedActions[b.id],textVersions[b.id],b.action).needsReview
  }));
  if (data.checkedAt) {
    document.getElementById('review-label').textContent = 'Last source scan:';
    document.getElementById('review-date').textContent = new Date(data.checkedAt).toLocaleString();
  }
  if(!document.querySelector('.action-editor:not([data-submitting])'))render();
}
function csvCell(value){
  let content=String(value??'');
  if(/^[\s\uFEFF]*[=+\-@]/.test(content))content=`'${content}`;
  return `"${content.replace(/"/g,'""')}"`;
}
async function exportCsv(){
  const records=[...visiblePendingBills().map(b=>({b,group:'Awaiting review'})),...visibleTrackedBills().map(b=>({b,group:'Tracked'}))];
  if(!records.length)return;
  const headers=['List','Legislative session','Bill','Subject','Land use categories','Status','Official action date','Chapter','County impact category','County impact','Recommended action','Bill summary','Subject category','Subtype','Status and history URL','Official bill text URL','Last source check','Removed date'];
  const lines=[headers,...records.map(({b,group})=>{
    const record=group==='Tracked'?b:hydrate(b);
    const billId=`202520260${b.id.replace(' ','')}`;
    return [group,'2025–2026',b.id,b.subject,record.landUses?.join('; ')||'Other / Cross-cutting',b.status,b.date,b.chapter,record.impactCategory||'',savedImpactText[b.id]?.text||record.impact||'',record.action||'',billSummary(b),record.category||'',record.subtype||'',b.url||`https://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=${billId}`,record.text||`https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=${billId}`,b.checked_at||b.checkedAt||'',b.decided_at||''];
  })];
  const csv='\uFEFF'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const filename=`california-land-use-bills-visible-${date}.csv`;
  if(typeof window.showSaveFilePicker==='function'){
    try{
      const handle=await window.showSaveFilePicker({suggestedName:filename,types:[{description:'CSV file',accept:{'text/csv':['.csv']}}]});
      const writer=await handle.createWritable();
      await writer.write(csv);
      await writer.close();
      showWork(`Saved ${filename}.`);
      return;
    }catch(error){
      if(error.name==='AbortError'){showWork('Save canceled.');return;}
      // Embedded browsers may disallow the native Save dialog.
    }
  }
  try{
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download=filename;link.hidden=true;
    document.body.append(link);
    link.click();
    setTimeout(()=>{link.remove();URL.revokeObjectURL(url);},60000);
    showWork('Download requested. If no file appears, this embedded viewer blocks downloads; open the tracker in a regular browser tab to export.');
  }catch(error){showWork('This viewer could not save the CSV. Open the tracker in a regular browser tab to export.');}
}
async function getSaved() {
  let lastError;
  for(let attempt=0;attempt<2;attempt++){
    try {
      const response = await fetch(`/api/tracker?refresh=${Date.now()}-${attempt}`, {cache:'no-store',headers:{'Accept':'application/json'}});
      const data = await readApiJson(response,'Saved tracker data is unavailable. Please reload and try again.');
      applyData(data);
      return data;
    } catch(error){lastError=error;}
  }
  throw lastError;
}
async function readApiJson(response,fallback){
  const type=response.headers.get('content-type')||'';
  if(!type.includes('application/json'))throw Error(response.redirected||type.includes('text/html')?'The dashboard received an HTML page instead of tracker data. Reload the dashboard to reconnect.':fallback);
  let data;
  try{data=await response.json();}catch{throw Error('The dashboard received an unreadable response. Reload and try again.');}
  if(!response.ok)throw Error(data.error||fallback);
  return data;
}
async function load() {
  showWork('Loading saved bills…',true);
  let stale = false;
  try {
    const [response,reviewResponse,actionResponse] = await Promise.all([fetch('/team-bills.json'),fetch('/reviewed-impacts.json'),fetch('/audited-actions.json')]);
    if (response.ok) for (const item of await response.json()) catalog.set(item.id, item);
    if (!reviewResponse.ok) throw Error('County impact assessments are unavailable. Please reload and try again.');
    reviewedImpacts = await reviewResponse.json();
    if(!actionResponse.ok)throw Error('County action assessments are unavailable. Please reload and try again.');
    auditedActions=await actionResponse.json();
    const data = await getSaved();
    scanError(data.result?.startsWith('Partial scan:')?data.result:'');
    stale = !data.checkedAt || !Number.isFinite(Date.parse(data.checkedAt)) || Date.now() - Date.parse(data.checkedAt) >= 24 * 60 * 60 * 1000;
  } catch (error) {
    scanError(error.message || 'Tracker data is unavailable. Please reload and try again.');
  } finally {
    showWork('');
    // The saved list is rendered first. A failed source scan never clears it.
    if (stale) setTimeout(() => { if (!updateButton.disabled) update(); }, 0);
  }
}
async function update() {
  updateButton.disabled = true;
  updateButton.textContent = 'Checking sources…';
  showWork('Checking the official legislative sources. This can take a minute…',true);
  scanError('');
  try {
    let previous='',stalled=0,continuing=false;
    while(true){
      const response = await fetch('/api/tracker', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({continueScan:continuing})});
      if(response.status===429){await new Promise(resolve=>setTimeout(resolve,21000));continue;}
      const data = await readApiJson(response,'Update failed.');
      applyData(data);
      const remaining=(data.discoveryRemaining||0)+(data.textRemaining||0);
      if(!remaining){
        scanError(data.partial?data.result:'');
        showWork(data.partial?'Updates saved; source failures prevented a complete scan.':'Full scan finished. Review newly found bills below.');
        break;
      }
      const progress=`${data.discoveryRemaining}:${data.textRemaining}`;
      stalled=progress===previous?stalled+1:0;previous=progress;
      if(stalled>=2)throw Error(`Scan incomplete: source checks stopped making progress. ${data.result}`);
      showWork(`Checking all bills… ${data.discoveryRemaining} discovery candidates and ${data.textRemaining} known bill texts remain.`,true);
      scanError('');continuing=true;
      await new Promise(resolve=>setTimeout(resolve,21000));
    }
  } catch (error) {
    scanError(error.message || 'Could not check the official sources.');
    showWork('');
  } finally {
    updateButton.disabled = false;
    updateButton.textContent = 'Update tracker';
  }
}
async function review(action,id,button) {
  if (button.disabled) return;
  const labels={approve:'Adding to tracker',remove:'Moving to Removed / not tracking',restore:'Adding back to tracker'};
  const original=button.textContent;
  const group=button.closest('.card-actions');
  if(group)for(const sibling of group.querySelectorAll('button'))sibling.disabled=true;
  button.disabled = true;
  button.textContent='Saving…';
  showWork(`${labels[action] || 'Saving'}: ${id}…`,true);
  scanError('');
  let saved=false;
  try {
    const response = await fetch('/api/tracker', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id})});
    const result = await readApiJson(response,'Could not save your decision.');
    saved=true;
    if(action==='restore')confirmedLocalRemovals.delete(id);
    if(action==='remove'){
      const record=pending.find(b=>b.id===id)||bills.find(b=>b.id===id);
      const removed=record?{id,subject:record.subject,status:record.status,date:record.date,decided_at:new Date().toISOString()}:null;
      if(removed)confirmedLocalRemovals.set(id,removed);
      pending=pending.filter(b=>b.id!==id);
      bills=bills.filter(b=>b.id!==id);
      if(removed&&!excludedBills.some(b=>b.id===id))excludedBills.unshift(removed);
      render();
    }
    const data=await getSaved();
    if(action==='remove'&&!data.excluded?.some(b=>b.id===id))throw Error(`${id} was not confirmed in Removed / not tracking. Reload and try again.`);
    if(['approve','restore'].includes(action)&&!data.bills?.some(b=>b.id===id))throw Error(`${id} was not confirmed in the tracker. Reload and try again.`);
    if (action === 'remove') render();
    scanError('');
    showWork(result.message || `${id} saved.`);
  } catch (error) {
    if(saved){
      if(action==='remove'){
        const record=pending.find(b=>b.id===id)||bills.find(b=>b.id===id);
        pending=pending.filter(b=>b.id!==id);
        bills=bills.filter(b=>b.id!==id);
        if(record&&!excludedBills.some(b=>b.id===id))excludedBills.unshift({id,subject:record.subject,status:record.status,date:record.date,decided_at:new Date().toISOString()});
      }else if(action==='approve'){
        const record=pending.find(b=>b.id===id);
        pending=pending.filter(b=>b.id!==id);
        if(record&&!bills.some(b=>b.id===id))bills.unshift({...hydrate(record),impactCategory:record.impactCategory||'Review Impacts'});
      }else if(action==='restore')excludedBills=excludedBills.filter(b=>b.id!==id);
      render();
      showWork(`${id} saved. The dashboard could not refresh all data; reload the page for the latest counts.`);
    }else{
      scanError(error.message || 'Could not save your decision.');
      showWork('');
    }
  } finally {
    button.textContent=original;
    button.disabled=false;
    if(group)for(const sibling of group.querySelectorAll('button'))sibling.disabled=false;
  }
}
function selectMetric(id){
  for (const button of document.querySelectorAll('.metric-button')) {
    const selected = button.id === id;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
  }
}
for (const [type,id] of [['all','show-all'],['chaptered','show-enacted'],['vetoed','show-vetoed'],['recent','show-recent'],['removed','show-removed']]) {
  document.getElementById(id).addEventListener('click', () => {
    summaryFilter = type;
    for(const checkbox of statusSelect.querySelectorAll('input[type="checkbox"]'))checkbox.checked=type!=='all'||!hiddenByDefault.has(checkbox.value);
    updateFilterLabel(statusSelect);
    selectMetric(id);
    render();
  });
}
document.getElementById('export-visible').addEventListener('click',exportCsv);
search.addEventListener('input',render);
for (const filter of [statusSelect,area,impactFilter]){
  updateFilterLabel(filter);
  filter.addEventListener('click',event=>{
    const action=event.target.closest('button[data-select]');
    if(!action)return;
    const checked=action.dataset.select==='all';
    for(const checkbox of filter.querySelectorAll('input[type="checkbox"]'))checkbox.checked=checked;
    filter.dispatchEvent(new Event('change'));
  });
  filter.addEventListener('change', () => {
    updateFilterLabel(filter);
  if (filter === statusSelect && summaryFilter !== 'all') {
    summaryFilter = 'all';
    selectMetric('show-all');
  }
  render();
  });
}
document.addEventListener('click',event=>{
  for(const filter of [statusSelect,area,impactFilter])if(filter.open&&!filter.contains(event.target))filter.open=false;
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape')for(const filter of [statusSelect,area,impactFilter])if(filter.open){filter.open=false;filter.querySelector('summary').focus();}
});
document.getElementById('select-all-removed').addEventListener('change',event=>{
  selectedRemoved.clear();
  if(event.target.checked)for(const b of excludedBills)selectedRemoved.add(b.id);
  for(const checkbox of document.querySelectorAll('[data-removed-id]'))checkbox.checked=selectedRemoved.has(checkbox.dataset.removedId);
  updateRemovalSelection();
});
document.getElementById('excluded-list').addEventListener('change',event=>{
  const checkbox=event.target.closest('[data-removed-id]');
  if(!checkbox)return;
  if(checkbox.checked)selectedRemoved.add(checkbox.dataset.removedId);else selectedRemoved.delete(checkbox.dataset.removedId);
  updateRemovalSelection();
});
const deleteDialog=document.getElementById('delete-dialog');
document.getElementById('delete-selected').addEventListener('click',()=>{
  if(!selectedRemoved.size)return;
  document.getElementById('delete-dialog-description').textContent=`Delete ${selectedRemoved.size} selected bill${selectedRemoved.size===1?'':'s'} from the dashboard?`;
  deleteDialog.showModal();
});
document.getElementById('cancel-delete').addEventListener('click',()=>deleteDialog.close());
document.getElementById('confirm-delete').addEventListener('click',async()=>{
  const ids=[...selectedRemoved];
  const button=document.getElementById('confirm-delete');
  button.disabled=true;
  button.textContent='Deleting…';
  showWork(`Permanently deleting ${ids.length} bill${ids.length===1?'':'s'}…`,true);
  scanError('');
  try{
    const response=await fetch('/api/tracker',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'deleteExcluded',ids})});
    const result=await readApiJson(response,'Could not permanently delete the selected bills.');
    deleteDialog.close();
    for(const id of ids)selectedRemoved.delete(id);
    excludedBills=excludedBills.filter(b=>!ids.includes(b.id));
    render();
    try{await getSaved();showWork(result.message);}catch{showWork(`${result.message} Reload the page for the latest counts.`);}
  }catch(error){scanError(error.message||'Could not permanently delete the selected bills.');showWork('');}
  finally{button.disabled=false;button.textContent='Delete permanently';}
});
document.addEventListener('click',event=>{
  const edit=event.target.closest('button[data-edit-field]');
  if(edit){
    const id=edit.dataset.id,field=edit.dataset.editField;
    const bill=bills.find(b=>b.id===id)||pending.find(b=>b.id===id);
    if(!bill)return;
    const cell=edit.closest('.card-block');
    edit.hidden=true;
    cell.querySelector('.card-copy').hidden=true;
    const labels={summary:'Bill summary',impact:'County impact',action:'Recommended action'};
    const value=field==='summary'?billSummary(bill):bill[field];
    let draft=value;
    try{draft=sessionStorage.getItem(`tracker-edit-${field}-${id}`)||value;}catch{}
    const form=document.createElement('form');
    form.className='action-editor';
    form.dataset.actionId=id;
    form.dataset.field=field;
    form.noValidate=true;
    form.innerHTML=`<label for="edit-${esc(field)}-${esc(id.replace(' ',''))}">${labels[field]} for ${esc(id)}</label><textarea id="edit-${esc(field)}-${esc(id.replace(' ',''))}" name="text" maxlength="${field==='summary'?4000:1200}">${esc(draft)}</textarea><p class="edit-error" role="alert" hidden></p><div class="editor-buttons"><button type="submit">Save</button><button type="button" data-cancel-action>Cancel</button></div>`;
    cell.append(form);
    form.querySelector('textarea').focus();
    return;
  }
  const cancel=event.target.closest('button[data-cancel-action]');
  if(cancel){
    const cell=cancel.closest('.card-block');
    const form=cancel.closest('form');
    try{sessionStorage.removeItem(`tracker-edit-${form.dataset.field}-${form.dataset.actionId}`);}catch{}
    form.remove();
    cell.querySelector('.card-copy').hidden=false;
    cell.querySelector('.edit-action').hidden=false;
    render();
  }
});
document.addEventListener('input',event=>{
  const form=event.target.closest('form[data-action-id]');
  if(form&&event.target.matches('textarea'))try{sessionStorage.setItem(`tracker-edit-${form.dataset.field}-${form.dataset.actionId}`,event.target.value);}catch{}
});
document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-action-id]');
  if(!form)return;
  event.preventDefault();
  const id=form.dataset.actionId,field=form.dataset.field;
  const labels={summary:'Bill summary',impact:'County impact',action:'Recommended action'};
  const actionNames={summary:'setSummary',impact:'setImpactText',action:'setAction'};
  const value=form.querySelector('textarea').value.trim();
  const errorLine=form.querySelector('.edit-error');
  const limit=field==='summary'?4000:1200;
  if(!value||value.length>limit){
    errorLine.textContent=!value?'Enter text before saving.':`Limit this text to ${limit.toLocaleString()} characters.`;
    errorLine.hidden=false;
    return;
  }
  errorLine.hidden=true;
  form.dataset.submitting='true';
  const button=form.querySelector('button[type=submit]');
  button.disabled=true;
  button.textContent='Saving…';
  showWork(`Saving ${labels[field].toLowerCase()} for ${id}…`,true);
  scanError('');
  let saved=false;
  try{
    let result;
    for(let attempt=0;attempt<2;attempt++){
      try{
        const response=await fetch('/api/tracker',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:actionNames[field],id,text:value})});
        result=await readApiJson(response,`Could not save ${labels[field].toLowerCase()}.`);
        break;
      }catch(error){
        if(attempt||!String(error.message).includes('HTML page instead of tracker data'))throw error;
      }
    }
    saved=true;
    try{sessionStorage.removeItem(`tracker-edit-${field}-${id}`);}catch{}
    await getSaved();
    showWork(result.message);
  }catch(error){
    if(saved){
      const bill=bills.find(b=>b.id===id)||pending.find(b=>b.id===id);
      if(bill){
        if(field==='summary'){bill.summaryOverride={text:value,status:bill.status,date:bill.date};bill.summaryNeedsReview=false;}
        else{bill[field]=value;bill[`${field}NeedsReview`]=false;}
      }
      const target=field==='summary'?savedSummaries:field==='impact'?savedImpactText:savedActions;
      target[id]={text:value,status:bill?.status,date:bill?.date};
      render();
      showWork(`${labels[field]} saved for ${id}. Reload the page if other data has not refreshed.`);
    }else{
      scanError(error.message||`Could not save ${labels[field].toLowerCase()}.`);
      if(form.isConnected){errorLine.textContent=error.message||'Could not save this edit.';errorLine.hidden=false;delete form.dataset.submitting;}
      showWork('');
      button.disabled=false;
      button.textContent='Save';
    }
  }
});
document.addEventListener('click',event => {
  const button = event.target.closest('button[data-action][data-id]');
  if (button) review(button.dataset.action,button.dataset.id,button);
});
document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-landuse-id]');
  if(!form)return;
  event.preventDefault();
  const id=form.dataset.landuseId;
  const groups=event.submitter?.dataset.auto?null:[...form.querySelectorAll('input[type="checkbox"]:checked')].map(input=>input.value);
  if(groups&&groups.length===0){showWork('Select at least one category.');return;}
  const button=event.submitter||form.querySelector('button[type="submit"]');
  button.disabled=true;
  showWork(`Saving land use groups for ${id}…`,true);
  try{
    const response=await fetch('/api/tracker',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'setLandUses',id,groups})});
    const result=await readApiJson(response,'Could not save the land use groups.');
    await getSaved();
    showWork(result.message);
  }catch(error){scanError(error.message||'Could not save land use groups.');showWork('');button.disabled=false;}
});
document.addEventListener('change',async event => {
  const select = event.target.closest('select[data-impact-id]');
  if (!select) return;
  select.disabled = true;
  showWork(`Saving County impact for ${select.dataset.impactId}…`,true);
  try {
    const response = await fetch('/api/tracker',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'setImpact',id:select.dataset.impactId,category:select.value})});
    await readApiJson(response,'Could not save the impact category.');
    await getSaved();
    scanError('');
    showWork(`County impact saved for ${select.dataset.impactId}.`);
  } catch (error) {
    scanError(error.message || 'Could not save the impact category.');
    showWork('');
    await getSaved().catch(() => { select.disabled = false; });
  }
});
updateButton.addEventListener('click',update);
render();
load();
