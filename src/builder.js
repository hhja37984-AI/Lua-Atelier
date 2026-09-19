const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const uid=()=>Math.random().toString(36).slice(2,10);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const copy=x=>JSON.parse(JSON.stringify(x));
const initial=()=>({trigger:'onInput',stateKey:'atelier_state',flow:[],functions:[],patterns:[]});
let project=initial(),activeFn=null;
function toPage(page){$$('.page').forEach(x=>x.classList.toggle('active',x.id==='page-'+page));$$('.tabs button').forEach(x=>x.classList.toggle('active',x.dataset.page===page));if(page==='code')$('#codeFull').value=buildLua();if(page==='functions')renderFunctions();if(page==='patterns')renderPatternLibrary();}
$$('.tabs button').forEach(x=>x.onclick=()=>toPage(x.dataset.page));
const TYPES={literal:'변수 만들기',stateRead:'State 읽기',stateSet:'State 저장',calc:'숫자 계산',clamp:'범위 제한',random:'랜덤 정수',chance:'확률 판정',weighted:'가중치 선택',date:'날짜 계산',split:'구분자로 나누기',extract:'사이 문자열 추출',slice:'위치로 추출',pattern:'패턴 추출',patternUse:'추출 패턴 복사본',map:'값 대응표',replace:'문자열 치환',if:'조건 분기',output:'텍스트 / HTML 출력',alert:'알림',removeChat:'최근 채팅 삭제',stop:'생성 중단',call:'내 함수 호출',return:'함수 반환',log:'로그'};
const OPTS=Object.entries(TYPES).map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
const make=t=>({id:uid(),type:t,...({literal:{name:'value',value:'0',valueType:'number'},stateRead:{name:'saved',key:'value',fallback:'0'},stateSet:{key:'value',value:'value'},calc:{name:'result',a:'0',op:'+',b:'0'},clamp:{name:'limited',value:'value',min:'0',max:'100'},random:{name:'roll',min:'1',max:'100'},chance:{name:'hit',percent:'25'},weighted:{name:'picked',items:'A:50\nB:50'},date:{name:'days',mode:'diff',a:'2026-09-01',b:'2026-09-19'},split:{source:'input',separator:';',names:'first, second, third',trim:true},extract:{name:'between',source:'input',start:'[',end:']'},slice:{name:'piece',source:'input',start:'1',length:'4'},pattern:{source:'input',parts:[{kind:'digits',count:'1+',name:'number'}]},patternUse:{source:'input',title:'새 패턴',parts:[{kind:'digits',text:''}],names:['part1']},map:{name:'mapped',source:'monthText',items:'May=5\nJune=6',fallback:'0'},replace:{name:'cleaned',source:'input',find:' ',replacement:'_',mode:'plain'},if:{mode:'all',conditions:[{left:'value',op:'>=',right:'100',join:'and'}],yes:[],no:[]},output:{mode:'append',template:'{{value}}'},alert:{message:'완료',level:'normal'},removeChat:{},stop:{},call:{name:'result',fn:'',args:''},return:{value:'result'},log:{value:'value'}}[t]||{})});
function scopeFor(ref){if(ref==='main')return project.flow;let [fnId,...path]=ref.split('/');const f=project.functions.find(x=>x.id===fnId);if(!f)return [];return path.reduce((arr,part)=>{const [id,branch]=part.split(':');const b=arr.find(x=>x.id===id);return b&&b.type==='if'?b[branch]||[]:[]},f.flow)}
function containerAt(path){let parts=path.split('/');let arr=parts[0]==='main'?project.flow:(project.functions.find(f=>f.id===parts[0])?.flow);if(!arr)return null;for(const seg of parts.slice(1)){const [id,side]=seg.split(':');const block=arr.find(b=>b.id===id);if(!block||block.type!=='if')return null;arr=block[side]}return arr;}
function field(k,label,val,kind='text',opts=''){return `<div class="field"><label>${esc(label)}</label>${kind==='textarea'?`<textarea data-k="${k}">${esc(val)}</textarea>`:kind==='select'?`<select data-k="${k}">${opts}</select>`:`<input data-k="${k}" value="${esc(val)}" list="varsHint" ${kind==='number'?'inputmode="decimal"':''}>`}</div>`;}
const options=(arr,current)=>arr.map(([v,s])=>`<option value="${esc(v)}" ${String(v)===String(current)?'selected':''}>${esc(s)}</option>`).join('');
function sel(k,label,v,arr){return field(k,label,v,'select',options(arr,v))}
function formatBlock(b){let f=(k,l,kind='text')=>field(k,l,b[k]??'',kind), s=(k,l,a)=>sel(k,l,b[k],a);let out='';
switch(b.type){
case'literal':out=f('name','변수명')+f('value','값')+s('valueType','값 종류',[['number','숫자'],['string','문자열'],['boolean','true/false']]);break;
case'stateRead':out=f('name','변수명')+f('key','State 필드')+f('fallback','값이 없을 때');break;
case'stateSet':out=f('key','State 필드')+f('value','저장할 값/변수');break;
case'calc':out=f('name','결과 변수')+f('a','왼쪽 값/변수')+s('op','연산',[['+','더하기'],['-','빼기'],['*','곱하기'],['/','나누기'],['%','나머지'],['^','거듭제곱']])+f('b','오른쪽 값/변수');break;
case'clamp':out=f('name','결과 변수')+f('value','값')+f('min','최소')+f('max','최대');break;
case'random':out=f('name','결과 변수')+f('min','최소')+f('max','최대');break;
case'chance':out=f('name','결과 변수')+f('percent','확률 (%)');break;
case'weighted':out=f('name','결과 변수')+f('items','항목:가중치 (한 줄씩)','textarea');break;
case'date':out=f('name','결과 변수')+s('mode','계산',[['diff','끝 날짜 − 시작 날짜 (일)'],['add','날짜에 일수 더하기'],['year','연도 추출'],['month','월 추출'],['day','일 추출']])+f('a','시작 날짜 / 날짜 변수')+f('b','끝 날짜 / 더할 일수');break;
case'split':out=f('source','원본 문자열/변수')+f('separator','구분자')+f('names','추출 결과 변수명 (쉼표 구분)')+`<div class="hint">예: now;Arisu;14 → first, second, third</div>`;break;
case'extract':out=f('name','결과 변수')+f('source','원본 문자열/변수')+f('start','시작 문구')+f('end','끝 문구');break;
case'slice':out=f('name','결과 변수')+f('source','원본 문자열/변수')+f('start','시작 위치 (1부터)')+f('length','가져올 길이');break;
case'pattern':out=f('source','원본 문자열/변수')+`<div class="hint">왼쪽에서 오른쪽으로 문자 종류를 조합합니다. 결과에 담을 변수명을 입력하세요.</div><div class="patternparts">${b.parts.map((p,i)=>`<div class="field" data-p="${i}"><select data-pk="kind">${options([['digits','숫자'],['letters','영문자'],['spaces','공백'],['any','아무 문자'],['literal','정해진 글자']],p.kind)}</select><input data-pk="literal" placeholder="정해진 글자" value="${esc(p.literal||'')}" ${p.kind==='literal'?'':'style="opacity:.5"'}><select data-pk="count">${options([['1','1개'],['1+','1개 이상'],['0+','0개 이상'],['2','2개'],['4','4개']],p.count)}</select><input data-pk="name" placeholder="결과 변수명 (선택)" value="${esc(p.name||'')}"><button data-remove-part="${i}">×</button></div>`).join('')}</div><button data-add-part>+ 문자 규칙</button>`;break;
case'patternUse':out='<div class="hint">저장된 패턴을 복사해 이 블록에서 독립적으로 수정합니다.</div>';break;
case'map':out=f('name','결과 변수')+f('source','찾을 값/변수')+f('items','입력=결과 (한 줄씩)','textarea')+f('fallback','없을 때 값');break;
case'replace':out=f('name','결과 변수')+f('source','원본 문자열/변수')+f('find','찾을 글자')+f('replacement','바꿀 글자')+s('mode','찾는 방법',[['plain','일반 문자열'],['pattern','Lua pattern']]);break;
case'output':out=s('mode','출력 방식',[['append','뒤에 추가'],['replace','전체 교체']])+f('template','텍스트 / HTML ({{변수}} 참조)','textarea');break;
case'alert':out=f('message','알림 문구')+s('level','유형',[['normal','일반'],['error','오류']]);break;
case'call':out=f('name','결과 변수')+s('fn','호출할 함수',[['','함수 선택'],...project.functions.map(x=>[x.id,x.name])])+f('args','인자 (쉼표로 구분)');break;
case'return':out=f('value','반환할 값/변수');break;
case'log':out=f('value','기록할 값/변수');break;
case'if':out=s('mode','조건 연결',[['all','모두 참 (AND)'],['any','하나라도 참 (OR)']])+`<div class="conditionrows">${b.conditions.map((c,i)=>`<div class="field" data-ci="${i}"><input data-ck="left" value="${esc(c.left)}" placeholder="왼쪽 값"><select data-ck="op">${options([['==','같음'],['~=','다름'],['>','초과'],['>=','이상'],['<','미만'],['<=','이하'],['contains','문자열 포함'],['starts','문자열 시작'],['ends','문자열 끝'],['truthy','참인지']],c.op)}</select><input data-ck="right" value="${esc(c.right)}" placeholder="오른쪽 값"><button data-del-cond="${i}">×</button></div>`).join('')}</div><button data-add-cond>+ 조건 추가</button>`;break;
}return out;}
function renderFlow(arr,path,host){host.replaceChildren();arr.forEach((b,i)=>{
 const div=document.createElement('article');div.className='block';div.dataset.type=b.type;div.dataset.id=b.id;div.innerHTML=`<div class="blockhead"><strong>${esc(TYPES[b.type]||b.type)}</strong><button class="move" data-move="up" title="위로">↑</button><button class="move" data-move="down" title="아래로">↓</button><button class="move" data-dup title="복제">복제</button><button class="move" data-remove title="삭제">×</button></div><div class="blockbody">${formatBlock(b)}</div>`;
 div.querySelector('[data-move="up"]').onclick=()=>{if(i){[arr[i-1],arr[i]]=[arr[i],arr[i-1]];redraw()}};
 div.querySelector('[data-move="down"]').onclick=()=>{if(i<arr.length-1){[arr[i+1],arr[i]]=[arr[i],arr[i+1]];redraw()}};
 div.querySelector('[data-dup]').onclick=()=>{const clone=copy(b);reId(clone);arr.splice(i+1,0,clone);redraw()};
 div.querySelector('[data-remove]').onclick=()=>{arr.splice(i,1);redraw()};
 if(b.type==='patternUse')div.querySelector('.blockbody').replaceChildren(pBlockEditor(b));
 div.querySelectorAll('[data-k]').forEach(el=>{el.oninput=el.onchange=()=>{b[el.dataset.k]=el.value;refreshOutputs();}});
 if(b.type==='pattern'){
 div.querySelector('[data-add-part]').onclick=()=>{b.parts.push({kind:'digits',count:'1',name:''});redraw()};
 div.querySelectorAll('[data-p]').forEach(row=>{const n=+row.dataset.p;row.querySelectorAll('[data-pk]').forEach(x=>x.oninput=x.onchange=()=>{b.parts[n][x.dataset.pk]=x.value;if(x.dataset.pk==='kind')redraw();else refreshOutputs()});row.querySelector('[data-remove-part]').onclick=()=>{b.parts.splice(n,1);redraw()}});
 }
 if(b.type==='if'){
 div.querySelector('[data-add-cond]').onclick=()=>{b.conditions.push({left:'value',op:'==',right:'true'});redraw()};
 div.querySelectorAll('[data-ci]').forEach(row=>{const n=+row.dataset.ci;row.querySelectorAll('[data-ck]').forEach(x=>x.oninput=x.onchange=()=>{b.conditions[n][x.dataset.ck]=x.value;refreshOutputs()});row.querySelector('[data-del-cond]').onclick=()=>{b.conditions.splice(n,1);redraw()}});
 for(const [key,title] of [['yes','참일 때'],['no','거짓일 때']]){
 const branch=document.createElement('div');branch.className='branch '+(key==='no'?'else':'');branch.innerHTML=`<div class="branchlabel">${title}</div><div class="flowlist"></div>`;
 renderFlow(b[key],path+'/'+b.id+':'+key,branch.querySelector('.flowlist'));div.append(branch);
 }
 }
 host.append(div);
 });const bar=document.createElement('div');bar.className='adder';bar.innerHTML=`<select aria-label="추가할 재료"><option value="">+ 재료 선택</option>${OPTS}</select><button>추가</button>`;bar.querySelector('button').onclick=()=>{let t=bar.querySelector('select').value;if(!t)return;arr.push(make(t));redraw()};host.append(bar);
}
function reId(b){b.id=uid();if(b.type==='if'){b.yes.forEach(reId);b.no.forEach(reId)}}
function allVars(arr,into=new Set(['input'])){for(const b of arr){if(b.name)into.add(b.name);if(b.type==='split')b.names.split(',').map(x=>x.trim()).filter(Boolean).forEach(x=>into.add(x));if(b.type==='pattern')b.parts.map(x=>x.name).filter(Boolean).forEach(x=>into.add(x));if(b.type==='patternUse')(b.names||[]).filter(Boolean).forEach(x=>into.add(x));if(b.type==='if'){allVars(b.yes,into);allVars(b.no,into)}}return into}
function redraw(){
  renderFlow(project.flow,'main',$('#mainFlow'));
  renderFunctions(false);
  // Refresh the currently open function flow after structural edits, too.
  // renderFunctions(false) refreshes the sidebar only; it leaves #fnFlow stale.
  if(activeFn && project.functions.some(f=>f.id===activeFn)){
    const editor=$('#functionEditor');
    const scrollContainer=editor.closest('.page');
    const scrollTop=scrollContainer?.scrollTop;
    renderFunctionEditor();
    if(scrollContainer && scrollTop!=null) scrollContainer.scrollTop=scrollTop;
  }
  refreshOutputs();
}
function refreshOutputs(){let names=[...allVars(project.flow)];$('#variableList').innerHTML=names.map(n=>`<span class="pill">${esc(n)}</span>`).join(' ');$('#codeMini').textContent=buildLua();$('#issues').innerHTML=diagnose().map(x=>`<div class="error">${esc(x)}</div>`).join('');}
function renderFunctions(openEditor=true){const host=$('#functionList');host.replaceChildren();project.functions.forEach(f=>{const d=document.createElement('div');d.className='fncard';d.innerHTML=`<strong>${esc(f.name)}</strong><span class="small">(${esc(f.params)})</span><button>편집</button><button data-del>삭제</button>`;d.querySelector('button').onclick=()=>{activeFn=f.id;renderFunctionEditor()};d.querySelector('[data-del]').onclick=()=>{if(confirm('함수 '+f.name+' 삭제할까요?')){project.functions=project.functions.filter(x=>x.id!==f.id);if(activeFn===f.id)activeFn=null;renderFunctions();redraw()}};host.append(d)});if(openEditor)renderFunctionEditor()}
function renderFunctionEditor(){const host=$('#functionEditor'),f=project.functions.find(x=>x.id===activeFn);if(!f){host.innerHTML='<h3>함수를 선택하세요</h3>';return}host.innerHTML=`<div class="fnedit"><h3>함수 설정</h3>${field('fname','함수 이름',f.name)}${field('fparams','입력 인자 (쉼표 구분)',f.params)}${field('freturn','반환할 변수/값',f.returns)}<p class="hint">함수 안의 블록은 위에서 아래로 실행됩니다. 호출할 때 입력 인자를 전달합니다.</p></div><div class="sheet" style="margin-top:10px"><h3>함수 실행 흐름</h3><div class="flowlist" id="fnFlow"></div></div>`;host.querySelector('[data-k="fname"]').oninput=e=>{f.name=e.target.value;renderFunctions(false);refreshOutputs()};host.querySelector('[data-k="fparams"]').oninput=e=>{f.params=e.target.value;renderFunctions(false);refreshOutputs()};host.querySelector('[data-k="freturn"]').oninput=e=>{f.returns=e.target.value;refreshOutputs()};renderFlow(f.flow,f.id,$('#fnFlow'))}
$('#newFunction').onclick=()=>{const f={id:uid(),name:'myFunction'+(project.functions.length+1),params:'value',returns:'result',flow:[make('literal')]};f.flow[0].name='result';f.flow[0].value='0';project.functions.push(f);activeFn=f.id;renderFunctions();refreshOutputs()};
function validName(x){return /^[A-Za-z_][A-Za-z0-9_]*$/.test(x)&&!new Set(['and','break','do','else','elseif','end','false','for','function','goto','if','in','local','nil','not','or','repeat','return','then','true','until','while']).has(x)}
function q(s){return JSON.stringify(String(s??''))}
function atom(value,vars){let s=String(value??'').trim();if(vars.has(s)&&validName(s))return s;if(s==='true'||s==='false'||s==='nil')return s;if(/^-?(?:\d+\.?\d*|\.\d+)$/.test(s))return s;return q(value)}
function assign(name,expr,vars,indent,local=true){if(!validName(name))return `${indent}-- invalid variable name: ${q(name)}`;const prefix=local&&!vars.has(name)?'local ':'';vars.add(name);return indent+prefix+name+' = '+expr}
function txtExpr(template,vars){let parts=[],last=0,m,r=/\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g;while((m=r.exec(template))){if(m.index>last)parts.push(q(template.slice(last,m.index)));parts.push(vars.has(m[1])?`tostring(${m[1]})`:q('{{'+m[1]+'}}'));last=r.lastIndex}if(last<template.length)parts.push(q(template.slice(last)));return parts.length?parts.join(' .. '):q(template)}
function luaPattern(parts){return '^'+parts.map(p=>{let base=p.kind==='digits'?'%d':p.kind==='letters'?'%a':p.kind==='spaces'?'%s':p.kind==='any'?'.':String(p.literal||'').replace(/([%^%$%(%)%.%[%]%*%+%-%?])/g,'%%%1');let count=p.count;if(count==='1+')return base+'+';if(count==='0+')return base+'*';return base.repeat(Math.max(1,Math.min(100,Number(count)||1)))}).join('')+'$'}
