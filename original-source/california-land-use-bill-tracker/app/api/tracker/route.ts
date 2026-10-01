import { env } from "cloudflare:workers";
import teamBills from "../../../public/team-bills.json";
import audit from "../../../public/audited-summaries.json";

export const runtime = "edge";

const BASE = "https://leginfo.legislature.ca.gov/faces/";
const SESSION = "202520260";
const SESSION_LABEL = "2025–2026";
// Search the official topic and Legislative Counsel's digest, not only the bill title.
// Broad matches go to staff review; they do not become enacted County requirements.
const RELEVANT = /(?:housing development|housing element|housing project|affordable housing|housing production|housing approval|housing accountability|regional housing needs|\bRHNA\b|residential development|accessory dwelling|\bADU\b|junior accessory|density bonus|lot split|zoning|general plan|specific plan|environmental quality|\bCEQA\b|environmental justice|land use|planning|subdivision|parcel map|permitting|permit streamlin|public notic|public hearing|farmland|williamson|agricultural land|conservation easement|water supply|groundwater|sewer|septic|wastewater|service area|local government|county authority|board of supervisors|planning commission|annexation|\bLAFCO\b|short.term rental|data center|industrial facilit|warehouse|distribution center|infrastructure|development impact fee|mitigation fee|wildfire|fire hazard|floodplain|flood hazard|tribal consultation|solar facilit|battery storage|energy facilit|transportation planning|roadway)/i;
const CONTEXTUAL = /\b(?:local agency|local government|county|counties|city|cities|municipal|development project)\b/i;
const PLANNING_CHANGE = /(?:building standards?|building codes?|building permits?|land division|public hearing|planning commission|historic resource|open space|utility infrastructure|road access|California Public Records Act)/i;
const INITIAL = ["AB1577", "SB887", "SB594", "SB954", "SB1272"];
const TEAM_IDS: string[] = teamBills.map(b => b.id.replace(" ", ""));
const SEARCH_TERMS = ["accessory dwelling","housing element","density bonus","general plan","zoning","CEQA","environmental justice","permit streamlining","public notice","Williamson Act","farmland","water supply","sewer","annexation","development impact fee","wildfire","fire hazard","floodplain","data center","warehouse","parcel map","infrastructure","service area","tribal consultation"];
const IMPACT_CATEGORIES = ["Review Impacts","Development Code Update","General Plan Update","Procedure Update","No Changes Required","Monitor / FYI"];
const LAND_USES = ["Residential","Commercial","Industrial","Agricultural","Other / Cross-cutting"];
// A historical spreadsheet entry is a lead, never evidence that the current bill still concerns Planning.
const DIRECT_PLANNING = /(?:housing element|housing development|housing project|housing approvals?|housing accountability|housing density|affordable housing|accessory dwelling|junior accessory|\bADU\b|density bonus|zoning|general plan|specific plan|environmental quality|\bCEQA\b|environmental justice|land use|planning and zoning|subdivision|parcel map|permit streamlin|building permits?|public notic|public hearing|farmland|williamson|agricultural land|water supply|groundwater|sewer|septic|wastewater|service area|local government|local agencies|county authority|planning commission|annexation|\bLAFCO\b|short.term rental|data center|industrial facilit|warehouse|infrastructure|development impact fee|mitigation fee|fire hazard|defensible space|floodplain|tribal consultation|solar facilit|battery storage|transportation planning|surplus land|historic resource|building standards|wildfire prevention|wildfire safety)/i;
const UNRELATED_TITLE = /(?:\belections?\b|\bmental health\b|colorectal cancer|health care coverage|health facilities|\bmedi.cal\b|\bcalfresh\b|\bcalworks\b|school districts?: reorganization|\bbudget acts?\b|^residential property insurance|^real property tax|^transfer taxes|\bhousing support services\b|\breentry housing and workforce\b|^business: retail food|^solid waste: plastic microbeads|^public contracts: best value procurement: community college|^food vendors and facilities: enforcement)/i;
// Learned from staff removals: a mention of housing, water, a county, or
// public notice alone is not a Planning duty. Apply this only to discovery.
const OUTSIDE_PLANNING_TITLE = /(?:common interest developments?|mobilehome residency law|property insurance|^insurance:|ratepayer|water rate assistance|water charges|mutual water companies|balancing accounts|interconnection: public utilities|low.income housing tax credit|housing authorities: term limits|housing risk reduction|state and local public benefits|domestic violence|criminal procedure|peace officers|public defenders?|health care services|alcohol and drug programs|pupils:|behested payments|teleconnect fund|interior designers|fireworks licenses|housing program|homekey|climate resiliency: research farms|transportation.*incentives|forest.*fund act|electricity\.?$|^energy:|^electrical corporations:|pipeline safety)/i;
const OTHER_JURISDICTION_TITLE = /(?:cities of Pasadena and South Pasadena|city and county of San Francisco|county of Riverside|city of Santa Monica|Santa Clara Valley Transportation Authority)/i;
const PLANNING_NEXUS = /(?:planning and zoning|zoning|general plan|housing element|\bRHNA\b|accessory dwelling|junior accessory|\bADUs?\b|density bonus|subdivision|parcel maps?|lot splits?|land use|development (?:project )?(?:approvals?|permits?|standards?|review)|building permits?|housing accountability|permit streamlining|California Environmental Quality Act|\bCEQA\b|environmental impact reports?|lead agenc(?:y|ies)|tribal consultation|Williamson Act|farmland|agricultural conservation|Joshua Tree|public notic|publication: newspapers|sewer|septic|water supply|service areas?|fire hazard|floodplain|defensible space)/i;
const LOCAL_PLANNING_DUTY = /(?:local agenc(?:y|ies)|local government|count(?:y|ies)|cit(?:y|ies)|planning commission)[^.]{0,400}(?:zoning|general plan|housing element|permit|land use|development approval|environmental review|CEQA)|(?:zoning|general plan|housing element|land use|development approval|environmental review|CEQA)[^.]{0,400}(?:local agenc(?:y|ies)|count(?:y|ies)|cit(?:y|ies))/i;
function discoveryRelevant(subject:string,digest:string){
  if(OTHER_JURISDICTION_TITLE.test(subject)&&!/San Bernardino/i.test(subject))return false;
  // Inspect what the bill changes, not the digest's recital of existing law.
  const changes=(digest.match(/(?:This|The) bill would[\s\S]*?(?=Existing law|The California Constitution|(?:This|The) bill would|$)/gi)||[]).join(' ');
  if(OUTSIDE_PLANNING_TITLE.test(subject)||UNRELATED_TITLE.test(subject))return LOCAL_PLANNING_DUTY.test(changes)&&PLANNING_NEXUS.test(changes);
  return PLANNING_NEXUS.test(subject)||PLANNING_NEXUS.test(changes)||LOCAL_PLANNING_DUTY.test(changes);
}
function relevantTitle(subject:string){return !UNRELATED_TITLE.test(subject);}
function matchesCurrentSession(b:Bill){return b.url===officialUrl(b.id,"billStatusClient") && (b.billText||b.bill_text)===officialUrl(b.id,"billTextClient");}
function displayBills(rows:Bill[],approved:Set<string>,relevance:Record<string,{subject:string;relevant:boolean}>){return rows.filter(b=>{
  if(!matchesCurrentSession(b))return false;
  if(approved.has(b.id))return true;
  const assessment=relevance[b.id];
  return assessment?.subject===b.subject?assessment.relevant:relevantTitle(b.subject);
});}
async function relevanceRecords(db:ReturnType<typeof database>){
  const rows=await db.prepare("SELECT id,result FROM scan_state WHERE id LIKE 'relevance\\_%' ESCAPE '\\'").all<{id:string;result:string}>();
  return Object.fromEntries((rows.results||[]).flatMap(row=>{try{const value=JSON.parse(row.result);return typeof value.subject==='string'&&typeof value.relevant==='boolean'?[[row.id.slice(10).replace(/^(AB|SB)/,'$1 '),value]]:[]}catch{return []}})) as Record<string,{subject:string;relevant:boolean}>;
}
async function approvedIds(db:ReturnType<typeof database>){const rows=await db.prepare("SELECT id FROM bill_decisions WHERE decision='approved'").all<{id:string}>();return new Set((rows.results||[]).map(row=>row.id));}

