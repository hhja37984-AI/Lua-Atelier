function codeFlow(arr,vars,level,context){const lines=[],indent='    '.repeat(level),fnIDs=new Map(project.functions.map(f=>[f.id,f]));for(const b of arr){let a=k=>atom(b[k],vars),out=b.name||'result';switch(b.type){
case'literal':lines.push(assign(b.name,b.valueType==='string'?q(b.value):b.valueType==='boolean'?(String(b.value).toLowerCase()==='true'?'true':'false'):(Number.isFinite(Number(b.value))?String(Number(b.value)):'0'),vars,indent));break;
case'stateRead':lines.push(assign(out,`state[${q(b.key)}]`,vars,indent));lines.push(indent+`if ${out} == nil then ${out} = ${a('fallback')} end`);break;
case'stateSet':lines.push(indent+`state[${q(b.key)}] = ${a('value')}`,indent+`setState(triggerId, ${q(project.stateKey)}, state)`);break;
case'calc':lines.push(assign(out,`(${a('a')} ${['+','-','*','/','%','^'].includes(b.op)?b.op:'+'} ${a('b')})`,vars,indent));break;
case'clamp':lines.push(assign(out,`math.max(${a('min')},math.min(${a('max')},${a('value')}))`,vars,indent));break;
case'random':lines.push(assign(out,`math.random(${a('min')},${a('max')})`,vars,indent));break;
case'chance':lines.push(assign(out,`math.random()*100 < ${a('percent')}`,vars,indent));break;
case'weighted':{let items=String(b.items).split(/\n/).map(x=>x.split(':')).filter(x=>x.length>=2).map(([v,w])=>`{${q(v.trim())},${Math.max(0,Number(w)||0)}}`).join(',');lines.push(assign(out,`__weighted({${items}})`,vars,indent));break;}
case'date':{let expr=b.mode==='diff'?`__dateDiff(${a('a')},${a('b')})`:b.mode==='add'?`__dateAdd(${a('a')},${a('b')})`:`(__parseDate(${a('a')}) or {})[${q(b.mode==='year'?'y':b.mode==='month'?'m':'d')}]`;lines.push(assign(out,expr,vars,indent));break;}
case'split':{let names=b.names.split(',').map(x=>x.trim()).filter(Boolean);let tmp='__pieces_'+b.id;lines.push(indent+`local ${tmp} = __split(tostring(${a('source')} or ""), ${q(b.separator)})`);names.forEach((n,i)=>lines.push(assign(n,`${tmp}[${i+1}] or ""`,vars,indent)));break;}
case'extract':lines.push(assign(out,`__between(tostring(${a('source')} or ""),${q(b.start)},${q(b.end)})`,vars,indent));break;
case'slice':lines.push(assign(out,`string.sub(tostring(${a('source')} or ""),${a('start')},(${a('start')})+(${a('length')})-1)`,vars,indent));break;
case'pattern':{let names=b.parts.map(x=>x.name.trim()).filter(Boolean);let pat=luaPattern(b.parts);let captures=[];let raw='^'+b.parts.map(p=>{let sub=luaPattern([p]).slice(1,-1);return p.name.trim()?'('+sub+')':sub}).join('')+'$';let tmp='__parts_'+b.id;lines.push(indent+`local ${tmp} = {string.match(tostring(${a('source')} or ""),${q(raw)})}`);names.forEach((n,i)=>lines.push(assign(n,`${tmp}[${i+1}] or ""`,vars,indent)));break;}
case'patternUse':{
 const pat=pCompile(b.parts).lua, captures=pCaptures(b.parts);
 const tmp='__match_'+b.id;
 lines.push(indent+'local '+tmp+' = {string.match(tostring('+a('source')+' or ""), '+q(pat)+')}');
 const names=Array.isArray(b.names)?b.names:[];
 captures.forEach((_,i)=>{const n=String(names[i]||'').trim();if(n)lines.push(assign(n,tmp+'['+(i+1)+'] or ""',vars,indent))});
 break;
}
case'map':{let vals=String(b.items).split(/\n/).map(s=>s.split('=')).filter(s=>s.length>=2).map(([k,...v])=>`[${q(k.trim())}] = ${atom(v.join('=').trim(),new Set())}`);lines.push(assign(out,`({${vals.join(',')}})[tostring(${a('source')})] or ${a('fallback')}`,vars,indent));break;}
case'replace':lines.push(assign(out,`__replace(tostring(${a('source')} or ""),${q(b.find)},${q(b.replacement)},${b.mode==='plain'?'true':'false'})`,vars,indent));break;
case'output':lines.push(indent+`data = ${b.mode==='replace'?txtExpr(b.template,vars):'data .. '+txtExpr(b.template,vars)}`);break;
case'alert':lines.push(indent+`${b.level==='error'?'alertError':'alertNormal'}(triggerId, ${q(b.message)})`);break;
case'removeChat':lines.push(indent+'local __n = getChatLength(triggerId)',indent+'if __n > 0 then removeChat(triggerId,__n-1) end');break;
case'stop':lines.push(indent+'stopChat(triggerId)');break;
case'call':{const f=fnIDs.get(b.fn);let args=String(b.args).split(',').map(x=>x.trim()).filter(Boolean).map(x=>atom(x,vars));if(f)lines.push(assign(out,`__fn_${f.id}(${args.join(', ')})`,vars,indent));else lines.push(indent+'-- 함수 미선택');break;}
case'log':lines.push(indent+`log(${a('value')})`);break;
case'return':lines.push(indent+`return ${a('value')}`);break;
case'if':{let expr=b.conditions.map(c=>{let l=atom(c.left,vars),r=atom(c.right,vars);if(c.op==='contains')return `string.find(tostring(${l}),tostring(${r}),1,true) ~= nil`;if(c.op==='starts')return `string.sub(tostring(${l}),1,#tostring(${r})) == tostring(${r})`;if(c.op==='ends')return `string.sub(tostring(${l}),-#tostring(${r})) == tostring(${r})`;if(c.op==='truthy')return `(${l} ~= false and ${l} ~= nil)`;return `${l} ${c.op} ${r}`}).join(b.mode==='any'?' or ':' and ')||'true';lines.push(indent+'if '+expr+' then');lines.push(...codeFlow(b.yes,new Set(vars),level+1,context));if(b.no.length){lines.push(indent+'else');lines.push(...codeFlow(b.no,new Set(vars),level+1,context))}lines.push(indent+'end');break;}
}}
return lines;}
const HELPERS=String.raw`local function __split(s, sep)
    local result = {}
    if sep == "" then return {s} end
    local pos = 1
    while true do
        local i,j = string.find(s,sep,pos,true)
        if not i then table.insert(result,string.sub(s,pos)); break end
        table.insert(result,string.sub(s,pos,i-1)); pos = j+1
    end
    return result
end
local function __between(s, a, b)
    local i = a == "" and 1 or (string.find(s,a,1,true) or -1)
    if i < 1 then return "" end
    local pos = i + #a
    local j = b == "" and (#s + 1) or (string.find(s,b,pos,true) or -1)
    if j < 0 then return "" end
    return string.sub(s,pos,j-1)
end
local function __replace(s, search, replacement, plain)
    if search == "" then return s end
    if plain then
        local out,at = {},1
        while true do
            local i,j = string.find(s,search,at,true)
            if not i then out[#out+1] = string.sub(s,at); break end
            out[#out+1] = string.sub(s,at,i-1)
            out[#out+1] = replacement
            at = j+1
        end
        return table.concat(out)
    end
    return (string.gsub(s,search,function() return replacement end))
end
local function __weighted(items)
    local total = 0
    for _,v in ipairs(items) do total = total + math.max(0,v[2]) end
    if total <= 0 then return nil end
    local pick = math.random()*total
    for _,v in ipairs(items) do pick = pick - math.max(0,v[2]); if pick <= 0 then return v[1] end end
    return items[#items][1]
end
local function __parseDate(s)
    local y,m,d = tostring(s or ""):match("^(%d%d%d%d)[%-%/](%d%d?)[%-%/](%d%d?)$")
    y,m,d=tonumber(y),tonumber(m),tonumber(d)
    if not y or not m or not d or m<1 or m>12 or d<1 or d>31 then return nil end
    return {y=y,m=m,d=d}
end
local function __days(y,m,d)
    y=y-(m<=2 and 1 or 0)
    local era=math.floor(y/400); local yoe=y-era*400
    local mp=m+(m>2 and -3 or 9)
    return era*146097+yoe*365+math.floor(yoe/4)-math.floor(yoe/100)+math.floor((153*mp+2)/5)+d-1
end
local function __dateDiff(a,b)
    a,b=__parseDate(a),__parseDate(b)
    if not a or not b then return nil end
    return __days(b.y,b.m,b.d)-__days(a.y,a.m,a.d)
end
local function __dateAdd(s,n)
    local dt=__parseDate(s); if not dt then return nil end
    local target=__days(dt.y,dt.m,dt.d)+math.floor(tonumber(n) or 0)
    local lo,hi=1,9999
    while lo<=hi do
        local y=math.floor((lo+hi)/2)
        if target<__days(y,1,1) then hi=y-1
        elseif target>=__days(y+1,1,1) then lo=y+1
        else
            local m=1
            while m<12 and target>=__days(y,m+1,1) do m=m+1 end
            return string.format("%04d-%02d-%02d",y,m,target-__days(y,m,1)+1)
        end
    end
    return nil
end`;
function buildLua(){const isEdit=project.trigger.startsWith('edit');const parts=['-- Risu Lua Atelier v0.4',''];let flows=[project.flow,...project.functions.map(f=>f.flow)];const hasType=t=>flows.some(f=>JSON.stringify(f).includes('"type":"'+t+'"'));if(['split','extract','replace','weighted','date'].some(hasType)||project.workflow?.enabled)parts.push(HELPERS,'');
if(isEdit)parts.push(`listenEdit(${q(project.trigger)}, function(triggerId, data)`);else parts.push(`function ${project.trigger}(triggerId)`);
parts.push('    local input = data or ""');if(!isEdit)parts.push('    local chat = getFullChat(triggerId) or {}','    input = chat[#chat] and chat[#chat].data or ""','    local data = input');
parts.push(`    local state = getState(triggerId, ${q(project.stateKey)}) or {}`);
for(const f of project.functions){let params=String(f.params).split(',').map(x=>x.trim()).filter(Boolean);let vars=new Set(['input',...params]);parts.push(`    local function __fn_${f.id}(${params.map(x=>validName(x)?x:'invalid').join(', ')})`);parts.push(...codeFlow(f.flow,vars,2,'function'));parts.push('        return '+atom(f.returns,vars));parts.push('    end');}
if(project.workflow?.enabled)parts.push(...workflowLuaCode(project.workflow));parts.push(...codeFlow(project.flow,new Set(['input','data']),1,'main'));if(isEdit)parts.push('    return data');parts.push('end'+(isEdit?')':''));if(project.workflow?.widgetEnabled)parts.push(...widgetLuaCode(project.workflow));return parts.join('\n');}
function diagnose(){let errors=[];let inspect=(arr,ctx,known)=>{for(const b of arr){let names=[];if(b.name)names.push(b.name);if(b.type==='split')names.push(...b.names.split(',').map(x=>x.trim()).filter(Boolean));if(b.type==='pattern')names.push(...b.parts.map(x=>x.name).filter(Boolean));if(b.type==='patternUse')names.push(...(b.names||[]).filter(Boolean));for(const n of names)if(!validName(n))errors.push('변수 이름 확인: '+n);names.forEach(x=>known.add(x));if(b.type==='stateSet'&&!project.stateKey)errors.push('State key가 비어 있습니다.');if(b.type==='call'){let f=project.functions.find(x=>x.id===b.fn);if(!f)errors.push('내 함수 호출: 함수를 선택하세요.');else if(b.args.split(',').filter(x=>x.trim()).length!==f.params.split(',').filter(x=>x.trim()).length)errors.push('함수 '+f.name+': 입력 인자 수를 확인하세요.');}if(b.type==='output'&&!project.trigger.startsWith('edit'))errors.push('텍스트 출력은 edit 트리거에서 사용하세요.');if(b.type==='if'){inspect(b.yes,ctx,new Set(known));inspect(b.no,ctx,new Set(known))}if(b.type==='return'&&ctx==='main')errors.push('함수 반환 블록은 내 함수 안에 배치하세요.');if(b.type==='pattern'&&b.parts.length===0)errors.push('패턴 추출: 문자 규칙을 추가하세요.');if(b.type==='patternUse'){if(!Array.isArray(b.parts)||!b.parts.length)errors.push('추출 패턴: 문자 규칙을 추가하세요.');if((b.names||[]).length!==pCaptures(b.parts).length)errors.push('추출 패턴: 변수 배정 개수를 확인하세요.');}}};
inspect(project.flow,'main',new Set(['input','data']));for(const f of project.functions){if(!validName(f.name))errors.push('함수 이름 확인: '+f.name);let params=f.params.split(',').map(x=>x.trim()).filter(Boolean);params.filter(x=>!validName(x)).forEach(x=>errors.push('입력 인자 이름 확인: '+x));inspect(f.flow,'function',new Set(params));}
if(project.workflow?.enabled){const w=project.workflow;if(w.dateFormat==='custom'&&(!w.datePattern||pCaptures(w.datePattern.parts).length<Math.max(w.dayIndex,w.monthIndex,w.yearIndex)))errors.push('RP 날짜: 사용자 정의 패턴의 연·월·일 추출 번호를 확인하세요.');if(!Number.isInteger(Number(w.interval))||Number(w.interval)<1)errors.push('RP 이벤트: 간격은 1 이상의 정수여야 합니다.');if(w.action!=='none'&&!validName(String(w.valueKey||'')))errors.push('RP 이벤트: 결과 State 변수명을 확인하세요.');if(w.action==='random'&&Number(w.min)>Number(w.max))errors.push('RP 이벤트: 난수 최솟값이 최댓값보다 큽니다.');}return [...new Set(errors)];}
