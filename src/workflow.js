/* RP 작업 흐름: 날짜 입력 → 이벤트 조건 → 상태 갱신 → 위젯 변수 연결 */
const FLOW_MONTHS={jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};
const flowDefault=()=>({enabled:false,dateSource:'input',dateFormat:'iso',datePattern:null,yearIndex:3,monthIndex:2,dayIndex:1,sample:'2026-09-19',interval:3,eventMode:'repeat',firstRun:'run',reverse:'skip',action:'random',valueKey:'weather',valueText:'맑음',min:1,max:100,statePrefix:'rp_event',widgetEnabled:false,widgetHtml:'<div class="rp-widget"><b>현재 날씨</b><p>{{weather}}</p><small>{{rp_date}}</small></div>',widgetCss:'.rp-widget { padding: 14px; border-radius: 12px; background: #f2eee8; color: #342e2a; }',widgetBindings:{weather:'weather',rp_date:'rp_date'}});
function ensureWorkflow(){if(!project.workflow)project.workflow=flowDefault();return project.workflow}
function attachWorkflowEvent(){
 const w=ensureWorkflow();
 if(!w.enabled){w.enabled=true;$('#wf-enabled').checked=true}
 const key=String(w.statePrefix||'rp_event').replace(/[^A-Za-z0-9_]/g,'_')+'_due';
 const known=allVars(project.flow);let name='rpEventDue',suffix=2;
 while(known.has(name)){name='rpEventDue'+suffix;suffix++}
 const read=make('stateRead');read.name=name;read.key=key;read.fallback='false';
 const branch=make('if');branch.conditions=[{left:name,op:'==',right:'true'}];branch.yes=[];branch.no=[];
 project.flow.push(read,branch);redraw();toPage('builder');
}

