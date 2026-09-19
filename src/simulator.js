function parseScalar(x,vars){const s=String(x??'').trim();if(Object.prototype.hasOwnProperty.call(vars,s))return vars[s];if(s==='true')return true;if(s==='false')return false;if(s==='nil')return null;if(/^-?(?:\d+\.?\d*|\.\d+)$/.test(s))return +s;return x;}
function testFlow(arr,vars,st,logs,depth=0){if(depth>20)throw Error('함수 호출 깊이 제한 (20)');for(const b of arr){let a=k=>parseScalar(b[k],vars);switch(b.type){
case'literal':vars[b.name]=b.valueType==='number'?Number(b.value):b.valueType==='boolean'?b.value==='true':b.value;break;
case'stateRead':vars[b.name]=st[b.key]??a('fallback');break;
case'stateSet':st[b.key]=a('value');logs.push(`State.${b.key} ← ${JSON.stringify(st[b.key])}`);break;
case'calc':{let x=Number(a('a')),y=Number(a('b'));vars[b.name]=b.op==='+'?x+y:b.op==='-'?x-y:b.op==='*'?x*y:b.op==='/'?x/y:b.op==='%'?x%y:x**y;break;}
case'clamp':vars[b.name]=Math.max(Number(a('min')),Math.min(Number(a('max')),Number(a('value'))));break;
case'random':vars[b.name]=Math.floor(Math.random()*(Number(a('max'))-Number(a('min'))+1))+Number(a('min'));break;
case'chance':vars[b.name]=Math.random()*100<Number(a('percent'));break;
case'weighted':{const arr=b.items.split('\n').map(x=>x.split(':')).filter(x=>x.length>=2).map(([v,w])=>[v.trim(),Math.max(0,Number(w)||0)]);let total=arr.reduce((n,x)=>n+x[1],0),r=Math.random()*total;vars[b.name]=null;for(const [v,w]of arr){r-=w;if(r<=0){vars[b.name]=v;break}}break;}
case'split':{const s=String(a('source')??''),sep=b.separator,parts=sep?s.split(sep):[s];b.names.split(',').map(x=>x.trim()).filter(Boolean).forEach((n,i)=>vars[n]=parts[i]??'');break;}
case'extract':{let s=String(a('source')??''),i=b.start?s.indexOf(b.start):0;i=i<0?-1:i+b.start.length;let j=i<0?-1:(b.end?s.indexOf(b.end,i):s.length);vars[b.name]=i<0||j<0?'':s.slice(i,j);break;}
case'slice':vars[b.name]=String(a('source')??'').slice(Number(a('start'))-1,Number(a('start'))-1+Number(a('length')));break;
case'pattern':{logs.push('패턴 추출: Lua pattern은 실제 RisuAI에서 확인하세요.');break;}
case'patternUse':{
 const pattern=pCompile(b.parts);
 const result=String(a('source')??'').match(new RegExp(pattern.js));
 const captures=result?result.slice(1):[];
 const names=Array.isArray(b.names)?b.names:[];
 for(let i=0;i<captures.length;i++){const name=String(names[i]||'').trim();if(name)vars[name]=captures[i]??''}
 for(let i=captures.length;i<names.length;i++){const name=String(names[i]||'').trim();if(name)vars[name]=''}
 logs.push('추출 패턴: '+(result?'일치':'불일치'));
 break;
}
case'map':{const map=Object.fromEntries(b.items.split('\n').map(x=>x.split('=')).filter(x=>x.length>=2).map(([k,...v])=>[k.trim(),parseScalar(v.join('=').trim(),{})]));vars[b.name]=map[String(a('source'))]??a('fallback');break;}
case'replace':vars[b.name]=b.mode==='plain'?String(a('source')??'').split(b.find).join(b.replacement):String(a('source')??'');if(b.mode==='pattern')logs.push('Lua pattern 치환은 실제 RisuAI에서 확인하세요.');break;
case'date':{const d=s=>{let m=String(s).match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);if(!m)return null;let dt=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));return dt.getUTCFullYear()===+m[1]&&dt.getUTCMonth()+1===+m[2]&&dt.getUTCDate()===+m[3]?dt:null};let x=d(a('a')),y=d(a('b'));vars[b.name]=b.mode==='diff'?(x&&y?Math.round((y-x)/86400000):null):b.mode==='add'?(x?(x.setUTCDate(x.getUTCDate()+Number(a('b'))),x.toISOString().slice(0,10)):null):x?(b.mode==='year'?x.getUTCFullYear():b.mode==='month'?x.getUTCMonth()+1:x.getUTCDate()):null;break;}
case'if':{let tests=b.conditions.map(c=>{let l=parseScalar(c.left,vars),r=parseScalar(c.right,vars);switch(c.op){case'==':return l===r;case'~=':return l!==r;case'>':return l>r;case'>=':return l>=r;case'<':return l<r;case'<=':return l<=r;case'contains':return String(l).includes(String(r));case'starts':return String(l).startsWith(String(r));case'ends':return String(l).endsWith(String(r));case'truthy':return l!==false&&l!=null;default:return false}});let yes=b.mode==='any'?tests.some(Boolean):tests.every(Boolean);logs.push(`조건 ${yes?'참':'거짓'} → ${yes?'참일 때':'거짓일 때'}`);let result=testFlow(yes?b.yes:b.no,vars,st,logs,depth+1);if(result?.returned)return result;break;}
case'call':{let f=project.functions.find(x=>x.id===b.fn);if(!f)break;let params=f.params.split(',').map(x=>x.trim()).filter(Boolean),args=b.args.split(',').map(x=>x.trim()),local={...vars};params.forEach((p,i)=>local[p]=parseScalar(args[i],vars));let result=testFlow(f.flow,local,st,logs,depth+1);vars[b.name]=result?.returned?result.value:parseScalar(f.returns,local);break;}
case'return':return {returned:true,value:a('value')};case'output':{let text=b.template.replace(/\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g,(_,k)=>String(vars[k]??''));vars.data=b.mode==='replace'?text:vars.data+text;break;}
case'alert':logs.push('알림: '+b.message);break;case'log':logs.push('log: '+JSON.stringify(a('value')));break;case'removeChat':logs.push('최근 채팅 삭제 예정');break;case'stop':logs.push('생성 중단 요청 예정');break;
}}return null;}
$('#testRun').onclick=()=>{try{let st=JSON.parse($('#testState').value);if(!st||Array.isArray(st)||typeof st!=='object')throw Error('State JSON은 객체여야 합니다.');let vars={input:$('#testText').value,data:$('#testText').value},logs=[];testFlow(project.flow,vars,st,logs);$('#testResult').textContent=['실행 순서',...logs,'','변수',JSON.stringify(vars,null,2),'','State',JSON.stringify(st,null,2),project.trigger.startsWith('edit')?'\n출력\n'+vars.data:''].join('\n')}catch(e){$('#testResult').textContent='오류: '+e.message}};
