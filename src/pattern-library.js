/* Saved extraction patterns are templates: usage blocks store complete copies. */
const PTYPES={literal:'고정 문구',space:'공백',digits:'숫자 추출',letters:'영문 추출',word:'영문·숫자 추출',until:'다음 구분자까지 추출'};
const pToken=(kind='literal')=>({kind,text:kind==='literal'?';':''});
const pTemplate=()=>({id:uid(),title:'새 패턴',sample:'now;Arisu;14',parts:[pToken('until'),pToken(),pToken('until'),pToken(),pToken('digits')]});
const pCaptures=parts=>(parts||[]).filter(p=>!['literal','space'].includes(p.kind));
const pEscape=s=>String(s).replace(/([%^%$%(%)%.%[%]%*%+%-%?])/g,'%%%1');
const jsEscape=s=>String(s).replace(/[.*+?^$()|[\]\\{}]/g,'\\$&');
function pCompile(parts){
 let lua='^',js='^';
 for(const p of parts||[]){
  if(p.kind==='literal'){lua+=pEscape(p.text||'');js+=jsEscape(p.text||'')}
  else if(p.kind==='space'){lua+='%s+';js+='\\s+'}
  else if(p.kind==='digits'){lua+='(%d+)';js+='(\\d+)'}
  else if(p.kind==='letters'){lua+='(%a+)';js+='([A-Za-z]+)'}
  else if(p.kind==='word'){lua+='([%w_]+)';js+='([A-Za-z0-9_]+)'}
  else if(p.kind==='until'){lua+='(.-)';js+='([\\s\\S]*?)'}
  else throw Error('알 수 없는 패턴 재료');
 }
 return {lua:lua+'$',js:js+'$'};
}
function pBlock(t){
 const parts=copy(t.parts);
 return {id:uid(),type:'patternUse',title:t.title,source:'input',parts,names:pCaptures(parts).map((_,i)=>'part'+(i+1))};
}
function pPartsEditor(parts,change){
 const box=document.createElement('div');box.className='pattern-token-list';
 function draw(){
  box.replaceChildren();
  parts.forEach((p,i)=>{
   const row=document.createElement('div');row.className='pattern-token';
   const type=document.createElement('select');
   Object.entries(PTYPES).forEach(([v,label])=>{let opt=document.createElement('option');opt.value=v;opt.textContent=label;type.append(opt)});
   type.value=p.kind;type.onchange=()=>{p.kind=type.value;draw();change()};row.append(type);
   if(p.kind==='literal'){
    const input=document.createElement('input');input.value=p.text||'';input.placeholder='고정 문구 (예: ; 또는 , Imperial Era )';
    input.oninput=()=>{p.text=input.value;change()};row.append(input);
   }
   const up=document.createElement('button');up.textContent='↑';up.disabled=i===0;up.onclick=()=>{[parts[i-1],parts[i]]=[parts[i],parts[i-1]];draw();change()};
   const down=document.createElement('button');down.textContent='↓';down.disabled=i===parts.length-1;down.onclick=()=>{[parts[i+1],parts[i]]=[parts[i],parts[i+1]];draw();change()};
   const del=document.createElement('button');del.textContent='×';del.onclick=()=>{parts.splice(i,1);draw();change()};
   row.append(up,down,del);box.append(row);
  });
 }
 const add=document.createElement('button');add.textContent='+ 규칙 추가';add.onclick=()=>{parts.push(pToken());draw();change()};
 const wrap=document.createElement('div');wrap.append(box,add);draw();return wrap;
}
function pBlockEditor(block){
 const host=document.createElement('div');host.className='pattern-block-editor';
 const source=document.createElement('div');source.className='field';
 source.innerHTML='<label>추출 대상</label><input list="varsHint">';
 source.querySelector('input').value=block.source||'input';
 source.querySelector('input').oninput=e=>{block.source=e.target.value;refreshOutputs()};
 const assignments=document.createElement('div'),hint=document.createElement('div');hint.className='hint';
 const refresh=()=>{
  const n=pCaptures(block.parts).length;
  if(!Array.isArray(block.names))block.names=[];
  while(block.names.length<n)block.names.push('part'+(block.names.length+1));
  block.names.length=n;assignments.replaceChildren();
  for(let i=0;i<n;i++){
   const row=document.createElement('div');row.className='field';
   const label=document.createElement('label');label.textContent='추출 '+(i+1)+' → 변수';
   const input=document.createElement('input');input.value=block.names[i];input.placeholder='변수명 (비우면 무시)';
   input.oninput=()=>{block.names[i]=input.value;refreshOutputs()};
   row.append(label,input);assignments.append(row);
  }
  hint.textContent='Lua pattern: '+pCompile(block.parts).lua;refreshOutputs();
 };
 const library=document.createElement('div');library.className='pattern-import-bar';
 const choose=document.createElement('select');choose.innerHTML='<option value="">저장된 패턴 선택</option>';
 (project.patterns||[]).forEach(t=>{const opt=document.createElement('option');opt.value=t.id;opt.textContent=t.title;choose.append(opt)});
 const load=document.createElement('button');load.textContent='복사해서 넣기';
 load.onclick=()=>{const t=(project.patterns||[]).find(t=>t.id===choose.value);if(!t){alert('패턴을 선택하세요.');return}
  block.title=t.title;block.parts=copy(t.parts);block.names=pCaptures(block.parts).map((_,i)=>'part'+(i+1));redraw()
 };
 library.append(choose,load);
 host.append(library,source,pPartsEditor(block.parts,refresh),assignments,hint);refresh();return host;
}
let activePattern=null;
function renderPatternLibrary(){
 if(!Array.isArray(project.patterns))project.patterns=[];
 const list=$('#patternLibraryList');list.replaceChildren();
 project.patterns.forEach(t=>{
  const row=document.createElement('div');row.className='pattern-template';
  const title=document.createElement('strong');title.textContent=t.title;
  const edit=document.createElement('button');edit.textContent='편집';edit.onclick=()=>{activePattern=t.id;renderPatternLibrary()};
  const clone=document.createElement('button');clone.textContent='복제';clone.onclick=()=>{const c=copy(t);c.id=uid();c.title+=' 복사본';project.patterns.push(c);activePattern=c.id;renderPatternLibrary()};
  const del=document.createElement('button');del.textContent='삭제';del.onclick=()=>{if(!confirm('패턴을 삭제할까요? 이미 복사한 블록은 유지됩니다.'))return;project.patterns=project.patterns.filter(x=>x.id!==t.id);if(activePattern===t.id)activePattern=null;renderPatternLibrary()};
  row.append(title,edit,clone,del);list.append(row);
 });
 const t=project.patterns.find(x=>x.id===activePattern),host=$('#patternLibraryEditor');host.replaceChildren();
 if(!t){host.textContent='패턴을 선택하세요.';return}
 const name=document.createElement('div');name.className='field';name.innerHTML='<label>패턴 이름</label><input>';
 name.querySelector('input').value=t.title;name.querySelector('input').oninput=e=>{t.title=e.target.value;list.querySelectorAll('strong')[project.patterns.indexOf(t)].textContent=t.title};
 const sample=document.createElement('div');sample.className='field';sample.innerHTML='<label>샘플 입력</label><textarea></textarea>';
 sample.querySelector('textarea').value=t.sample||'';sample.querySelector('textarea').oninput=e=>{t.sample=e.target.value;preview()};
 const previewBox=document.createElement('div');previewBox.className='pattern-preview';
 previewBox.innerHTML='<b>추출 미리보기</b><pre id="patternPreview"></pre><details><summary>생성 Lua pattern</summary><code id="patternLua"></code></details>';
 function preview(){
  try{const compiled=pCompile(t.parts),result=String(t.sample||'').match(new RegExp(compiled.js));
   $('#patternPreview').textContent=result?(result.length>1?result.slice(1).map((v,i)=>(i+1)+' → '+JSON.stringify(v)).join('\n'):'일치함'):'일치하는 내용 없음';
   $('#patternLua').textContent=compiled.lua;
  }catch(e){$('#patternPreview').textContent=e.message}
 }
 const actions=document.createElement('div');actions.className='pattern-template-actions';
 const main=document.createElement('button');main.textContent='조립에 복사';main.onclick=()=>{project.flow.push(pBlock(t));redraw();toPage('builder')};
 const select=document.createElement('select');select.innerHTML='<option value="">함수 선택</option>';
 project.functions.forEach(f=>{const o=document.createElement('option');o.value=f.id;o.textContent=f.name;select.append(o)});
 const addFn=document.createElement('button');addFn.textContent='내 함수에 복사';addFn.onclick=()=>{const f=project.functions.find(f=>f.id===select.value);if(!f){alert('함수를 선택하세요.');return}f.flow.push(pBlock(t));activeFn=f.id;redraw();toPage('functions')};
 actions.append(main,select,addFn);
 host.append(name,sample,pPartsEditor(t.parts,preview),previewBox,actions);preview();
}
$('#newPattern').onclick=()=>{if(!Array.isArray(project.patterns))project.patterns=[];const t=pTemplate();project.patterns.push(t);activePattern=t.id;renderPatternLibrary()};