function parseFlowDate(text,w){
 const s=String(text||'');let year,month,day;
 if(w.dateFormat==='custom'){
  if(!w.datePattern||!Array.isArray(w.datePattern.parts))return null;
  const m=s.match(new RegExp(pCompile(w.datePattern.parts).js.replace(/^\^/,'').replace(/\$$/,'')));
  if(!m)return null;year=Number(m[Number(w.yearIndex)]);day=Number(m[Number(w.dayIndex)]);
  const raw=m[Number(w.monthIndex)];month=FLOW_MONTHS[String(raw||'').toLowerCase()]||Number(raw);
 }else{
  const re=w.dateFormat==='english'?/(\d{1,2})\s+([A-Za-z]+)\s*,?\s*(\d{1,4})/:w.dateFormat==='dot'?/(\d{1,4})\.(\d{1,2})\.(\d{1,2})/:/(\d{1,4})-(\d{1,2})-(\d{1,2})/;
  const m=s.match(re);if(!m)return null;
  if(w.dateFormat==='english'){day=Number(m[1]);month=FLOW_MONTHS[m[2].toLowerCase()];year=Number(m[3])}
  else{year=Number(m[1]);month=Number(m[2]);day=Number(m[3])}
 }
 if(!Number.isInteger(year)||!Number.isInteger(month)||!Number.isInteger(day)||year<1||year>9999||month<1||month>12)return null;
 const date=new Date(0);date.setUTCFullYear(year,month-1,day);date.setUTCHours(0,0,0,0);if(date.getUTCFullYear()!==year||date.getUTCMonth()+1!==month||date.getUTCDate()!==day)return null;
 return {year,month,day,iso:[String(year).padStart(4,'0'),String(month).padStart(2,'0'),String(day).padStart(2,'0')].join('-'),days:Math.floor(date.getTime()/86400000)};
}
function widgetReferences(w){return [...new Set([...String(w.widgetHtml||'').matchAll(/\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g)].map(x=>x[1]))]}
function widgetValue(w,key,values){const value=String(w.widgetBindings?.[key]||key);return values[value]??''}
function widgetHtml(w,values){
 const body=String(w.widgetHtml||'').replace(/\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g,(_,key)=>String(widgetValue(w,key,values)).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])));
 return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+String(w.widgetCss||'')+'</style></head><body>'+body+'</body></html>';
}
function workflowFields(){
 const w=ensureWorkflow();
 const format=$('#workflowDateFormat');format.value=w.dateFormat;
 const keys=['dateSource','sample','interval','eventMode','firstRun','reverse','action','valueKey','valueText','min','max','statePrefix','widgetHtml','widgetCss'];
 keys.forEach(k=>{const el=$('#wf-'+k);if(!el)return;el.value=w[k];el.oninput=el.onchange=()=>{w[k]=['interval','min','max'].includes(k)?Number(el.value):el.value;renderWorkflowPreview();refreshOutputs()}});
 format.onchange=()=>{w.dateFormat=format.value;renderWorkflowFields();refreshOutputs()};
 $('#wf-widgetHtml').onchange=()=>{w.widgetHtml=$('#wf-widgetHtml').value;renderWorkflowFields();refreshOutputs()};
 $('#wf-action').onchange=()=>{w.action=$('#wf-action').value;$('#wf-actionText').hidden=w.action!=='text';$('#wf-actionRandom').hidden=w.action!=='random';renderWorkflowPreview();refreshOutputs()};
 $('#wf-addEventBranch').onclick=attachWorkflowEvent;
 $('#wf-enabled').checked=w.enabled;$('#wf-enabled').onchange=e=>{w.enabled=e.target.checked;renderWorkflowPreview();refreshOutputs()};
 $('#wf-widgetEnabled').checked=w.widgetEnabled;$('#wf-widgetEnabled').onchange=e=>{w.widgetEnabled=e.target.checked;$('#wf-widgetSettings').hidden=!w.widgetEnabled;renderWorkflowPreview();refreshOutputs()};
 $('#wf-patternImport').replaceChildren();
 const select=$('#wf-patternImport');select.append(new Option('추출 패턴 선택',''));
 (project.patterns||[]).forEach(t=>select.append(new Option(t.title,t.id)));
 $('#wf-copyPattern').onclick=()=>{const t=(project.patterns||[]).find(t=>t.id===select.value);if(!t){alert('패턴을 선택하세요.');return}w.datePattern={title:t.title,parts:copy(t.parts)};w.dateFormat='custom';w.yearIndex=3;w.monthIndex=2;w.dayIndex=1;renderWorkflowFields();refreshOutputs()};
 $('#wf-dateIndices').replaceChildren();
 for(const [k,label] of [['dayIndex','일 추출 번호'],['monthIndex','월 추출 번호'],['yearIndex','연도 추출 번호']]){
  const el=document.createElement('div');el.className='field';const name=document.createElement('label');name.textContent=label;
  const select=document.createElement('select');const max=pCaptures(w.datePattern?.parts||[]).length;
  for(let i=1;i<=max;i++)select.append(new Option('추출 '+i,String(i)));
  select.value=String(w[k]);select.onchange=()=>{w[k]=Number(select.value);renderWorkflowPreview();refreshOutputs()};
  el.append(name,select);$('#wf-dateIndices').append(el);
 }
 const custom=w.dateFormat==='custom';$('#wf-customDate').hidden=!custom;$('#wf-dateIndices').hidden=!custom;
 $('#wf-patternName').textContent=w.datePattern?.title||'선택된 패턴 없음';
 $('#wf-actionText').hidden=w.action!=='text';$('#wf-actionRandom').hidden=w.action!=='random';
 $('#wf-widgetSettings').hidden=!w.widgetEnabled;
 const names=widgetReferences(w),bindings=$('#wf-widgetBindings');bindings.replaceChildren();
 for(const key of names){const row=document.createElement('div');row.className='field';const label=document.createElement('label');label.textContent='{{'+key+'}}';
  const input=document.createElement('input');input.value=w.widgetBindings?.[key]||key;input.placeholder='연결할 State 변수';
  input.oninput=()=>{w.widgetBindings={...w.widgetBindings,[key]:input.value};renderWorkflowPreview();refreshOutputs()};row.append(label,input);bindings.append(row)}
}
function renderWorkflowFields(){workflowFields();renderWorkflowPreview()}
function renderWorkflowPreview(){
 const w=ensureWorkflow(),date=parseFlowDate(w.sample,w),prev=$('#wf-previewResult');
 const n=Math.max(1,Number(w.interval)||1),example={...project.workflowSample};
 const prior=parseFlowDate($('#wf-lastDate')?.value||'',{...w,dateFormat:'iso'});
 const elapsed=date&&prior?date.days-prior.days:null;
 const due=date?(elapsed===null?(w.firstRun==='run'&&w.eventMode!=='condition'):elapsed<0?false:elapsed>=n):false;
 if(date){example.rp_date=date.iso;example[w.valueKey]=w.action==='text'?w.valueText:w.min;prev.textContent='날짜 인식: '+date.iso+'\n경과일: '+(elapsed===null?'이전 기록 없음':elapsed+'일')+'\n간격: '+n+'일 / '+(w.eventMode==='repeat'?'반복 이벤트':w.eventMode==='once'?'1회 이벤트':'조건만 확인')+'\n이벤트 충족: '+(due?'예':'아니오')+'\n첫 실행: '+(w.firstRun==='run'?'즉시 실행':'날짜만 기록')}
 else prev.textContent='날짜를 인식하지 못했습니다. 날짜 형식과 샘플 입력을 확인하세요.';
 const refs=widgetReferences(w);const values={...example};
 $('#wf-lastDate').oninput=renderWorkflowPreview;
 for(const key of refs){const stateKey=w.widgetBindings?.[key]||key;if(!Object.prototype.hasOwnProperty.call(values,stateKey))values[stateKey]='['+stateKey+']'}
 $('#wf-widgetPreview').srcdoc=widgetHtml(w,values);
 $('#wf-widgetPreview').hidden=!w.widgetEnabled;
 $('#wf-previewWidth').onchange=e=>{$('#wf-widgetPreview').style.width=e.target.value};
}
function widgetLuaCode(w){
 if(!w.widgetEnabled)return [];
 const css=String(w.widgetCss||''),html=String(w.widgetHtml||'');
 const lookups=widgetReferences(w).map(key=>[key,w.widgetBindings?.[key]||key]);
 // Content is constructed with escaped Lua string literals, not Lua source interpolation.
 const parts=['','-- Display widget (independent of the event trigger)','listenEdit("editDisplay", function(triggerId, data)',
  '    local __widgetState = getState(triggerId, '+q(project.stateKey)+') or {}',
  '    local function __widgetEscape(v)',
  '        return tostring(v or ""):gsub("&","&amp;"):gsub("<","&lt;"):gsub(">","&gt;"):gsub("\\\"","&quot;"):gsub("\\x27","&#39;")',
  '    end',
  '    local __widget = '+q('<style>'+css+'</style>'+html)];
 for(const [placeholder,name] of lookups){parts.push('    __widget = __widget:gsub('+q('{{'+placeholder+'}}').replace(/%/g,'%%')+', function() return __widgetEscape(__widgetState['+q(name)+']) end)')}
 parts.push('    return tostring(data or "") .. __widget','end)');return parts;
}
function workflowLuaCode(w){
 if(!w.enabled)return [];
 if(w.dateFormat==='custom'&&(!w.datePattern||!Array.isArray(w.datePattern.parts)))return ['    -- 사용자 정의 날짜 패턴을 먼저 선택하세요.'];
 const pattern=w.dateFormat==='custom'&&w.datePattern?pCompile(w.datePattern.parts).lua.replace(/^\^/,'').replace(/\$$/,''):w.dateFormat==='english'?'(%d%d?)%s+(%a+),?%s*(%d+)':w.dateFormat==='dot'?'(%d+)%.(%d+)%.(%d+)':'(%d+)%-(%d+)%-(%d+)';
 const indices=w.dateFormat==='custom'?[w.yearIndex,w.monthIndex,w.dayIndex]:w.dateFormat==='english'?[3,2,1]:[1,2,3];
 const n=Math.max(1,Math.floor(Number(w.interval)||1)),key=String(w.statePrefix||'rp_event').replace(/[^A-Za-z0-9_]/g,'_');
 const low=Math.floor(Number(w.min)||0),high=Math.floor(Number(w.max)||100);
 const lines=['    -- RP 날짜 이벤트: 마지막 처리 날짜와 이벤트 상태는 State에 보관합니다.',
 '    local __rpText = tostring('+ (validName(w.dateSource)?w.dateSource:'input')+' or "")',
 '    state['+q(key+'_due')+'] = false',
 '    local __rpCapture = {string.match(__rpText, '+q(pattern)+')}',
 '    local __rpMonthNames = {jan=1,january=1,feb=2,february=2,mar=3,march=3,apr=4,april=4,may=5,jun=6,june=6,jul=7,july=7,aug=8,august=8,sep=9,sept=9,september=9,oct=10,october=10,nov=11,november=11,dec=12,december=12}',
 '    local __rpYear = tonumber(__rpCapture['+indices[0]+'])',
 '    local __rpMonthRaw = __rpCapture['+indices[1]+']',
 '    local __rpMonth = tonumber(__rpMonthRaw) or __rpMonthNames[string.lower(tostring(__rpMonthRaw or ""))]',
 '    local __rpDay = tonumber(__rpCapture['+indices[2]+'])',
 '    if __rpYear and __rpMonth and __rpDay and __rpYear>=1 and __rpYear<=9999 and __rpMonth>=1 and __rpMonth<=12 and __rpDay>=1 and __rpDay<=31 then',
 '        local __rpDate = string.format("%04d-%02d-%02d",__rpYear,__rpMonth,__rpDay)',
 '        if __parseDate(__rpDate) and __dateAdd(__rpDate,0)==__rpDate then',
 '            local __rpNow = __days(__rpYear,__rpMonth,__rpDay)',
 '            local __rpPrior = __parseDate(state['+q(key+'_last_date')+'])',
 '            local __rpPreviousDays = __rpPrior and __days(__rpPrior.y,__rpPrior.m,__rpPrior.d) or nil',
 '            local __rpElapsed = __rpPreviousDays and (__rpNow-__rpPreviousDays) or nil',
 '            local __rpDue = false',
 '            state['+q('rp_date')+'] = __rpDate'];
 if(w.eventMode==='condition'){lines.push('            if __rpElapsed == nil then state['+q(key+'_last_date')+'] = __rpDate end', '            __rpDue = (__rpElapsed ~= nil and __rpElapsed >= '+n+')');}
 else {
  lines.push('            if __rpElapsed == nil then',
    '                __rpDue = '+(w.firstRun==='run'?'true':'false'),
    '                state['+q(key+'_last_date')+'] = __rpDate',
    '            elseif __rpElapsed < 0 then',
    '                '+(w.reverse==='reset'?('state['+q(key+'_last_date')+'] = __rpDate'):'-- 과거 날짜는 무시'),
    '            elseif __rpElapsed >= '+n+' then',
    '                __rpDue = '+(w.eventMode==='once'?('not state['+q(key+'_done')+']'):'true'),
    '            end');
 }
 lines.push('            state['+q(key+'_due')+'] = __rpDue',
 '            state['+q(key+'_elapsed')+'] = __rpElapsed',
 '            if __rpDue then');
 if(w.eventMode!=='condition'){
  lines.push('                state['+q(key+'_last_date')+'] = __rpDate');
  if(w.eventMode==='once')lines.push('                state['+q(key+'_done')+'] = true');
 }
 if(w.action==='text')lines.push('                state['+q(w.valueKey)+'] = '+q(w.valueText));
 else if(w.action==='random'&&low<=high)lines.push('                state['+q(w.valueKey)+'] = math.random('+low+','+high+')');
 lines.push('            end','        end','    end','    setState(triggerId, '+q(project.stateKey)+', state)');
 return lines;
}