type Bill = {id:string;subject:string;status:string;date:string;chapter:string;impact:string;action:string;url:string;billText:string;bill_text?:string;checkedAt:string};
function canonicalStatus(status:string){return ({Pending:"Active Bill",Inactive:"Inactive Bill",Enacted:"Chaptered",Signed:"Approved by Governor"} as Record<string,string>)[status]||status;}
function canonicalBill<T extends {status:string}>(bill:T):T{return {...bill,status:canonicalStatus(bill.status)};}

function textOf(html:string) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ").trim();
}
function currentDigestText(html:string){
  return textOf(html.replace(/<(?:strike|del|s)\b[^>]*>[\s\S]*?<\/(?:strike|del|s)>/gi,' '));
}
const AB1577_LOCAL_SUMMARY='For a discretionary data center permit, entitlement, or land use authorization, the owner or operator must give the city or county with permitting authority estimates of annual energy consumption, onsite electricity generation, and operating sound levels. The local agency may use the information for land use and infrastructure planning, energy supply assessment, and environmental review. Separate operating reports go to the California Energy Commission.';
function plainDigestSentence(sentence:string){
  return sentence
    .replace(/^\s*(?:This|The) bill would\b/i,'Would')
    .replace(/,?\s+as (?:defined|specified|provided)(?=\s*[,.;])/gi,'')
    .replace(/,?\s+among other (?:information|things)(?=\s*[,.;])/gi,'')
    .replace(/,?\s+including,?\s+but not limited to,?/gi,', including')
    .replace(/\b(?:specified|certain) information\b/gi,'information')
    .replace(/\bvarious purposes,?\s+including\b/gi,'planning purposes, including')
    .replace(/,\s*,/g,',')
    .replace(/\s+([,.;])/g,'$1')
    .trim();
}
function digestSummary(html:string){
  const plain=currentDigestText(html);
  const digest=(plain.split(/LEGISLATIVE COUNSEL['’]S DIGEST/i)[1]||plain).split(/\bVote:\s*(?:majority|2\/3)/i)[0];
  const start=digest.search(/\bThis bill\b/i);
  if(start<0)return null;
  const passage=digest.slice(start).replace(/\s+/g,' ');
  const sentences=[...passage.matchAll(/[^.!?]+[.!?](?=\s|$)/g)].map(match=>plainDigestSentence(match[0]));
  // Keep the bill's operative change first, then add a local-government duty
  // when the digest has one. Boilerplate is excluded above.
  const substantive=sentences.filter(sentence=>!/\b(?:state-mandated local program|matter of statewide concern|reimbursement is required|no reimbursement is required|nonsubstantive changes|make related findings|incorporate additional changes)\b/i.test(sentence));
  const local=substantive.filter(sentence=>/\b(?:local agenc(?:y|ies)|local government|cit(?:y|ies)|count(?:y|ies)|planning department|land use authorizations?|zoning|general plan|discretionary permits?|housing element|county planning)\b/i.test(sentence));
  const ordered=substantive.length?[substantive[0],...local.slice(0,2),...substantive.slice(1)]:[];
  let summary='';
  let count=0;
  for(const sentence of ordered){
    if(summary.includes(sentence)||summary.length+sentence.length+1>850)continue;
    summary+=(summary?' ':'')+sentence;
    if(++count===2)break;
  }
  return (summary||plainDigestSentence(passage.slice(0,850))).trim();
}
function auditedSummary(id:string,version?:{changedAt?:string|null}){
  if(version?.changedAt&&Date.parse(version.changedAt)>Date.parse(audit.auditedAt))return null;
  return (audit.summaries as Record<string,string>)[id]||null;
}
function dateOf(raw:string) { const m=raw.match(/(\d{2})\/(\d{2})\/(\d{2})/); return m?`20${m[3]}-${m[1]}-${m[2]}`:""; }
function statusFrom(plain:string) {
  const section=plain.split("Last 5 History Actions")[1]||plain.split("Date Action")[1]||"";
  const actions=[...section.slice(0,1800).matchAll(/(\d{2}\/\d{2}\/\d{2})\s+(.{1,180}?)(?=\d{2}\/\d{2}\/\d{2}|$)/gi)];
  const match=actions.find(m=>/chaptered by secretary of state|vetoed by the governor|approved by the governor/i.test(m[2]))||actions[0];
  if(!match)return null;
  const action=match[2].toLowerCase();
  const status=action.includes("chaptered")?"Chaptered":action.includes("approved by the governor")?"Approved by Governor":action.includes("vetoed")?"Vetoed":action.includes("enrolled")?"Enrolled":action.includes("amend")?"Amended":/inactive bill|failed passage/i.test(plain)?"Inactive Bill":"Active Bill";
  return {status,date:dateOf(match[1]),chapter:status==="Chaptered"?(plain.match(/Chapter\s+(\d+),\s*Statutes of 202[56]/i)?.[1]||""):""};
}
async function getOfficial(path:string){
  const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),11000);
  try {const r=await fetch(BASE+path,{signal:controller.signal,headers:{"Accept":"text/html"}});if(!r.ok)throw new Error(`Source returned HTTP ${r.status}`);const body=await r.text();if(!body.includes("Bill")||body.length<250)throw new Error("Source returned an unreadable page");return body;}finally{clearTimeout(timeout)}
}
function officialUrl(id:string,kind:"billStatusClient"|"billTextClient") {return `${BASE}${kind}.xhtml?bill_id=${SESSION}${id.replace(" ","")}`;}
function impactFor(topic:string,status:string){
  const label=topic.replace(/\.$/,"");
  if(status==="Vetoed")return `The proposed changes to ${label.toLowerCase()} did not become law. Review any County workflow that was being prepared.`;
  return `Potential LUS Planning impact: ${label}. Review the official text for specific County duties, deadlines, and exemptions.`;
}
function actionFor(status:string,topic:string){
  if(status==="Vetoed"||status==="Inactive Bill")return "No LUS Planning implementation action; this bill did not become law.";
  const subject=topic.toLowerCase();
  if(/accessory dwelling|\badu\b|junior accessory/.test(subject))return "Check the proposed ADU rule against Development Code Chapter 84.36 and the ADU intake checklist; identify the precise County standard affected before recommending a change.";
  if(/density bonus/.test(subject))return "Compare the proposed density-bonus provision with Development Code Chapter 83.03 and the housing application checklist; record any conflicting County requirement.";
  if(/housing element|general plan/.test(subject))return "Check the affected Housing Element or Countywide Plan policy and reporting calendar; identify the required update and its deadline if the bill takes effect.";
  if(/environmental quality|\bceqa\b/.test(subject))return "Check the CEQA exemption and notice screening checklist for the proposed change; coordinate any new threshold or notice step with Environmental Review.";
  if(/subdivision|housing development|land use|zoning|permit/.test(subject))return "Compare the proposed rule with Development Code Title 8 and Chapter 85.03 application steps; document the specific conflict or deadline before changing County guidance.";
  return "County action pending bill-specific review; no Development Code, Countywide Plan, or LUS Planning change has been identified yet.";
}
async function readBill(id:string):Promise<Bill>{
  const html=await getOfficial(`billStatusClient.xhtml?bill_id=${SESSION}${id}`);
  const plain=textOf(html);
  if(!new RegExp(`\\b${id.slice(0,2)}[-\\s]*${id.slice(2)}\\b[\\s\\S]{0,250}\\(2025-2026\\)`,"i").test(plain))throw new Error(`${id}: official page did not confirm the 2025–2026 session`);
  const topic=plain.match(/Topic:\s*(.*?)\s*(?:31st Day in Print:|Title:)/i)?.[1]?.trim()||"";
  const parsed=statusFrom(plain);
  if(!topic||!parsed)throw new Error(`${id}: bill topic or dated action unavailable`);
  const billId=id.replace(/^(AB|SB)/,"$1 ");
  return {id:billId,subject:topic,status:parsed.status,date:parsed.date,chapter:parsed.chapter?`Ch. ${parsed.chapter}`:"",impact:impactFor(topic,parsed.status),action:actionFor(parsed.status,topic),url:officialUrl(id,"billStatusClient"),billText:officialUrl(id,"billTextClient"),checkedAt:new Date().toISOString()};
}
async function relevantNewBill(id:string,subject:string,html?:string){
  const plain=textOf(html||await getOfficial(`billTextClient.xhtml?bill_id=${SESSION}${id}`));
  const digest=(plain.split(/LEGISLATIVE COUNSEL['’]S DIGEST/i)[1]||plain).split(/\bVote:\s*(?:majority|2\/3)/i)[0];
  return discoveryRelevant(subject,digest);
}
function database(){if(!env.DB)throw new Error("Tracker storage is unavailable");return env.DB;}
const COLUMNS="id,subject,status,date,chapter,impact,action,url,bill_text,checked_at";
type ExcludedBill={id:string;subject:string;status:string;date:string;decided_at:string};
function excludedBills(db:ReturnType<typeof database>){return db.prepare("SELECT d.id,d.decided_at,COALESCE(t.subject,p.subject,'Bill details unavailable') AS subject,COALESCE(t.status,p.status,'Unknown') AS status,COALESCE(t.date,p.date,'') AS date,COALESCE(t.chapter,p.chapter,'') AS chapter,COALESCE(t.impact,p.impact,'') AS impact,COALESCE(t.action,p.action,'') AS action,COALESCE(t.url,p.url,'') AS url,COALESCE(t.bill_text,p.bill_text,'') AS bill_text,COALESCE(t.checked_at,p.checked_at,'') AS checked_at FROM bill_decisions d LEFT JOIN tracked_bills t ON t.id=d.id LEFT JOIN pending_bills p ON p.id=d.id WHERE d.decision='excluded' ORDER BY d.decided_at DESC,d.id").all<ExcludedBill>();}
async function impactCategories(db:ReturnType<typeof database>){const rows=await db.prepare("SELECT id,category FROM bill_impact_categories").all<{id:string;category:string}>();return Object.fromEntries((rows.results||[]).map(row=>[row.id,row.category]));}
async function textOverrides(db:ReturnType<typeof database>,prefix:'action'|'summary'|'impact'){
  const rows=await db.prepare("SELECT id,checked_at,result FROM scan_state WHERE id LIKE ? ESCAPE '\\'").bind(`${prefix}\\_%`).all<{id:string;checked_at:string;result:string}>();
  return Object.fromEntries((rows.results||[]).flatMap(row=>{try{const value=JSON.parse(row.result);return typeof value.text==='string'?[[row.id.slice(prefix.length+1).replace(/^(AB|SB)/,'$1 '),{...value,editedAt:row.checked_at}]]:[]}catch{return []}}));
}
async function correctSavedAB1577Summary(db:ReturnType<typeof database>){
  const row=await db.prepare("SELECT result FROM scan_state WHERE id='summary_AB1577'").first<{result:string}>();
  if(!row)return;
  try{
    const saved=JSON.parse(row.result);
    // Replace only the old, unedited digest copy. Preserve any later user rewrite.
    if(typeof saved.text!=='string'||!saved.text.startsWith('The bill would require the owner or operator of a data center, upon applying for a discretionary permit')||!saved.text.includes('including, among other information,'))return;
    await db.prepare("UPDATE scan_state SET result=?,checked_at=? WHERE id='summary_AB1577' AND result=?")
      .bind(JSON.stringify({...saved,text:AB1577_LOCAL_SUMMARY}),new Date().toISOString(),row.result).run();
  }catch{return;}
}
async function textVersions(db:ReturnType<typeof database>){
  const rows=await db.prepare("SELECT id,result FROM scan_state WHERE id LIKE 'textver\\_%' ESCAPE '\\'").all<{id:string;result:string}>();
  return Object.fromEntries((rows.results||[]).flatMap(row=>{try{const value=JSON.parse(row.result);return typeof value.hash==='string'?[[row.id.slice(8).replace(/^(AB|SB)/,'$1 '),value]]:[]}catch{return []}}));
}
async function landUseOverrides(db:ReturnType<typeof database>){
  const rows=await db.prepare("SELECT id,result FROM scan_state WHERE id LIKE 'landuse\\_%' ESCAPE '\\'").all<{id:string;result:string}>();
  return Object.fromEntries((rows.results||[]).flatMap(row=>{try{
    const value=JSON.parse(row.result);
    return Array.isArray(value.groups)&&value.groups.every((group:unknown)=>LAND_USES.includes(String(group)))?[[row.id.slice(8).replace(/^(AB|SB)/,'$1 '),value]]:[];
  }catch{return []}}));
}
async function textHash(html:string){
  const normalized=textOf(html).replace(/\s+/g,' ').trim();
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalized));
  return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function saveBill(db:ReturnType<typeof database>,table:"tracked_bills"|"pending_bills",b:Bill){
  const pendingGuard=table==="pending_bills"?" AND NOT EXISTS (SELECT 1 FROM tracked_bills WHERE id=?)":"";
  return db.prepare(`INSERT INTO ${table} (${COLUMNS}) SELECT ?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM bill_decisions WHERE id=? AND decision IN ('excluded','deleted'))${pendingGuard} ON CONFLICT(id) DO UPDATE SET subject=excluded.subject,status=excluded.status,date=excluded.date,chapter=excluded.chapter,url=excluded.url,bill_text=excluded.bill_text,checked_at=excluded.checked_at WHERE NOT EXISTS (SELECT 1 FROM bill_decisions WHERE id=excluded.id AND decision IN ('excluded','deleted'))${pendingGuard.replace('id=?','id=excluded.id')}`).bind(b.id,b.subject,b.status,b.date,b.chapter,b.impact,b.action,b.url,b.billText,b.checkedAt,b.id,...(table==="pending_bills"?[b.id]:[]));
}

export async function GET(request:Request){
  try{
    const db=database();
    const lock=await db.prepare("SELECT result FROM scan_state WHERE id='bill_session'").first<{result:string}>();
    if(lock && lock.result!==SESSION)return Response.json({error:'The legislative session changed. Bill records need a session migration before this tracker can display them.'},{status:409});
    const summaryId=new URL(request.url).searchParams.get('summary');
    if(summaryId!==null){
      if(!/^(AB|SB) \d{1,4}$/.test(summaryId))return Response.json({error:'Invalid bill number.'},{status:400});
      const active=await db.prepare("SELECT id FROM tracked_bills WHERE id=? UNION SELECT id FROM pending_bills WHERE id=?").bind(summaryId,summaryId).first();
      const blocked=await db.prepare("SELECT id FROM bill_decisions WHERE id=? AND decision IN ('excluded','deleted')").bind(summaryId).first();
      if(!active||blocked)return Response.json({error:'Bill is no longer in the tracker.'},{status:404});
      const versionRow=await db.prepare("SELECT result FROM scan_state WHERE id=?").bind(`textver_${summaryId.replace(' ','')}`).first<{result:string}>();
      let version:{changedAt?:string|null}|undefined;
      try{version=versionRow?.result?JSON.parse(versionRow.result):undefined}catch{}
      const reviewed=auditedSummary(summaryId,version);
      if(reviewed)return Response.json({summary:reviewed});
      const key=`digest_local_v5_${summaryId.replace(' ','')}`;
      const cached=await db.prepare('SELECT result FROM scan_state WHERE id=?').bind(key).first<{result:string}>();
      if(cached?.result)return Response.json({summary:cached.result});
      const html=await getOfficial(`billTextClient.xhtml?bill_id=${SESSION}${summaryId.replace(' ','')}`);
      const summary=digestSummary(html);
      if(summary)await db.prepare("INSERT INTO scan_state (id,checked_at,result) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at,result=excluded.result").bind(key,new Date().toISOString(),summary).run();
      return Response.json({summary:summary||'Read the official Legislative Counsel digest for a description of this bill.'});
    }
    await correctSavedAB1577Summary(db);
    const [rows,pending,excluded,state,categories,actions,summaries,impacts,approved,relevance,versions,landUses]=await Promise.all([db.prepare("SELECT * FROM tracked_bills WHERE id NOT IN (SELECT id FROM bill_decisions WHERE decision IN ('excluded','deleted')) ORDER BY date DESC,id").all<Bill>(),db.prepare("SELECT * FROM pending_bills WHERE id NOT IN (SELECT id FROM bill_decisions WHERE decision IN ('excluded','deleted')) ORDER BY date DESC,id").all<Bill>(),excludedBills(db),db.prepare("SELECT checked_at, result FROM scan_state WHERE id = 'latest'").first<{checked_at:string;result:string}>(),impactCategories(db),textOverrides(db,'action'),textOverrides(db,'summary'),textOverrides(db,'impact'),approvedIds(db),relevanceRecords(db),textVersions(db),landUseOverrides(db)]);
    const currentSummaries=Object.fromEntries(Object.entries(summaries).filter(([,value])=>Date.parse(value.editedAt)>Date.parse(audit.auditedAt)));
    const reviewed=Object.fromEntries(Object.entries(audit.summaries).filter(([id])=>auditedSummary(id,versions[id.replace(/^(AB|SB)/,'$1 ')])));
    return Response.json({bills:displayBills(rows.results||[],approved,relevance).map(canonicalBill),pending:displayBills(pending.results||[],approved,relevance).map(canonicalBill),excluded:(excluded.results||[]).map(canonicalBill),impactCategories:categories,actionOverrides:actions,summaryOverrides:currentSummaries,auditedSummaries:reviewed,impactOverrides:impacts,textVersions:versions,landUseOverrides:landUses,checkedAt:state?.checked_at||null,result:state?.result||null,session:SESSION_LABEL});}
  catch{return Response.json({error:"The saved tracker is temporarily unavailable."},{status:503})}
}

export async function POST(request:Request){
  if(new URL(request.url).origin!==request.headers.get("origin"))return Response.json({error:"Please update from the dashboard."},{status:403});
  try{
    const db=database();const now=new Date().toISOString();
    const lock=await db.prepare("SELECT result FROM scan_state WHERE id='bill_session'").first<{result:string}>();
    if(lock && lock.result!==SESSION)return Response.json({error:'The legislative session changed. Bill records need a session migration before updates can continue.'},{status:409});
    const input=await request.json().catch(()=>({})) as {action?:string;id?:string;ids?:string[];category?:string;text?:string;groups?:string[]|null;continueScan?:boolean};
    if(input.action==='deleteExcluded'){
      const ids=input.ids;
      if(!Array.isArray(ids)||!ids.length||ids.length>500||new Set(ids).size!==ids.length||!ids.every(id=>typeof id==='string'&&/^(AB|SB) \d{1,4}$/.test(id)))return Response.json({error:'Select valid removed bills to delete.'},{status:400});
      const slots=ids.map(()=>'?').join(',');
      const existing=await db.prepare(`SELECT id FROM bill_decisions WHERE decision='excluded' AND id IN (${slots})`).bind(...ids).all<{id:string}>();
      if((existing.results||[]).length!==ids.length)return Response.json({error:'One or more selected bills are no longer in Removed / not tracking. Reload and try again.'},{status:409});
      await db.batch([
        db.prepare(`UPDATE bill_decisions SET decision='deleted',decided_at=? WHERE decision='excluded' AND id IN (${slots})`).bind(now,...ids),
        db.prepare(`DELETE FROM tracked_bills WHERE id IN (${slots})`).bind(...ids),
        db.prepare(`DELETE FROM pending_bills WHERE id IN (${slots})`).bind(...ids),
        db.prepare(`DELETE FROM bill_impact_categories WHERE id IN (${slots})`).bind(...ids),
        db.prepare(`DELETE FROM scan_state WHERE id IN (${slots})`).bind(...ids.map(id=>`digest_local_v4_${id.replace(' ','')}`)),
        db.prepare(`DELETE FROM scan_state WHERE id IN (${slots})`).bind(...ids.map(id=>`action_${id.replace(' ','')}`)),
        db.prepare(`DELETE FROM scan_state WHERE id IN (${slots})`).bind(...ids.map(id=>`summary_${id.replace(' ','')}`)),
        db.prepare(`DELETE FROM scan_state WHERE id IN (${slots})`).bind(...ids.map(id=>`impact_${id.replace(' ','')}`))
      ]);
      return Response.json({ok:true,deleted:ids,message:`Permanently deleted ${ids.length} bill${ids.length===1?'':'s'} from the dashboard. Future scans will skip them.`});
    }
    if(input.action){
      if(!/^(AB|SB) \d{1,4}$/.test(input.id||""))return Response.json({error:"Select a valid bill."},{status:400});
      const id=input.id!;
      if(input.action==='setLandUses'){
        const groups=input.groups;
        if(groups!==null&&(!Array.isArray(groups)||groups.length>LAND_USES.length||new Set(groups).size!==groups.length||!groups.every(group=>LAND_USES.includes(group))))return Response.json({error:'Select valid subject categories.'},{status:400});
        const active=await db.prepare("SELECT id FROM tracked_bills WHERE id=? UNION SELECT id FROM pending_bills WHERE id=?").bind(id,id).first();
        if(!active)return Response.json({error:'This bill is not in the active tracker or review list.'},{status:404});
        if(groups===null){
          await db.prepare("DELETE FROM scan_state WHERE id=?").bind(`landuse_${id.replace(' ','')}`).run();
          return Response.json({ok:true,message:`Automatic land use grouping restored for ${id}.`});
        }
        const version=await db.prepare("SELECT result FROM scan_state WHERE id=?").bind(`textver_${id.replace(' ','')}`).first<{result:string}>();
        let hash:string|null=null;
        try{hash=JSON.parse(version?.result||'{}').hash||null;}catch{/* No saved version yet. */}
        await db.prepare("INSERT INTO scan_state (id,checked_at,result) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at,result=excluded.result").bind(`landuse_${id.replace(' ','')}`,now,JSON.stringify({groups,hash})).run();
        return Response.json({ok:true,message:`Land use groups saved for ${id}.`});
      }
      if(['setAction','setSummary','setImpactText'].includes(input.action)){
        const value=typeof input.text==='string'?input.text.trim():'';
        const limit=input.action==='setSummary'?4000:1200;
        if(!value||value.length>limit)return Response.json({error:`Enter text of up to ${limit.toLocaleString()} characters.`},{status:400});
        const bill=await db.prepare("SELECT id,status,date FROM tracked_bills WHERE id=? UNION SELECT id,status,date FROM pending_bills WHERE id=?").bind(id,id).first<{id:string;status:string;date:string}>();
        const blocked=await db.prepare("SELECT id FROM bill_decisions WHERE id=? AND decision IN ('excluded','deleted')").bind(id).first();
        if(!bill||blocked)return Response.json({error:'This bill is not in the active tracker or review list.'},{status:404});
        const field=input.action==='setSummary'?'summary':input.action==='setImpactText'?'impact':'action';
        await db.prepare("INSERT INTO scan_state (id,checked_at,result) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at,result=excluded.result").bind(`${field}_${id.replace(' ','')}`,now,JSON.stringify({text:value,status:bill.status,date:bill.date})).run();
        return Response.json({ok:true,message:`${field==='summary'?'Bill summary':field==='impact'?'County impact':'Recommended action'} saved for ${id}.`});
      }
      if(input.action==="setImpact"){
        if(!IMPACT_CATEGORIES.includes(input.category||""))return Response.json({error:"Select a valid impact category."},{status:400});
        const existing=await db.prepare("SELECT id FROM tracked_bills WHERE id=? UNION SELECT id FROM pending_bills WHERE id=?").bind(id,id).first();
        if(!existing)return Response.json({error:"This bill is not in the active tracker."},{status:404});
        await db.prepare("INSERT INTO bill_impact_categories (id,category,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET category=excluded.category,updated_at=excluded.updated_at").bind(id,input.category,now).run();
        return Response.json({ok:true});
      }
      if(input.action==="approve"){
        const pending=await db.prepare("SELECT * FROM pending_bills WHERE id=?").bind(id).first<Bill>();
        if(!pending)return Response.json({error:"This bill is no longer awaiting review."},{status:404});
        const excluded=await db.prepare("SELECT id FROM bill_decisions WHERE id=? AND decision IN ('excluded','deleted')").bind(id).first();
        if(excluded)return Response.json({error:"This bill was removed from the tracker."},{status:409});
        await db.batch([db.prepare(`INSERT INTO tracked_bills (${COLUMNS}) SELECT ${COLUMNS} FROM pending_bills WHERE id=? AND NOT EXISTS (SELECT 1 FROM bill_decisions WHERE id=? AND decision IN ('excluded','deleted'))`).bind(id,id),db.prepare("INSERT INTO bill_decisions (id,decision,decided_at) SELECT id,'approved',? FROM tracked_bills WHERE id=? AND NOT EXISTS (SELECT 1 FROM bill_decisions WHERE id=? AND decision IN ('excluded','deleted')) ON CONFLICT(id) DO UPDATE SET decision='approved',decided_at=excluded.decided_at WHERE bill_decisions.decision NOT IN ('excluded','deleted')").bind(now,id,id),db.prepare("DELETE FROM pending_bills WHERE id=?").bind(id)]);
        return Response.json({ok:true,message:`${id} added to the tracker.`});
      }
      if(input.action==="remove"){
        const prior=await db.prepare("SELECT decision FROM bill_decisions WHERE id=?").bind(id).first<{decision:string}>();
        if(prior?.decision==='excluded')return Response.json({ok:true,message:`${id} is already in Removed / not tracking.`});
        if(prior?.decision==='deleted')return Response.json({error:"This bill was permanently deleted."},{status:409});
        const existing=await db.prepare("SELECT id FROM tracked_bills WHERE id=? UNION SELECT id FROM pending_bills WHERE id=?").bind(id,id).first();
        if(!existing)return Response.json({error:"This bill is not in the tracker or review list."},{status:404});
        await db.prepare("INSERT INTO bill_decisions (id,decision,decided_at) VALUES (?,'excluded',?) ON CONFLICT(id) DO UPDATE SET decision='excluded',decided_at=excluded.decided_at WHERE bill_decisions.decision!='deleted'").bind(id,now).run();
        return Response.json({ok:true,message:`${id} moved to Removed / not tracking. Future scans will skip it.`});
      }
      if(input.action==="restore"){
        const excluded=await db.prepare("SELECT id FROM bill_decisions WHERE id=? AND decision='excluded'").bind(id).first();
        if(!excluded)return Response.json({error:"This bill is not in Removed / not tracking."},{status:404});
        const existing=await db.prepare("SELECT id FROM tracked_bills WHERE id=? UNION SELECT id FROM pending_bills WHERE id=?").bind(id,id).first();
        const fresh=existing?null:await readBill(id.replace(" ",""));
        const steps=[db.prepare(`INSERT OR IGNORE INTO tracked_bills (${COLUMNS}) SELECT ${COLUMNS} FROM pending_bills WHERE id=?`).bind(id),db.prepare("DELETE FROM pending_bills WHERE id=?").bind(id),db.prepare("DELETE FROM bill_decisions WHERE id=? AND decision='excluded'").bind(id)];
        if(fresh)steps.push(saveBill(db,"tracked_bills",fresh));
        await db.batch(steps);
        return Response.json({ok:true,message:`${id} added back to the tracker.`});
      }
      return Response.json({error:"Unsupported review action."},{status:400});
    }
    const last=await db.prepare("SELECT checked_at FROM scan_state WHERE id='latest'").first<{checked_at:string}>();
    if(last&&Date.now()-Date.parse(last.checked_at)<20000)return Response.json({error:"A scan was just completed. Try again in 20 seconds."},{status:429});
    const lists=await Promise.allSettled(["A","S"].map(h=>getOfficial(`dailyUpdates.xhtml?house=${h}`)));
    const errors:string[]=[];const dailyIds:string[]=[];let availablePages=0;
    for(let i=0;i<lists.length;i++){
      const result=lists[i];if(result.status==="rejected"){errors.push(`${i===0?"Assembly":"Senate"} daily updates unavailable`);continue;}
      const html=result.value;
      const count=Number(textOf(html).match(/Bills Returned:\s*(\d+)/i)?.[1]);
      if(!Number.isFinite(count)){errors.push(`${i===0?"Assembly":"Senate"} update count could not be verified`);continue;}
      availablePages++;
      const ids=[...new Set([...html.matchAll(/bill_id=202520260(AB|SB)(\d+)/gi)].map(m=>`${m[1].toUpperCase()}${m[2]}`))];
      if(ids.length<count)errors.push(`${i===0?"Assembly":"Senate"} daily updates listed ${count} bills but exposed ${ids.length} distinct bill links`);
      dailyIds.push(...ids);
    }
    if(!availablePages)return Response.json({error:"Both official daily-update pages were unavailable or unreadable. No changes were saved."},{status:502});
    const [cursor,backlogState,searchState,verified,checkedRows]=await Promise.all([
      db.prepare("SELECT result FROM scan_state WHERE id='team_cursor'").first<{result:string}>(),
      db.prepare("SELECT result FROM scan_state WHERE id='discovery_backlog'").first<{result:string}>(),
      db.prepare("SELECT result FROM scan_state WHERE id='search_cursor'").first<{result:string}>(),
      db.prepare("SELECT id,'tracked' AS source FROM tracked_bills UNION ALL SELECT id,'pending' AS source FROM pending_bills").all<{id:string;source:string}>(),
      db.prepare("SELECT id,checked_at FROM scan_state WHERE id LIKE 'textver_%' OR id LIKE 'relevance_%'").all<{id:string;checked_at:string}>()
    ]);
    const searchOffset=Number(searchState?.result||0)%SEARCH_TERMS.length;
    const searchTerms=Array.from({length:5},(_,i)=>SEARCH_TERMS[(searchOffset+i)%SEARCH_TERMS.length]);
    const searchPages=await Promise.allSettled(searchTerms.map(term=>getOfficial(`billSearchClient.xhtml?session_year=20252026&keyword=${encodeURIComponent(term)}&house=Both&author=All&lawCode=All`)));
    const searchIds:string[]=[];
    for(let i=0;i<searchPages.length;i++){
      const page=searchPages[i];
      if(page.status==='rejected'){errors.push(`Keyword search '${searchTerms[i]}' unavailable`);continue;}
      if(!/Bills Returned:\s*\d+/i.test(textOf(page.value))){errors.push(`Keyword search '${searchTerms[i]}' returned no verifiable count`);continue;}
      searchIds.push(...[...page.value.matchAll(/bill_id=202520260(AB|SB)(\d+)/gi)].map(m=>`${m[1].toUpperCase()}${m[2]}`));
    }
    const known=new Set((verified.results||[]).map(b=>b.id.replace(" ","")));
    const scanDay=(date:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));
    const today=scanDay(now);
    const checkedToday=new Set((checkedRows.results||[]).filter(row=>scanDay(row.checked_at)===today&&(row.id.startsWith('textver_')||!known.has(row.id.slice(10)))).map(row=>row.id.slice(row.id.startsWith('textver_')?8:10)));
    const excluded=await db.prepare("SELECT id FROM bill_decisions WHERE decision IN ('excluded','deleted')").all<{id:string}>();
    const blocked=new Set((excluded.results||[]).map(b=>b.id.replace(" ","")));
    let previousBacklog:string[]=[];
    try{const parsed=JSON.parse(backlogState?.result||'[]');if(Array.isArray(parsed))previousBacklog=parsed.filter((id):id is string=>typeof id==='string'&&/^(AB|SB)\d{1,4}$/.test(id));}
    catch{errors.push('Saved discovery backlog could not be read');}
    // Put unfinished candidates first so repeated daily-update links cannot
    // starve bills left over from the prior scan.
    const discovered=[...new Set([...previousBacklog,...dailyIds,...searchIds])].filter(id=>!blocked.has(id)&&!checkedToday.has(id));
    // Reserve room for known bills, while giving newly listed bills first access to the scan.
    const dailyBatch=discovered;
    const watch=[...new Set([...TEAM_IDS,...INITIAL,...known])].filter(id=>!blocked.has(id)&&!checkedToday.has(id));
    const offset=Number(cursor?.result||0)%Math.max(1,watch.length);
    const watchOrder=[...watch.slice(offset),...watch.slice(0,offset)];
    const missingTeam=TEAM_IDS.filter(id=>!known.has(id)&&!blocked.has(id)&&!checkedToday.has(id));
    const selectedTeam=missingTeam;
    const watchCandidates=watchOrder.filter(id=>!dailyBatch.includes(id)&&!selectedTeam.includes(id));
    // This is a request batch, not a scan limit. Callers continue until both
    // remaining counts reach zero; completed checks are saved between requests.
    const ids=[...new Set([...dailyBatch,...selectedTeam,...watchCandidates])].slice(0,40);
    const selectedWatch=watchCandidates.filter(id=>ids.includes(id));
    const nextOffset=selectedWatch.length?(watch.indexOf(selectedWatch[selectedWatch.length-1])+1)%Math.max(1,watch.length):offset;
    const trackedSet=new Set((verified.results||[]).filter(row=>row.source==='tracked').map(row=>row.id));
    const deepSet=new Set(ids);
    const statusOnlyIds=input.continueScan?[]:[...known].filter(id=>!blocked.has(id)&&!deepSet.has(id));
    const statusOnly:Bill[]=[];
    const found:{bill:Bill;hash:string;summary:string|null}[]=[];const completedDaily=new Set<string>();
    // Check every known bill's official status each run. Full text checks still
    // rotate, keeping the source workload bounded while status stays current.
    for(let i=0;i<statusOnlyIds.length;i+=12){
      const batch=statusOnlyIds.slice(i,i+12);
      const results=await Promise.allSettled(batch.map(readBill));
      for(let j=0;j<results.length;j++){
        const result=results[j];
        if(result.status==='fulfilled')statusOnly.push(result.value);
        else {errors.push(`${batch[j]} status unavailable`);checkedToday.delete(batch[j]);}
      }
    }
    for(let i=0;i<ids.length;i+=6){
      const batch=ids.slice(i,i+6);
      const results=await Promise.allSettled(batch.map(async id=>{
        const [bill,html]=await Promise.all([readBill(id),getOfficial(`billTextClient.xhtml?bill_id=${SESSION}${id}`)]);
        const relevant=known.has(id)||await relevantNewBill(id,bill.subject,html);
        return {bill,relevant,hash:await textHash(html),summary:digestSummary(html)};
      }));
      for(let j=0;j<results.length;j++){
        const result=results[j],id=batch[j];
        if(result.status==='fulfilled'){
          if(result.value.relevant||known.has(id))found.push(result.value);
          else if(known.has(id))statusOnly.push(result.value.bill);
          await db.prepare("INSERT INTO scan_state (id,checked_at,result) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at,result=excluded.result").bind(`relevance_${id}`,now,JSON.stringify({subject:result.value.bill.subject,relevant:result.value.relevant})).run();
          if(discovered.includes(id))completedDaily.add(id);
          checkedToday.add(id);
        }else errors.push(`${id} status or text unavailable`);
      }
    }
    const before=await db.prepare("SELECT id,status,date FROM tracked_bills UNION SELECT id,status,date FROM pending_bills").all<{id:string;status:string;date:string}>();const prior=new Map((before.results||[]).map(b=>[b.id,b]));
    const versionsBefore=await textVersions(db);
    const changes=[...statusOnly,...found.map(item=>item.bill)].filter(b=>prior.has(b.id)&&(canonicalStatus(prior.get(b.id)!.status)!==b.status||prior.get(b.id)?.date!==b.date)).map(b=>`${b.id}: ${b.status} (${b.date})`);
    for(let i=0;i<statusOnly.length;i+=20)await db.batch(statusOnly.slice(i,i+20).map(b=>saveBill(db,trackedSet.has(b.id)?'tracked_bills':'pending_bills',b)));
    for(const {bill:b,hash,summary} of found){
      const old=versionsBefore[b.id];
      const textChanged=!!old && old.hash!==hash;
      if(textChanged)changes.push(`${b.id}: official bill text revised; summary refreshed`);
      const key=b.id.replace(' ','');
      const changedAt=textChanged?now:old?.changedAt||null;
      const steps=[saveBill(db,trackedSet.has(b.id)||INITIAL.includes(key)?"tracked_bills":"pending_bills",b),
        db.prepare("INSERT INTO scan_state (id,checked_at,result) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at,result=excluded.result").bind(`textver_${key}`,now,JSON.stringify({hash,changedAt}))];
      if(summary)steps.push(db.prepare("INSERT INTO scan_state (id,checked_at,result) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at,result=excluded.result").bind(`digest_local_v5_${key}`,now,summary));
      else steps.push(db.prepare("DELETE FROM scan_state WHERE id=?").bind(`digest_local_v5_${key}`));
      await db.batch(steps);
    }
    const remaining=discovered.filter(id=>!completedDaily.has(id));
    const textRemaining=[...known].filter(id=>!blocked.has(id)&&!checkedToday.has(id)).length;
    await db.batch([
      db.prepare("INSERT INTO scan_state (id,checked_at,result) VALUES ('team_cursor',?,?) ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at,result=excluded.result").bind(now,String(nextOffset)),
      db.prepare("INSERT INTO scan_state (id,checked_at,result) VALUES ('discovery_backlog',?,?) ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at,result=excluded.result").bind(now,JSON.stringify(remaining)),
      db.prepare("INSERT INTO scan_state (id,checked_at,result) VALUES ('search_cursor',?,?) ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at,result=excluded.result").bind(now,String((searchOffset+searchTerms.length)%SEARCH_TERMS.length))
      ,db.prepare("INSERT INTO scan_state (id,checked_at,result) VALUES ('bill_session',?,?) ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at WHERE scan_state.result=excluded.result").bind(now,SESSION)
    ]);
    const savedCount=await db.prepare("SELECT id FROM tracked_bills UNION SELECT id FROM pending_bills").all<{id:string}>();
    const activeWatch=TEAM_IDS.filter(id=>!blocked.has(id));
    const verifiedCount=activeWatch.filter(id=>(savedCount.results||[]).some(b=>b.id.replace(" ","")===id)).length;
    const progress=`Checked ${statusOnly.length+found.length} bill statuses and ${ids.length} text candidates. ${remaining.length} discovery candidates and ${textRemaining} known bill texts remain to check today. ${verifiedCount} of ${activeWatch.length} team watchlist bills have verified status. Keyword searches use the first results page only.`;
    const result=errors.length||remaining.length||textRemaining?`Partial scan: ${progress} ${errors.slice(0,6).join('; ')}${errors.length>6?` and ${errors.length-6} more`:''}`:`${progress} Both daily-update pages checked.`;
    await db.prepare("INSERT INTO scan_state (id,checked_at,result) VALUES ('latest',?,?) ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at,result=excluded.result").bind(now,result).run();
    const [saved,pending]=await Promise.all([db.prepare("SELECT * FROM tracked_bills WHERE id NOT IN (SELECT id FROM bill_decisions WHERE decision IN ('excluded','deleted')) ORDER BY date DESC,id").all<Bill>(),db.prepare("SELECT * FROM pending_bills WHERE id NOT IN (SELECT id FROM bill_decisions WHERE decision IN ('excluded','deleted')) ORDER BY date DESC,id").all<Bill>()]);
    const removed=await excludedBills(db);
    const [categories,actions,summaries,impacts,approved,relevance,versions,landUses]=await Promise.all([impactCategories(db),textOverrides(db,'action'),textOverrides(db,'summary'),textOverrides(db,'impact'),approvedIds(db),relevanceRecords(db),textVersions(db),landUseOverrides(db)]);
    return Response.json({bills:displayBills(saved.results||[],approved,relevance).map(canonicalBill),pending:displayBills(pending.results||[],approved,relevance).map(canonicalBill),excluded:(removed.results||[]).map(canonicalBill),impactCategories:categories,actionOverrides:actions,summaryOverrides:summaries,impactOverrides:impacts,textVersions:versions,landUseOverrides:landUses,checkedAt:now,result,changes,discoveryRemaining:remaining.length,textRemaining,partial:errors.length>0||remaining.length>0||textRemaining>0,session:SESSION_LABEL});
  }catch(error){return Response.json({error:`Update could not finish: ${error instanceof Error?error.message:"unexpected error"}. No unverified changes are shown.`},{status:502})}
}
