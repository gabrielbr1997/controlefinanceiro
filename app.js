(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const MONTHS=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const MS=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const EXP=['Alimentação','Transporte','Moradia','Contas','Saúde','Lazer','Educação','Outros'];
const INC=['Salário','Freelance','Investimentos','Outros'];
const ALLC=[...new Set([...EXP,...INC])];
const CI={'Alimentação':'food','Transporte':'car','Moradia':'home','Contas':'bolt','Saúde':'heart','Lazer':'ticket','Educação':'book','Salário':'cash','Freelance':'briefcase','Investimentos':'trend','Outros':'tag'};
const KW={'Alimentação':['alimenta','comida','mercado','restaurante','almoco','jantar','feira'],'Transporte':['transporte','uber','combustivel','gasolina','onibus','corrida'],'Moradia':['moradia','aluguel','condominio'],'Contas':['contas','luz','agua','internet','telefone'],'Saúde':['saude','farmacia','consulta','remedio'],'Lazer':['lazer','cinema','streaming','diversao'],'Educação':['educacao','curso','escola','faculdade']};

/* ---------- utilidades ---------- */
const pad=n=>String(n).padStart(2,'0');
const r2=x=>Math.round((x+Number.EPSILON)*100)/100;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dstr=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const today=()=>dstr(new Date());
const mkey=d=>dstr(d).slice(0,7);
const addM=(k,n)=>{const [y,m]=k.split('-').map(Number);return mkey(new Date(y,m-1+n,1))};
const mLabel=k=>{const [y,m]=k.split('-').map(Number);return MONTHS[m-1]+' de '+y};
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const shiftDay=(s,n)=>{const [y,m,d]=s.split('-').map(Number);return dstr(new Date(y,m-1,d+n))};
const norm=s=>String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const reduce=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const ico=(n,c)=>'<svg class="ic '+(c||'')+'" aria-hidden="true"><use href="#i-'+n+'"/></svg>';
function dLabel(s){
  if(s===today())return 'Hoje';
  if(s===shiftDay(today(),-1))return 'Ontem';
  const [y,m,d]=s.split('-').map(Number);
  return d+' '+MS[m-1]+(y!==new Date().getFullYear()?' '+y:'');
}
function dLong(s){
  const [y,m,d]=s.split('-').map(Number), base=d+' de '+MONTHS[m-1]+(y!==new Date().getFullYear()?' de '+y:'');
  if(s===today())return 'Hoje · '+base;
  if(s===shiftDay(today(),-1))return 'Ontem · '+base;
  return base;
}
const validDate=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||s<'2000-01-01'||s>'2100-12-31')return false;const [y,m,d]=s.split('-').map(Number);return dstr(new Date(y,m-1,d))===s};
const BRL=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
function parseMoney(s){s=String(s).trim().replace(/R\$\s?/i,'').replace(/\s/g,'');if(!s)return NaN;if(/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s))s=s.replace(/\./g,'').replace(',','.');else s=s.replace(',','.');if(!/^\d+(\.\d{1,2})?$/.test(s))return NaN;return r2(parseFloat(s))}
const numIn=v=>r2(v).toFixed(2).replace('.',',');

/* ---------- dados ---------- */
const cmp=(a,b)=>b.date.localeCompare(a.date)||b.ts-a.ts;
function emptyState(){return{v:2,name:'',hide:false,limit:null,opening:0,onboarded:false,month:mkey(new Date()),simFail:false,chat:[],tx:[],goals:[]}}
let S=emptyState();

/* ---------- conta (Supabase) e sincronização ---------- */
const CFG=window.FLUXO_CONFIG||{};
const SB={url:String(CFG.supabaseUrl||'').trim().replace(/\/+$/,''),key:String(CFG.supabaseAnonKey||'').trim()};
const DEV=/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
function keyIsSecret(k){
  if(/^sb_secret_/.test(k))return true;
  try{const p=JSON.parse(atob(k.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return p.role==='service_role'}catch(e){return false}
}
const SECRETKEY=!!SB.key&&keyIsSecret(SB.key);
const configured=()=>(/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(SB.url)||(DEV&&/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(SB.url)))&&SB.key.length>20&&!SECRETKEY;
const LOCAL=!configured();
let session=null;
const SKEY='fluxo.session';
const readSession=()=>{try{const s=JSON.parse(localStorage.getItem(SKEY));if(s&&s.access_token&&s.refresh_token&&s.user&&s.user.id)return s}catch(e){}return null};
function writeSession(x){session=x;try{if(x)localStorage.setItem(SKEY,JSON.stringify(x));else localStorage.removeItem(SKEY)}catch(e){}}
const toSession=(j,user)=>{
  if(!j||!j.access_token)return null;
  const u=user||j.user||{};
  return{access_token:j.access_token,refresh_token:j.refresh_token,expires_at:Number(j.expires_at)||Math.floor(Date.now()/1000)+(Number(j.expires_in)||3600),user:{id:u.id,email:u.email||''}};
};
async function api(path,o){
  o=o||{};
  const h={apikey:SB.key,'Content-Type':'application/json'};
  if(o.token)h.Authorization='Bearer '+o.token;
  Object.assign(h,o.headers||{});
  const r=await fetch(SB.url+path,{method:o.method||'GET',headers:h,body:o.body?JSON.stringify(o.body):undefined});
  let j=null;try{j=await r.json()}catch(e){}
  if(!r.ok){
    const e=new Error((j&&(j.msg||j.message||j.error_description||j.error))||('HTTP '+r.status));
    e.status=r.status;e.code=(j&&(j.error_code||j.code))||'';throw e;
  }
  return j;
}
function authErr(e){
  const c=String((e&&e.code)||''),m=String((e&&e.message)||'');
  if(e instanceof TypeError||!navigator.onLine)return 'Sem conexão com a internet. Tente de novo.';
  if(c==='invalid_credentials'||/invalid login credentials/i.test(m))return 'E-mail ou senha incorretos.';
  if(c==='email_not_confirmed'||/not confirmed/i.test(m))return 'Confirme seu e-mail antes de entrar. Veja a caixa de entrada e o spam.';
  if(c==='user_already_exists'||/already registered/i.test(m))return 'Este e-mail já tem conta. Use a aba Entrar.';
  if(c==='weak_password'||(/password/i.test(m)&&e.status===422))return 'Senha fraca. Use 8 ou mais caracteres, misturando letras e números.';
  if(c==='same_password')return 'A nova senha deve ser diferente da atual.';
  if(e.status===429||/rate limit/i.test(c+m))return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  return 'Não foi possível concluir agora. Tente novamente em instantes.';
}
const sync={rev:0,dirty:false,busy:false,t:null,last:'',remoteAt:null,state:'ok'};
const stable=o=>JSON.stringify(o,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.keys(v).sort().reduce((a,x)=>(a[x]=v[x],a),{}):v);
const cloudData=()=>{const o=Object.assign({},S);delete o.chat;delete o.month;delete o.simFail;return o};
const validRemote=d=>!!d&&typeof d==='object'&&Array.isArray(d.tx)&&Array.isArray(d.goals);
function save(){
  if(!session)return;
  try{localStorage.setItem('fluxo.data.'+session.user.id,JSON.stringify(S))}catch(e){}
  if(LOCAL)return;
  try{localStorage.setItem('fluxo.dirty.'+session.user.id,'1')}catch(e){}
  sync.rev++;sync.dirty=true;schedulePush(700);
}
function schedulePush(ms){clearTimeout(sync.t);sync.t=setTimeout(push,ms)}
function paintSync(){
  const txt={saving:'Salvando…',ok:'Tudo salvo na sua conta.',offline:'Sem conexão. As alterações ficam neste aparelho e serão enviadas quando a internet voltar.',error:'Não foi possível salvar agora. Vamos tentar de novo em instantes.'}[sync.state]||'';
  const st=$('#sync-st');if(st)st.textContent=txt;
  const top=$('#sync-top');if(top)top.textContent=sync.state==='offline'?'Sem conexão · alterações guardadas no aparelho':sync.state==='error'?'Não foi possível salvar na nuvem agora':'';
}
async function push(){
  if(!session||LOCAL||sync.busy||!sync.dirty)return;
  const payload=cloudData(),str=stable(payload),r=sync.rev;
  if(str===sync.last){sync.dirty=false;try{localStorage.removeItem('fluxo.dirty.'+session.user.id)}catch(e){}return}
  sync.busy=true;sync.state='saving';paintSync();
  try{
    const tok=await ensureToken();
    await api('/rest/v1/user_data?on_conflict=user_id',{method:'POST',token:tok,headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:{user_id:session.user.id,data:payload}});
    sync.last=str;sync.state='ok';
    if(sync.rev===r){sync.dirty=false;try{localStorage.removeItem('fluxo.dirty.'+session.user.id)}catch(e){}}else schedulePush(300);
  }catch(e){
    sync.state=(e instanceof TypeError||!navigator.onLine)?'offline':'error';
    if(session)schedulePush(20000);
  }
  sync.busy=false;paintSync();
}
async function pull(){
  const tok=await ensureToken();
  const rows=await api('/rest/v1/user_data?select=data,updated_at&user_id=eq.'+encodeURIComponent(session.user.id),{token:tok});
  return Array.isArray(rows)&&rows[0]?rows[0]:null;
}
function adopt(row){
  const keep=S.chat||[];
  S=Object.assign(emptyState(),row.data,{chat:keep,month:mkey(new Date()),simFail:false});
  sync.last=stable(cloudData());sync.remoteAt=row.updated_at;
  try{localStorage.setItem('fluxo.data.'+session.user.id,JSON.stringify(S))}catch(e){}
}
async function ensureToken(){
  if(!session)throw new Error('sem sessão');
  if(session.expires_at-Math.floor(Date.now()/1000)>60)return session.access_token;
  try{
    const j=await api('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}});
    writeSession(toSession(j,session.user));
  }catch(e){
    if(e.status===400||e.status===401||e.status===403)dropSession('Sua sessão expirou. Entre novamente.',false);
    throw e;
  }
  return session.access_token;
}
function dropSession(msg,wipe){
  const id=session&&session.user&&session.user.id;
  writeSession(null);clearTimeout(sync.t);sync.dirty=false;sync.busy=false;
  if(wipe&&id)try{localStorage.removeItem('fluxo.data.'+id);localStorage.removeItem('fluxo.dirty.'+id)}catch(e){}
  S=emptyState();ui.pending=null;ui.loading=false;ui.loadErr=false;ui.auth={mode:'login',err:msg||null};
  ui.route='home';try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}
  closeSheet(true);render();
}
async function enterApp(){
  ui.auth=null;ui.loadErr=false;
  S=emptyState();sync.last='';sync.remoteAt=null;sync.rev=0;sync.state='ok';sync.dirty=false;
  let cached=null;
  try{const c=JSON.parse(localStorage.getItem('fluxo.data.'+session.user.id));if(validRemote(c)&&Array.isArray(c.chat))cached=Object.assign(emptyState(),c,{month:mkey(new Date()),simFail:false})}catch(e){}
  if(LOCAL){if(cached)S=cached;ui.loading=false;render();return}
  try{sync.dirty=localStorage.getItem('fluxo.dirty.'+session.user.id)==='1'}catch(e){}
  if(cached){S=cached;ui.loading=false}else ui.loading=true;
  render();
  try{
    const row=await pull();
    if(row&&validRemote(row.data)){
      sync.remoteAt=row.updated_at;
      if(sync.dirty&&cached){sync.last=stable(row.data);schedulePush(0)}
      else{adopt(row);sync.dirty=false}
    }else if(cached){sync.dirty=true;sync.last='';schedulePush(0)}
    sync.state='ok';
  }catch(e){
    if(!session)return;
    if(!cached)ui.loadErr=true;
    sync.state=(e instanceof TypeError||!navigator.onLine)?'offline':'error';
  }
  ui.loading=false;render();
}
async function doLogin(email,pw){const j=await api('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password:pw}});writeSession(toSession(j))}
async function doSignup(email,pw){const j=await api('/auth/v1/signup',{method:'POST',body:{email,password:pw}});if(j&&j.access_token){writeSession(toSession(j));return true}return false}
function authMsg(t,kind){const e=$('#a-msg');if(!e)return;e.textContent=t||'';e.className='authmsg '+(kind||'')}
function authBusy(b){const g=$('#a-go');if(!g)return;g.disabled=b;g.textContent=b?'Aguarde…':g.dataset.l}
async function authSubmit(){
  const a=ui.auth;if(!a||a.busy)return;
  const m=a.mode,em=$('#a-email'),pw=$('#a-pass'),p2=$('#a-pass2');
  const email=em?em.value.trim().toLowerCase():(a.email||''),pass=pw?pw.value:'';
  let bad=null;const flag=(id,msg)=>{setErr(id,msg);bad=bad||id};
  ['a-email','a-pass','a-pass2'].forEach(i=>setErr(i,null));
  if(em&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))flag('a-email','Informe um e-mail válido.');
  if(pw){if(!pass)flag('a-pass','Informe a senha.');else if((m==='signup'||m==='reset')&&pass.length<8)flag('a-pass','Use pelo menos 8 caracteres.')}
  if(m==='reset'&&p2&&p2.value!==pass)flag('a-pass2','As senhas não são iguais.');
  if(bad){$('#'+bad).focus();return}
  a.busy=true;authBusy(true);authMsg('');
  try{
    if(m==='login'){await doLogin(email,pass);await enterApp();return}
    if(m==='signup'){if(await doSignup(email,pass)){await enterApp();return}ui.auth={mode:'check',email};render();return}
    if(m==='forgot'){await api('/auth/v1/recover',{method:'POST',body:{email}});authMsg('Se este e-mail tiver conta, enviamos um link para criar uma nova senha.','ok');return}
    if(m==='reset'){await api('/auth/v1/user',{method:'PUT',token:session.access_token,body:{password:pass}});ui.auth=null;toast('Senha atualizada.');await enterApp();return}
  }catch(e){authMsg(authErr(e),'err')}
  finally{a.busy=false;authBusy(false)}
}
async function consumeAuthHash(){
  const raw=location.hash.replace(/^#/,'');
  if(!/(^|&)(access_token|error)=/.test(raw))return null;
  const p=new URLSearchParams(raw);
  try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}
  if(p.get('error')||!p.get('access_token'))return{error:true};
  try{
    const u=await api('/auth/v1/user',{token:p.get('access_token')});
    return{session:toSession({access_token:p.get('access_token'),refresh_token:p.get('refresh_token')||'',expires_at:p.get('expires_at'),expires_in:p.get('expires_in')},u),type:p.get('type')||''};
  }catch(e){return{error:true}}
}
function logoutAsk(){
  confirmSheet('Sair da conta',sync.dirty?'Há alterações que ainda não foram enviadas à nuvem. Se sair agora, elas serão perdidas.':'Você vai precisar entrar de novo para ver seus dados neste aparelho.','Sair',doLogout);
}
async function doLogout(){
  if(sync.dirty){try{await push()}catch(e){}}
  const tok=session&&session.access_token;
  try{if(tok)await api('/auth/v1/logout?scope=local',{method:'POST',token:tok})}catch(e){}
  dropSession(null,true);
}
function wipeAsk(){
  confirmSheet('Apagar meus dados','Isso apaga todas as suas transações, metas e configurações '+(LOCAL?'deste aparelho.':'da nuvem e deste aparelho. A sua conta de acesso continua existindo.')+' Não dá para desfazer.','Apagar tudo',doWipe);
}
async function doWipe(){
  try{
    if(!LOCAL){const tok=await ensureToken();await api('/rest/v1/user_data?user_id=eq.'+encodeURIComponent(session.user.id),{method:'DELETE',token:tok,headers:{Prefer:'return=minimal'}})}
  }catch(e){toast('Não foi possível apagar na nuvem agora. Tente de novo.');return}
  clearTimeout(sync.t);sync.dirty=false;sync.last='';sync.remoteAt=null;
  try{localStorage.removeItem('fluxo.data.'+session.user.id);localStorage.removeItem('fluxo.dirty.'+session.user.id)}catch(e){}
  S=emptyState();ui.pending=null;render();toast('Seus dados foram apagados.');
}
async function boot(){
  try{localStorage.removeItem('fluxo.v1')}catch(e){}
  ui.route=readRoute();ui.loading=true;render();
  if(LOCAL){session={user:{id:'local',email:''}};await enterApp();return}
  const cb=await consumeAuthHash();
  if(cb&&cb.error){writeSession(null);ui.loading=false;ui.auth={mode:'login',err:'Este link expirou ou já foi usado. Peça um novo em “Esqueci minha senha”.'};render();return}
  if(cb&&cb.session){writeSession(cb.session);if(cb.type==='recovery'){ui.loading=false;ui.auth={mode:'reset'};render();return}}
  else session=readSession();
  if(!session){ui.loading=false;ui.auth={mode:'login'};render();return}
  await enterApp();
}
document.addEventListener('visibilitychange',async()=>{
  if(document.visibilityState!=='visible'||!session||LOCAL||sync.busy||sync.dirty||ui.loading||ui.auth)return;
  try{
    const row=await pull();
    if(!row||!validRemote(row.data)||sync.dirty||!$('#sheetRoot').hidden)return;
    if(stable(row.data)!==sync.last&&row.updated_at!==sync.remoteAt){adopt(row);render()}else sync.remoteAt=row.updated_at;
  }catch(e){}
});
window.addEventListener('online',()=>{if(session&&!LOCAL&&sync.dirty){schedulePush(0)}});

const ui={route:'home',h:{q:'',type:'all',cat:'all',period:'month',from:'',to:''},pending:null,editId:null,skip:false,toastFn:null,auth:null,loading:false,loadErr:false};
const money=v=>S.hide?'R$ ••••':BRL.format(v);
const sgn=(t,v)=>(t==='income'?'+':'−')+' '+money(v);
const sum=a=>r2(a.reduce((t,x)=>t+x.amt,0));
const inMonth=k=>S.tx.filter(t=>t.date.startsWith(k));
const monthTotals=k=>{const l=inMonth(k);return{inc:sum(l.filter(t=>t.type==='income')),out:sum(l.filter(t=>t.type==='expense'))}};
const balance=()=>r2((S.opening||0)+S.tx.reduce((t,x)=>t+(x.type==='income'?x.amt:-x.amt),0));
function bounds(){const ms=S.tx.map(t=>t.date.slice(0,7)).concat(mkey(new Date())).sort();return[ms[0],ms[ms.length-1]]}
function groupCats(list){const by={};list.forEach(t=>by[t.cat]=r2((by[t.cat]||0)+t.amt));return Object.entries(by).sort((a,b)=>b[1]-a[1])}
const first=()=>(S.name.trim().split(/\s+/)[0])||'';
const initials=()=>{const w=S.name.trim().split(/\s+/).filter(Boolean);return((w[0]||'U')[0]+(w[1]?w[1][0]:'')).toUpperCase()};

/* ---------- assistente simulado ---------- */
/* Para conectar uma API real, troque o corpo de askAssistant por uma chamada ao seu servidor
   (enviando a pergunta e os dados necessários) e devolva {text, proposal?, action?}. */
async function askAssistant(q){
  await sleep(600+Math.random()*500);
  if(S.simFail)throw new Error('falha simulada');
  return answer(q);
}
const tm=v=>'⟦'+r2(v)+'⟧';
const fmt=t=>esc(t).replace(/⟦(-?[\d.]+)⟧/g,(_,n)=>money(parseFloat(n)));
function catFrom(n){for(const[c,ks]of Object.entries(KW))if(ks.some(k=>n.includes(k)))return c;return null}
function cleanDesc(s){return s.replace(/\b(r\$|reais|real)\b/gi,' ').replace(/^\s*(?:(?:gastei|paguei|comprei|recebi|ganhei|registre|registrar|lance|lancar|lançar|adicione|adicionar|uma?|o|a|um|de|do|da|no|na|em|com|para|pra)\s+)+/i,'').replace(/\s+(?:de|do|da|no|na|em|com|para|pra)\s*$/i,'').replace(/\s+/g,' ').trim()}
function parseEntry(q){
  const m=q.match(/(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/);if(!m)return null;
  const amt=parseMoney(m[1]);if(!(amt>0))return null;
  const n=norm(q),income=/(recebi|ganhei|entrou|caiu|salario|freela)/.test(n);
  const idx=q.indexOf(m[0]),after=cleanDesc(q.slice(idx+m[0].length)),before=cleanDesc(q.slice(0,idx));
  const cat=income?(n.includes('salario')?'Salário':n.includes('freela')?'Freelance':n.includes('invest')?'Investimentos':'Outros'):(catFrom(n)||'Outros');
  const desc=cap((after||before||cat).slice(0,60));
  return{type:income?'income':'expense',desc,amt,cat,date:/ontem/.test(n)?shiftDay(today(),-1):today()};
}
function answer(q){
  const n=norm(q),k=S.month,ml=mLabel(k),tot=monthTotals(k);
  const ex=inMonth(k).filter(t=>t.type==='expense'),inc=inMonth(k).filter(t=>t.type==='income');
  const last=[...S.tx].sort(cmp)[0];
  const snap=t=>({id:t.id,desc:t.desc,amt:t.amt,date:t.date,type:t.type});
  if(/(exclu|apag|remov|delet)/.test(n)&&/(ultim|anterior|mais recente)/.test(n)){
    if(!last)return{text:'Não há transações para excluir.'};
    return{text:'Posso excluir a transação mais recente. Confirma?',proposal:{kind:'delete',data:snap(last),status:'pending'}};
  }
  if(/(mud|troc|alter)/.test(n)&&/categoria/.test(n)&&/(ultim|anterior|mais recente)/.test(n)){
    if(!last)return{text:'Não há transações para alterar.'};
    const rest=n.replace(/categoria/g,' ');
    const target=ALLC.find(c=>rest.includes(norm(c)))||catFrom(rest);
    const ok=target&&(last.type==='income'?INC:EXP).includes(target);
    if(!ok)return{text:'Diga a nova categoria. Para “'+last.desc+'” as opções são: '+(last.type==='income'?INC:EXP).join(', ')+'.'};
    return{text:'Posso mudar a categoria da transação mais recente. Confirma?',proposal:{kind:'recat',data:Object.assign(snap(last),{cat:target}),status:'pending'}};
  }
  if(/(gastei|paguei|comprei|recebi|ganhei|registr|lanc|adicion)/.test(n)&&!/^(quanto|qual|quais|como|onde)/.test(n)&&!q.includes('?')){
    const e=parseEntry(q);
    if(e)return{text:'Entendi o lançamento abaixo. Só registro depois da sua confirmação.',proposal:{kind:'add',data:e,status:'pending'}};
    return{text:'Qual foi o valor? Por exemplo: “gastei 45 no mercado”.'};
  }
  if(/(maior|mais cara|mais alta)/.test(n)&&/(despesa|gasto|compra)/.test(n)){
    if(!ex.length)return{text:'Não há despesas em '+ml+'.'};
    const b=[...ex].sort((a,c)=>c.amt-a.amt)[0];
    return{text:'Sua maior despesa em '+ml+' foi “'+b.desc+'”, de '+tm(b.amt)+' ('+b.cat+', '+dLabel(b.date)+').'};
  }
  if(/saldo/.test(n))return{text:'Seu saldo disponível é '+tm(balance())+'. Em '+ml+', entraram '+tm(tot.inc)+' e saíram '+tm(tot.out)+'.'};
  if(/(posso gastar|limite|sobra|restante|resta)/.test(n)){
    if(S.limit==null)return{text:'Você ainda não definiu um limite mensal. Defina um no planejamento para eu acompanhar.',action:'plan'};
    const rest=r2(S.limit-tot.out);
    if(rest<0)return{text:'Em '+ml+' você usou '+tm(tot.out)+' e passou do limite de '+tm(S.limit)+' em '+tm(-rest)+'.',action:'plan'};
    let t='Em '+ml+' você usou '+tm(tot.out)+' do limite de '+tm(S.limit)+'. Ainda restam '+tm(rest)+'.';
    if(k===mkey(new Date())){const now=new Date(),left=new Date(now.getFullYear(),now.getMonth()+1,0).getDate()-now.getDate()+1;t+=' Até o fim do mês dá cerca de '+tm(rest/left)+' por dia ('+left+' dias).'}
    return{text:t,action:'plan'};
  }
  const cat=catFrom(n);
  if(cat&&/(gast|despes|quanto)/.test(n)){
    const l=ex.filter(t=>t.cat===cat),v=sum(l);
    if(!l.length)return{text:'Não encontrei gastos com '+cat+' em '+ml+'.'};
    const p=tot.out?Math.round(v/tot.out*100):0,prev=sum(inMonth(addM(k,-1)).filter(t=>t.type==='expense'&&t.cat===cat));
    return{text:'Em '+ml+' você gastou '+tm(v)+' com '+cat+' ('+l.length+(l.length===1?' lançamento':' lançamentos')+', cerca de '+p+'% das despesas).'+(prev>0?' No mês anterior foram '+tm(prev)+'.':'')};
  }
  if(/(analis|resumo|resumir|panorama)/.test(n)){
    if(!ex.length)return{text:'Não há despesas em '+ml+' para analisar.'};
    const top=groupCats(ex).slice(0,3).map(([c,v])=>'• '+c+': '+tm(v)+' ('+Math.round(v/tot.out*100)+'%)').join('\n');
    const prev=monthTotals(addM(k,-1)).out;
    let t='Resumo de '+ml+':\n• Entradas: '+tm(tot.inc)+'\n• Despesas: '+tm(tot.out)+' em '+ex.length+' lançamentos\n\nPrincipais categorias:\n'+top;
    if(prev>0)t+='\n\nNo mês anterior as despesas fecharam em '+tm(prev)+'.';
    return{text:t};
  }
  if(/(planej|meta|economi|poupar|guardar)/.test(n)){
    let t='Planejamento de '+ml+':\n';
    t+=S.limit==null?'• Você ainda não definiu um limite de gastos.\n':'• Limite: '+tm(S.limit)+', com '+tm(tot.out)+' usados ('+Math.round(tot.out/S.limit*100)+'%).\n';
    t+=S.goals.length?S.goals.map(g=>'• '+g.name+': '+Math.round(g.saved/g.target*100)+'% de '+tm(g.target)).join('\n'):'• Nenhuma meta de economia criada.';
    return{text:t,action:'plan'};
  }
  if(/(receb|entrada|receita|ganh)/.test(n))return{text:'Em '+ml+' você recebeu '+tm(tot.inc)+' em '+inc.length+(inc.length===1?' entrada.':' entradas.')};
  if(/(quanto|total)/.test(n)&&/(gast|despes)/.test(n))return{text:'Em '+ml+' suas despesas somam '+tm(tot.out)+' em '+ex.length+' lançamentos.'};
  return{text:'Ainda não sei responder isso. Experimente:\n• “Quanto gastei com alimentação?”\n• “Qual foi minha maior despesa?”\n• “Quanto ainda posso gastar?”\n• “Gastei 45 no mercado”'};
}
async function ask(q,retry){
  q=q.trim();if(!q||(ui.pending&&ui.pending.state==='loading'))return;
  if(!retry){S.chat.push({id:uid(),role:'user',text:q.slice(0,300)});if(S.chat.length>60)S.chat=S.chat.slice(-60);save()}
  ui.pending={q,state:'loading'};paintLog();
  try{const r=await askAssistant(q);S.chat.push({id:uid(),role:'assistant',text:r.text,proposal:r.proposal||null,action:r.action||null});ui.pending=null;save()}
  catch(e){ui.pending={q,state:'error'}}
  if(ui.route==='chat')paintLog();
}
function propHtml(m){
  const p=m.proposal,d=p.data;let t='';
  if(p.kind==='add')t=(d.type==='income'?'Receita':'Despesa')+': “'+esc(d.desc)+'” · '+money(d.amt)+' · '+esc(d.cat)+' · '+dLabel(d.date);
  else if(p.kind==='delete')t='Excluir “'+esc(d.desc)+'” ('+money(d.amt)+', '+dLabel(d.date)+')';
  else t='Mudar a categoria de “'+esc(d.desc)+'” para '+esc(d.cat);
  const done={done:{add:'Registrado.',delete:'Excluído.',recat:'Categoria atualizada.'}[p.kind],cancelled:'Cancelado.',gone:'Esta transação não existe mais.'};
  const body=p.status==='pending'
    ?'<div class="pb"><button class="btn btn-p sm" data-act="prop-ok" data-id="'+m.id+'">Confirmar</button><button class="btn btn-s sm" data-act="prop-no" data-id="'+m.id+'">Cancelar</button></div>'
    :'<div class="lbl">'+esc(done[p.status]||'')+'</div>';
  return '<div class="prop"><div class="pt">Confirmação necessária</div><div>'+t+'</div>'+body+'</div>';
}
function paintLog(){
  const log=$('#log');if(!log)return;
  let h=S.chat.map(m=>{
    if(m.role==='user')return '<div class="msg u">'+esc(m.text)+'</div>';
    let x='<div class="msg a">'+fmt(m.text)+'</div>';
    if(m.proposal)x+=propHtml(m);
    if(m.action==='plan')x+='<button class="btn btn-s sm" data-act="go" data-r="plan">Abrir planejamento</button>';
    return '<div class="grp">'+x+'</div>';
  }).join('');
  const p=ui.pending;
  if(p&&p.state==='loading')h+='<div class="grp"><div class="msg a"><span class="typing" aria-hidden="true"><i></i><i></i><i></i></span><span class="sr">O assistente está respondendo</span></div></div>';
  if(p&&p.state==='error')h+='<div class="grp"><div class="msg a e">Não consegui obter a resposta agora. Verifique a conexão e tente de novo.</div><button class="btn btn-s sm" data-act="retry">Tentar novamente</button></div>';
  log.innerHTML=h;
  const cb=$('#clear-btn');if(cb)cb.hidden=!S.chat.length;
  const sb=$('#chat-send');if(sb)sb.disabled=!!(p&&p.state==='loading');
  window.scrollTo({top:document.documentElement.scrollHeight,behavior:reduce()?'auto':'smooth'});
}

/* ---------- telas ---------- */
function monthNav(){
  const[min,max]=bounds();
  return '<div class="month"><button class="icon-btn" data-act="month-prev" aria-label="Mês anterior"'+(S.month<=min?' disabled':'')+'>'+ico('chev-l')+'</button><div class="month-l" aria-live="polite">'+esc(cap(mLabel(S.month)))+'</div><button class="icon-btn" data-act="month-next" aria-label="Próximo mês"'+(S.month>=max?' disabled':'')+'>'+ico('chev-r')+'</button></div>';
}
function rowHtml(t){
  return '<li><button class="row" data-act="edit" data-id="'+t.id+'" aria-label="Editar '+esc(t.desc)+'"><span class="ico">'+ico(CI[t.cat]||'tag','s')+'</span><span class="rt"><span class="rd">'+esc(t.desc)+'</span><span class="rs">'+esc(dLabel(t.date))+' · '+esc(t.cat)+'</span></span><span class="ra num '+(t.type==='income'?'inc':'')+'">'+sgn(t.type,t.amt)+'</span></button></li>';
}
function limitRow(k){
  if(S.limit==null)return '<button class="limit" data-act="go" data-r="plan"><span class="limit-h"><span>Limite de gastos</span><span class="warn" style="color:var(--accent);font-weight:600">Definir limite mensal</span></span></button>';
  const used=monthTotals(k).out,p=Math.min(100,used/S.limit*100),over=used>S.limit;
  return '<button class="limit" data-act="go" data-r="plan"><span class="limit-h"><span>Limite de gastos</span><span class="num '+(over?'warn':'')+'">'+money(used)+' de '+money(S.limit)+'</span></span><span class="bar '+(over?'over':'')+'" aria-hidden="true"><i style="width:'+p+'%"></i></span><span class="lbl">'+(over?'Acima do limite em '+money(used-S.limit):'Ainda disponível: '+money(S.limit-used))+'</span></button>';
}
function vHome(){
  const k=S.month,tot=monthTotals(k),list=inMonth(k).sort(cmp).slice(0,5);
  return '<header class="top"><div><h1>'+(first()?'Olá, '+esc(first()):'Olá')+'</h1><span class="syncline" id="sync-top"></span></div><button class="avatar" data-act="go" data-r="profile" aria-label="Abrir perfil">'+esc(initials())+'</button></header>'
  +'<section class="bal" aria-label="Saldo"><div class="lbl">Saldo disponível</div><div class="bal-row"><div class="bal-val num">'+money(balance())+'</div><button class="icon-btn" data-act="toggle-hide" aria-label="'+(S.hide?'Mostrar valores':'Ocultar valores')+'">'+ico(S.hide?'eye-off':'eye')+'</button></div></section>'
  +'<section aria-label="Resumo do mês">'+monthNav()+'<div class="sum"><div><div class="lbl">Entradas</div><div class="v inc num">'+money(tot.inc)+'</div></div><div><div class="lbl">Saídas</div><div class="v num">'+money(tot.out)+'</div></div></div></section>'
  +limitRow(k)
  +'<section class="sec ask" aria-labelledby="ask-h"><h2 id="ask-h">Como posso ajudar?</h2><p class="lbl" style="margin-top:2px">Assistente simulado</p><div class="chips" style="margin-top:12px"><button class="chip" data-act="chip-analyze">Analisar gastos</button><button class="chip" data-act="go" data-r="plan">Planejar o mês</button></div>'
  +'<form class="askf" id="home-ask" autocomplete="off"><label class="sr" for="home-q">Pergunte ao assistente</label><input id="home-q" type="text" maxlength="300" placeholder="Pergunte sobre seus gastos"><button class="send" type="submit" aria-label="Enviar pergunta">'+ico('up')+'</button></form></section>'
  +'<section class="sec" aria-labelledby="rec-h"><div class="sec-h"><h2 id="rec-h">Atividade recente</h2><button class="btn-t" data-act="go" data-r="hist">Ver todas</button></div>'
  +(list.length?'<ul class="list">'+list.map(rowHtml).join('')+'</ul>':'<div class="empty"><div><strong>Nada em '+esc(mLabel(k))+'</strong>Registre uma receita ou despesa para começar.</div><button class="btn btn-p sm" data-act="add">Adicionar transação</button></div>')
  +'</section>';
}
const CHIPS=['Quanto gastei com alimentação?','Qual foi minha maior despesa?','Quanto ainda posso gastar?','Gastei 45 no mercado'];
function vChat(){
  return '<header class="top"><div><h1>Assistente</h1><span class="demo">Simulado · usa os seus lançamentos</span></div><button class="btn-t" id="clear-btn" data-act="clear-chat"'+(S.chat.length?'':' hidden')+'>Limpar</button></header>'
  +'<p class="note">Este assistente é simulado: as respostas são cálculos feitos com os seus lançamentos, sem usar inteligência artificial externa. Antes de registrar ou alterar uma transação, ele sempre pede a sua confirmação.</p>'
  +'<div class="log" id="log" role="log" aria-live="polite"></div>'
  +'<div class="chatchips">'+CHIPS.map(c=>'<button class="chip" data-act="chip-q" data-q="'+esc(c)+'">'+esc(c)+'</button>').join('')+'</div>'
  +'<div class="composer"><form id="chat-form" autocomplete="off"><label class="sr" for="chat-q">Mensagem para o assistente</label><input id="chat-q" type="text" maxlength="300" placeholder="Escreva sua pergunta"><button class="send" id="chat-send" type="submit" aria-label="Enviar">'+ico('up')+'</button></form></div>';
}
function histFiltered(){
  const h=ui.h,q=norm(h.q),t=today();let from='',to='';
  if(h.period==='month'){from=S.month+'-01';to=S.month+'-31'}
  else if(h.period==='30'){from=shiftDay(t,-29);to=t}
  else if(h.period==='90'){from=shiftDay(t,-89);to=t}
  else if(h.period==='custom'&&validDate(h.from)&&validDate(h.to)&&h.from<=h.to){from=h.from;to=h.to}
  return S.tx.filter(x=>(h.type==='all'||x.type===h.type)&&(h.cat==='all'||x.cat===h.cat)&&(!from||x.date>=from)&&(!to||x.date<=to)&&(!q||norm(x.desc).includes(q)||norm(x.cat).includes(q))).sort(cmp);
}
function vHist(){
  const h=ui.h,sel=(v,c)=>v===c?' selected':'';
  return '<header class="sub"><button class="icon-btn" data-act="go" data-r="home" aria-label="Voltar ao início">'+ico('back')+'</button><h1>Transações</h1></header>'
  +'<div class="searchw">'+ico('search')+'<label class="sr" for="h-q">Buscar por descrição</label><input class="input" id="h-q" type="search" placeholder="Buscar por descrição" value="'+esc(h.q)+'" autocomplete="off"></div>'
  +'<div class="hfilters"><div class="field"><label for="h-type">Tipo</label><select id="h-type"><option value="all">Todas</option><option value="income"'+sel(h.type,'income')+'>Receitas</option><option value="expense"'+sel(h.type,'expense')+'>Despesas</option></select></div>'
  +'<div class="field"><label for="h-cat">Categoria</label><select id="h-cat"><option value="all">Todas</option>'+ALLC.map(c=>'<option'+sel(h.cat,c)+'>'+esc(c)+'</option>').join('')+'</select></div>'
  +'<div class="field"><label for="h-period">Período</label><select id="h-period"><option value="month"'+sel(h.period,'month')+'>Mês selecionado</option><option value="30"'+sel(h.period,'30')+'>Últimos 30 dias</option><option value="90"'+sel(h.period,'90')+'>Últimos 90 dias</option><option value="all"'+sel(h.period,'all')+'>Todo o período</option><option value="custom"'+sel(h.period,'custom')+'>Personalizado</option></select></div></div>'
  +'<div class="hfilters" id="h-custom"'+(h.period==='custom'?'':' hidden')+'><div class="field"><label for="h-from">De</label><input class="input" id="h-from" type="date" value="'+esc(h.from)+'"></div><div class="field"><label for="h-to">Até</label><input class="input" id="h-to" type="date" value="'+esc(h.to)+'"></div></div>'
  +'<p class="lbl" id="h-sum" style="margin-top:12px" aria-live="polite"></p><div id="h-list"></div>';
}
function paintHist(){
  const l=$('#h-list');if(!l)return;
  const res=histFiltered(),inc=sum(res.filter(t=>t.type==='income')),out=sum(res.filter(t=>t.type==='expense'));
  $('#h-sum').innerHTML=res.length+(res.length===1?' transação':' transações')+' · Entradas '+esc(money(inc))+' · Saídas '+esc(money(out));
  const bad=ui.h.period==='custom'&&ui.h.from&&ui.h.to&&ui.h.from>ui.h.to;
  if(!res.length){l.innerHTML='<div class="empty"><div><strong>Nenhuma transação encontrada</strong>'+(bad?'A data inicial deve ser anterior à final.':'Ajuste a busca ou os filtros.')+'</div><button class="btn btn-s sm" data-act="hist-clear">Limpar filtros</button></div>';return}
  let h='',cur='';
  res.forEach(t=>{if(t.date!==cur){if(cur)h+='</ul>';cur=t.date;h+='<div class="dh">'+esc(dLong(t.date))+'</div><ul class="list">'}h+=rowHtml(t)});
  l.innerHTML=h+'</ul>';
}
function goalCalc(g){
  const mNow=mkey(new Date()),[y1,m1]=mNow.split('-').map(Number),[y2,m2]=g.deadline.split('-').map(Number);
  const months=(y2-y1)*12+(m2-m1),left=r2(g.target-g.saved);
  return{months,left,pct:Math.min(100,Math.round(g.saved/g.target*100)),done:g.saved>=g.target};
}
function vPlan(){
  const k=S.month,used=monthTotals(k).out,L=S.limit;
  let lim='';
  if(L!=null){
    const p=Math.min(100,used/L*100),over=used>L;
    lim='<div class="lbl">'+(over?'Acima do limite':'Ainda disponível')+'</div><div class="big num '+(over?'warn':'')+'">'+money(Math.abs(L-used))+'</div><div class="bar '+(over?'over':'')+'" style="margin-top:12px" aria-hidden="true"><i style="width:'+p+'%"></i></div><div class="kv num"><span>Utilizado '+money(used)+'</span><span>Limite '+money(L)+'</span></div>';
  }else lim='<p class="lbl">Defina quanto você quer gastar por mês. Eu mostro quanto já usou e quanto ainda pode gastar.</p>';
  const goals=S.goals.length?S.goals.map(g=>{
    const c=goalCalc(g);
    const dl=cap(mLabel(g.deadline));
    const info=c.done?'Meta concluída':(c.months<0?'Prazo vencido · faltam '+money(c.left):'Faltam '+money(c.left)+' · cerca de '+money(c.left/Math.max(1,c.months))+' por mês');
    return '<li class="goal"><div class="goal-h"><span class="gn">'+esc(g.name)+'</span><button class="btn-t" data-act="goal-edit" data-id="'+g.id+'">Editar</button></div><div class="bar" aria-hidden="true"><i style="width:'+c.pct+'%"></i></div><div class="goal-m num"><span>'+money(g.saved)+' de '+money(g.target)+' · '+c.pct+'%</span><span>até '+esc(dl.toLowerCase())+'</span></div><div class="lbl">'+info+'</div>'+(c.done?'':'<button class="btn btn-s sm" data-act="goal-add" data-id="'+g.id+'">Guardar valor</button>')+'</li>';
  }).join(''):'<div class="empty"><div><strong>Nenhuma meta ainda</strong>Crie uma meta, como uma viagem ou uma reserva de emergência.</div><button class="btn btn-p sm" data-act="goal-new">Criar meta</button></div>';
  return '<header class="sub"><button class="icon-btn" data-act="go" data-r="home" aria-label="Voltar ao início">'+ico('back')+'</button><h1>Planejamento</h1></header>'
  +monthNav()
  +'<section class="sec" style="margin-top:12px" aria-labelledby="lim-h"><h2 id="lim-h" style="margin-bottom:12px">Limite mensal de gastos</h2><div class="panel">'+lim
  +'<form id="limf" style="margin-top:16px" novalidate><div class="field"><label for="l-val">Limite mensal (R$)</label><input class="input" id="l-val" inputmode="decimal" autocomplete="off" placeholder="Ex.: 3.500,00" value="'+(L!=null?numIn(L):'')+'" aria-describedby="e-l-val"><div class="err" id="e-l-val" hidden></div><div class="lbl">Vale para todos os meses.</div></div><div class="actions"><button class="btn btn-p" type="submit">Salvar limite</button>'+(L!=null?'<button class="btn btn-d" type="button" data-act="limit-clear">Remover limite</button>':'')+'</div></form></div></section>'
  +'<section class="sec" aria-labelledby="goal-h"><div class="sec-h"><h2 id="goal-h">Metas de economia</h2>'+(S.goals.length?'<button class="btn-t" data-act="goal-new">Nova meta</button>':'')+'</div><ul class="list">'+goals+'</ul></section>';
}
function vLoading(){return '<div class="gate"><div class="brand"><img src="/favicon.svg" alt="" width="56" height="56"><h1>Fluxo Pessoal</h1></div><p class="lbl" role="status" style="text-align:center">Carregando seus dados…</p></div>'}
function vLoadErr(){return '<div class="gate"><div class="brand"><img src="/favicon.svg" alt="" width="56" height="56"><h1>Fluxo Pessoal</h1></div><div class="panel"><h2>Não foi possível carregar</h2><p style="margin:8px 0 16px">Verifique a conexão e tente de novo. Seus dados continuam salvos na conta.</p><div class="actions"><button class="btn btn-p" data-act="reload-data">Tentar novamente</button><button class="btn btn-s" data-act="logout">Sair da conta</button></div></div></div>'}
function vAuth(){
  const a=ui.auth||{mode:'login'},m=a.mode,em=esc(a.email||'');
  const brand='<div class="brand"><img src="/favicon.svg" alt="" width="56" height="56"><h1>Fluxo Pessoal</h1><p class="lbl">Seu dinheiro, em ordem.</p></div>';
  const msg='<div class="authmsg '+(a.err?'err':a.ok?'ok':'')+'" id="a-msg" role="alert">'+esc(a.err||a.ok||'')+'</div>';
  const emailF='<div class="field"><label for="a-email">E-mail</label><input class="input" id="a-email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" value="'+em+'" aria-describedby="e-a-email"><div class="err" id="e-a-email" hidden></div></div>';
  const passF=(label,auto,hint)=>'<div class="field"><label for="a-pass">'+label+'</label><div class="pwrow"><input class="input" id="a-pass" type="password" autocomplete="'+auto+'" aria-describedby="e-a-pass"><button type="button" class="btn-t" data-act="pw-toggle" aria-label="Mostrar senha">Mostrar</button></div>'+(hint?'<div class="lbl">'+hint+'</div>':'')+'<div class="err" id="e-a-pass" hidden></div></div>';
  const go=t=>'<button class="btn btn-p" id="a-go" type="submit" data-l="'+t+'" style="width:100%">'+t+'</button>';
  if(m==='check')return '<div class="gate">'+brand+'<div class="panel"><h2>Confirme seu e-mail</h2><p style="margin:8px 0 16px">Se este e-mail puder criar uma conta, enviamos um link de confirmação para <strong>'+em+'</strong>. Abra o link e depois volte para entrar. Veja também a pasta de spam.</p><button class="btn btn-p" style="width:100%" data-act="auth-mode" data-m="login">Ir para Entrar</button></div></div>';
  if(m==='forgot')return '<div class="gate">'+brand+'<form id="authf" novalidate><h2 style="margin-bottom:12px">Recuperar senha</h2><p class="lbl" style="margin-bottom:16px">Informe o e-mail da conta. Enviaremos um link para criar uma nova senha.</p>'+emailF+msg+go('Enviar link')+'<p style="text-align:center;margin-top:12px"><button type="button" class="btn-t" data-act="auth-mode" data-m="login">Voltar para Entrar</button></p></form></div>';
  if(m==='reset')return '<div class="gate">'+brand+'<form id="authf" novalidate><h2 style="margin-bottom:12px">Nova senha</h2>'+passF('Nova senha','new-password','Mínimo de 8 caracteres.')+'<div class="field"><label for="a-pass2">Repita a nova senha</label><input class="input" id="a-pass2" type="password" autocomplete="new-password" aria-describedby="e-a-pass2"><div class="err" id="e-a-pass2" hidden></div></div>'+msg+go('Salvar nova senha')+'</form></div>';
  const tabs='<div class="seg" role="group" aria-label="Acesso" style="margin-bottom:20px"><button type="button" class="segb" data-act="auth-mode" data-m="login" aria-pressed="'+(m==='login')+'">Entrar</button><button type="button" class="segb" data-act="auth-mode" data-m="signup" aria-pressed="'+(m==='signup')+'">Criar conta</button></div>';
  if(m==='signup')return '<div class="gate">'+brand+tabs+'<form id="authf" novalidate>'+emailF+passF('Senha','new-password','Mínimo de 8 caracteres.')+msg+go('Criar conta')+'<p class="note" style="text-align:center">Seus lançamentos ficam salvos na nuvem, ligados à sua conta. Só você e quem administra este app conseguem acessá-los.</p></form></div>';
  return '<div class="gate">'+brand+tabs+'<form id="authf" novalidate>'+emailF+passF('Senha','current-password','')+msg+go('Entrar')+'<p style="text-align:center;margin-top:12px"><button type="button" class="btn-t" data-act="auth-mode" data-m="forgot">Esqueci minha senha</button></p></form></div>';
}
function vProfile(){
  const sw=(on,act,t,h)=>'<button class="setrow" role="switch" aria-checked="'+on+'" data-act="'+act+'"><span class="t"><span>'+t+'</span><span class="h">'+h+'</span></span><span class="sw" aria-hidden="true"></span></button>';
  const acct=LOCAL?'Login desativado · dados só neste aparelho':esc(session.user.email||'');
  return '<header class="top"><h1>Perfil</h1></header>'
  +'<div style="display:flex;align-items:center;gap:16px;margin:16px 0 24px"><div class="avatar big" aria-hidden="true">'+esc(initials())+'</div><div style="min-width:0"><div style="font-size:20px;font-weight:600;overflow-wrap:anywhere">'+esc(S.name||'Sem nome')+'</div><div class="lbl" style="overflow-wrap:anywhere">'+acct+'</div></div></div>'
  +'<form id="namef" novalidate><div class="field"><label for="n-name">Nome</label><input class="input" id="n-name" maxlength="30" autocomplete="off" value="'+esc(S.name)+'" aria-describedby="e-n-name"><div class="err" id="e-n-name" hidden></div></div><button class="btn btn-s" type="submit">Salvar nome</button></form>'
  +'<section class="sec" aria-labelledby="pref-h"><h2 id="pref-h">Preferências</h2>'+sw(S.hide,'toggle-hide','Ocultar valores','Esconde saldos e valores em todas as telas')
  +'<button class="setrow" data-act="opening-edit"><span class="t"><span>Saldo inicial da conta</span><span class="h">Saldo antes dos lançamentos: '+esc(money(S.opening||0))+'</span></span>'+ico('chev-r')+'</button>'
  +'<button class="setrow" data-act="go" data-r="plan"><span class="t"><span>Planejamento</span><span class="h">Limite mensal e metas de economia</span></span>'+ico('chev-r')+'</button>'
  +'<button class="setrow" data-act="export"><span class="t"><span>Exportar transações (CSV)</span><span class="h">'+S.tx.length+' transações em um arquivo de planilha</span></span>'+ico('download')+'</button></section>'
  +'<section class="sec" aria-labelledby="acc-h"><h2 id="acc-h">Conta e dados</h2>'
  +(LOCAL?'<p class="note" style="margin-top:8px">'+(SECRETKEY?'O config.js contém uma chave secreta do Supabase. Troque pela chave pública (anon ou publishable) e nunca publique a chave secreta.':'O login ainda não foi configurado neste site, então os dados ficam só neste aparelho e não sincronizam. O LEIA-ME explica como ativar o login.')+'</p>'
    :'<div class="setrow"><span class="t"><span>Sincronização</span><span class="h" id="sync-st"></span></span></div>')
  +'<p class="note">O app nunca pede senha de banco nem número de cartão.</p>'
  +sw(S.simFail,'toggle-sim','Simular falha do assistente','Só para testar a mensagem de erro')
  +'<div class="actions" style="margin-top:16px">'+(LOCAL?'':'<button class="btn btn-s" data-act="logout">Sair da conta</button>')+'<button class="btn btn-d" data-act="wipe">Apagar meus dados</button></div></section>';
}
const VIEWS={home:vHome,chat:vChat,hist:vHist,plan:vPlan,profile:vProfile};

/* ---------- renderização e navegação ---------- */
function renderGate(){
  $('#nav').hidden=true;$('#fab').hidden=true;
  $('#view').innerHTML=ui.loading?vLoading():ui.loadErr?vLoadErr():vAuth();
}
function render(){
  if(!session||ui.auth||ui.loading||ui.loadErr){renderGate();return}
  $('#nav').hidden=false;
  const v=$('#view');v.innerHTML=VIEWS[ui.route]();
  document.querySelectorAll('#nav button').forEach(b=>{
    const parent=ui.route==='hist'||ui.route==='plan'?'home':ui.route;
    if(b.dataset.n===parent)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
  $('#fab').hidden=!(ui.route==='home'||ui.route==='hist');
  if(ui.route==='chat')paintLog();
  if(ui.route==='hist')paintHist();
  paintSync();maybeOnboard();
}
const ROUTES={'':'home','inicio':'home','assistente':'chat','perfil':'profile','historico':'hist','planejamento':'plan'};
const HASH={home:'inicio',chat:'assistente',profile:'perfil',hist:'historico',plan:'planejamento'};
const readRoute=()=>ROUTES[location.hash.replace(/^#/,'')]||'home';
function go(r){
  const h='#'+HASH[r];
  if(location.hash!==h){ui.skip=true;try{location.hash=h}catch(e){ui.skip=false}}
  ui.route=r;closeSheet(true);render();window.scrollTo(0,0);
  $('#view').focus({preventScroll:true});
}
window.addEventListener('hashchange',()=>{if(ui.skip){ui.skip=false;return}ui.route=readRoute();closeSheet(true);render();window.scrollTo(0,0)});

/* ---------- avisos e painéis ---------- */
let tt;
function toast(msg,act){
  const el=$('#toast');
  el.innerHTML='<span>'+esc(msg)+'</span>'+(act?'<button data-act="toast-act">'+esc(act.label)+'</button>':'');
  el.classList.add('show');ui.toastFn=act?act.fn:null;
  clearTimeout(tt);tt=setTimeout(()=>{el.classList.remove('show');el.innerHTML='';ui.toastFn=null},act?7000:4000);
}
let sheet=null;
function openSheet(title,html,mount,opts){
  closeSheet(true);
  const locked=!!(opts&&opts.locked),root=$('#sheetRoot');
  root.innerHTML='<div class="sheet-bg"'+(locked?'':' data-act="sheet-close"')+'></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-t"><div class="grab" aria-hidden="true"></div><div class="sheet-h"><h2 id="sheet-t">'+esc(title)+'</h2>'+(locked?'':'<button class="icon-btn" data-act="sheet-close" aria-label="Fechar">'+ico('close')+'</button>')+'</div>'+html+'</div>';
  root.hidden=false;sheet={ret:document.activeElement,locked};document.body.classList.add('lock');
  if(mount)mount(root);
  const f=root.querySelector('[data-autofocus]')||root.querySelector('input:not([type=radio]),select,button.btn');
  if(f)f.focus({preventScroll:true});
}
function closeSheet(silent){
  const root=$('#sheetRoot');if(root.hidden)return;
  root.hidden=true;root.innerHTML='';document.body.classList.remove('lock');
  const r=sheet&&sheet.ret;sheet=null;
  if(!silent&&r&&r.focus&&document.contains(r))r.focus({preventScroll:true});
}
function confirmSheet(title,msg,okLabel,fn){
  openSheet(title,'<p>'+esc(msg)+'</p><div class="actions"><button class="btn btn-p" data-act="confirm-ok">'+esc(okLabel)+'</button><button class="btn btn-s" data-act="sheet-close">Cancelar</button></div>');
  sheet.fn=fn;
}
function setErr(id,msg){
  const i=$('#'+id),e=$('#e-'+id);if(!i||!e)return;
  if(msg){e.textContent=msg;e.hidden=false;i.setAttribute('aria-invalid','true')}else{e.hidden=true;e.textContent='';i.removeAttribute('aria-invalid')}
}

/* ---------- transações ---------- */
const catOpts=(type,sel)=>(type==='income'?INC:EXP).map(c=>'<option'+(c===sel?' selected':'')+'>'+esc(c)+'</option>').join('');
function txSheet(id){
  const t=id?S.tx.find(x=>x.id===id):null;if(id&&!t)return;
  ui.editId=t?t.id:null;
  const type=t?t.type:'expense';
  const html='<form id="txf" novalidate><div class="field"><span class="fl" id="tl">Tipo</span><div class="seg" role="radiogroup" aria-labelledby="tl"><label class="seg-i"><input type="radio" name="type" value="expense"'+(type==='expense'?' checked':'')+'><span>Despesa</span></label><label class="seg-i"><input type="radio" name="type" value="income"'+(type==='income'?' checked':'')+'><span>Receita</span></label></div></div>'
  +'<div class="field"><label for="f-desc">Descrição</label><input class="input" id="f-desc" maxlength="60" autocomplete="off" placeholder="Ex.: Supermercado" value="'+esc(t?t.desc:'')+'" aria-describedby="e-f-desc" data-autofocus><div class="err" id="e-f-desc" hidden></div></div>'
  +'<div class="field"><label for="f-amt">Valor (R$)</label><input class="input" id="f-amt" inputmode="decimal" autocomplete="off" placeholder="0,00" value="'+(t?numIn(t.amt):'')+'" aria-describedby="e-f-amt"><div class="err" id="e-f-amt" hidden></div></div>'
  +'<div class="field"><label for="f-cat">Categoria</label><select id="f-cat" aria-describedby="e-f-cat">'+catOpts(type,t?t.cat:null)+'</select><div class="err" id="e-f-cat" hidden></div></div>'
  +'<div class="field"><label for="f-date">Data</label><input class="input" id="f-date" type="date" value="'+(t?t.date:today())+'" aria-describedby="e-f-date"><div class="err" id="e-f-date" hidden></div></div>'
  +'<div class="actions"><button class="btn btn-p" type="submit">'+(t?'Salvar alterações':'Adicionar')+'</button>'+(t?'<button class="btn btn-d" type="button" data-act="tx-del" data-id="'+t.id+'">Excluir</button>':'')+'</div></form>';
  openSheet(t?'Editar transação':'Nova transação',html);
}
function txSubmit(){
  const type=$('#txf input[name=type]:checked').value,desc=$('#f-desc').value.trim(),raw=$('#f-amt').value,amt=parseMoney(raw),cat=$('#f-cat').value,date=$('#f-date').value;
  let firstBad=null;const bad=(id,m)=>{setErr(id,m);firstBad=firstBad||id};
  ['f-desc','f-amt','f-cat','f-date'].forEach(i=>setErr(i,null));
  if(!desc)bad('f-desc','Informe uma descrição.');
  if(!raw.trim())bad('f-amt','Informe o valor.');
  else if(!(amt>0))bad('f-amt','Use um valor maior que zero, como 45,90.');
  else if(amt>9999999.99)bad('f-amt','O valor máximo é R$ 9.999.999,99.');
  if(!(type==='income'?INC:EXP).includes(cat))bad('f-cat','Escolha uma categoria.');
  if(!validDate(date))bad('f-date','Informe uma data válida.');
  if(firstBad){$('#'+firstBad).focus();return}
  const edit=!!ui.editId;
  if(edit){const t=S.tx.find(x=>x.id===ui.editId);if(t)Object.assign(t,{type,desc,amt,cat,date})}
  else S.tx.push({id:uid(),ts:Date.now(),type,desc,amt,cat,date});
  const mk=date.slice(0,7);let extra='';
  if(mk!==S.month){S.month=mk;extra=' em '+mLabel(mk)}
  save();closeSheet();render();
  toast((type==='income'?'Receita ':'Despesa ')+(edit?'atualizada':'adicionada')+extra+'.');
}
function deleteTx(id){
  const i=S.tx.findIndex(x=>x.id===id);if(i<0)return;
  const t=S.tx.splice(i,1)[0];save();closeSheet();render();
  toast('Transação excluída.',{label:'Desfazer',fn:()=>{S.tx.push(t);save();render();toast('Exclusão desfeita.')}});
}

/* ---------- metas e limite ---------- */
function goalSheet(id){
  const g=id?S.goals.find(x=>x.id===id):null;if(id&&!g)return;ui.editId=g?g.id:null;
  const html='<form id="goalf" novalidate><div class="field"><label for="g-name">Nome da meta</label><input class="input" id="g-name" maxlength="40" autocomplete="off" placeholder="Ex.: Viagem" value="'+esc(g?g.name:'')+'" aria-describedby="e-g-name" data-autofocus><div class="err" id="e-g-name" hidden></div></div>'
  +'<div class="field"><label for="g-target">Valor desejado (R$)</label><input class="input" id="g-target" inputmode="decimal" autocomplete="off" placeholder="0,00" value="'+(g?numIn(g.target):'')+'" aria-describedby="e-g-target"><div class="err" id="e-g-target" hidden></div></div>'
  +'<div class="field"><label for="g-saved">Já guardado (R$)</label><input class="input" id="g-saved" inputmode="decimal" autocomplete="off" placeholder="0,00" value="'+(g?numIn(g.saved):'')+'" aria-describedby="e-g-saved"><div class="err" id="e-g-saved" hidden></div></div>'
  +'<div class="field"><label for="g-dl">Prazo (mês e ano)</label><input class="input" id="g-dl" type="month" placeholder="AAAA-MM" min="'+mkey(new Date())+'" value="'+(g?g.deadline:addM(mkey(new Date()),6))+'" aria-describedby="e-g-dl"><div class="err" id="e-g-dl" hidden></div></div>'
  +'<div class="actions"><button class="btn btn-p" type="submit">'+(g?'Salvar meta':'Criar meta')+'</button>'+(g?'<button class="btn btn-d" type="button" data-act="goal-del" data-id="'+g.id+'">Excluir meta</button>':'')+'</div></form>';
  openSheet(g?'Editar meta':'Nova meta',html);
}
function goalSubmit(){
  const name=$('#g-name').value.trim(),tr=$('#g-target').value,sr=$('#g-saved').value,target=parseMoney(tr),saved=sr.trim()?parseMoney(sr):0,dl=$('#g-dl').value.trim();
  let fb=null;const bad=(id,m)=>{setErr(id,m);fb=fb||id};
  ['g-name','g-target','g-saved','g-dl'].forEach(i=>setErr(i,null));
  if(!name)bad('g-name','Dê um nome para a meta.');
  if(!tr.trim())bad('g-target','Informe o valor desejado.');else if(!(target>0))bad('g-target','Use um valor maior que zero.');
  if(isNaN(saved)||saved<0)bad('g-saved','Use um valor válido, ou deixe em branco.');
  else if(target>0&&saved>target)bad('g-saved','O valor guardado não pode ser maior que a meta.');
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(dl))bad('g-dl','Informe o prazo, como 2027-03.');
  else if(dl<mkey(new Date()))bad('g-dl','Escolha um mês a partir do atual.');
  if(fb){$('#'+fb).focus();return}
  if(ui.editId){const g=S.goals.find(x=>x.id===ui.editId);if(g)Object.assign(g,{name,target,saved,deadline:dl})}
  else S.goals.push({id:uid(),name,target,saved,deadline:dl});
  const edit=!!ui.editId;save();closeSheet();render();toast(edit?'Meta atualizada.':'Meta criada.');
}
function contSheet(id){
  const g=S.goals.find(x=>x.id===id);if(!g)return;ui.editId=id;
  openSheet('Guardar valor','<p class="lbl">'+esc(g.name)+' · faltam '+esc(money(r2(g.target-g.saved)))+'</p><form id="contf" novalidate><div class="field"><label for="c-amt">Valor a guardar (R$)</label><input class="input" id="c-amt" inputmode="decimal" autocomplete="off" placeholder="0,00" aria-describedby="e-c-amt" data-autofocus><div class="err" id="e-c-amt" hidden></div></div><div class="actions"><button class="btn btn-p" type="submit">Guardar</button></div></form>');
}
function contSubmit(){
  const g=S.goals.find(x=>x.id===ui.editId);if(!g)return;
  const raw=$('#c-amt').value,v=parseMoney(raw),left=r2(g.target-g.saved);setErr('c-amt',null);
  if(!raw.trim()){setErr('c-amt','Informe o valor.');$('#c-amt').focus();return}
  if(!(v>0)){setErr('c-amt','Use um valor maior que zero.');$('#c-amt').focus();return}
  if(v>left){setErr('c-amt','Faltam apenas '+money(left)+' para concluir a meta.');$('#c-amt').focus();return}
  g.saved=r2(g.saved+v);save();closeSheet();render();toast(g.saved>=g.target?'Meta concluída. Parabéns!':'Valor guardado.');
}
function limitSubmit(){
  const raw=$('#l-val').value,v=parseMoney(raw);setErr('l-val',null);
  if(!raw.trim()){setErr('l-val','Informe o limite mensal.');$('#l-val').focus();return}
  if(!(v>0)){setErr('l-val','Use um valor maior que zero.');$('#l-val').focus();return}
  S.limit=v;save();render();toast('Limite mensal salvo.');
}

/* ---------- exportação ---------- */
function csvText(){
  const q=v=>{v=String(v);if(/^[=+\-@]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'};
  const rows=[['Data','Tipo','Descrição','Categoria','Valor']];
  [...S.tx].sort((a,b)=>a.date.localeCompare(b.date)||a.ts-b.ts).forEach(t=>rows.push([t.date,t.type==='income'?'Receita':'Despesa',t.desc,t.cat,(t.type==='income'?'':'-')+t.amt.toFixed(2).replace('.',',')]));
  return '﻿'+rows.map(r=>r.map((c,i)=>i===4?c:q(c)).join(';')).join('\r\n');
}
function csvFallback(data){
  openSheet('Exportar CSV','<p>O download direto não está disponível aqui. Copie o conteúdo abaixo e cole em uma planilha.</p><label class="sr" for="csv-t">Conteúdo do CSV</label><textarea class="csv" id="csv-t" readonly>'+esc(data.replace(/^﻿/,''))+'</textarea><div class="actions"><button class="btn btn-p" data-act="copy-csv">Copiar</button></div>');
}
async function exportCsv(){
  if(!S.tx.length){toast('Não há transações para exportar.');return}
  const data=csvText(),name='fluxo-transacoes-'+today()+'.csv';
  try{
    if(window.claude&&typeof window.claude.use==='function'){
      const d=await window.claude.use('downloads');
      if(d){await d.save({filename:name,data});toast('Arquivo pronto para salvar.');return}
    }else{
      const file=new File([data],name,{type:'text/csv'});
      if(navigator.canShare&&navigator.canShare({files:[file]})){
        try{await navigator.share({files:[file],title:name});return}catch(e){if(e&&e.name==='AbortError')return}
      }
      const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));a.download=name;document.body.appendChild(a);a.click();a.remove();toast('Exportação iniciada.');return;
    }
  }catch(e){}
  csvFallback(data);
}

/* ---------- primeiro acesso ---------- */
function maybeOnboard(){
  if(!session||ui.auth||ui.loading||ui.loadErr||S.onboarded||!$('#sheetRoot').hidden)return;
  openSheet('Vamos começar','<p class="lbl">Informe alguns dados para o app refletir a sua realidade. Você pode mudar tudo depois.</p><form id="onbf" novalidate>'
  +'<div class="field"><label for="o-name">Seu nome</label><input class="input" id="o-name" maxlength="30" autocomplete="given-name" aria-describedby="e-o-name" data-autofocus><div class="err" id="e-o-name" hidden></div></div>'
  +'<div class="field"><label for="o-open">Saldo atual da conta (R$)</label><input class="input" id="o-open" inputmode="decimal" autocomplete="off" placeholder="0,00" aria-describedby="e-o-open"><div class="err" id="e-o-open" hidden></div></div>'
  +'<div class="field"><label for="o-limit">Limite mensal de gastos (R$), opcional</label><input class="input" id="o-limit" inputmode="decimal" autocomplete="off" placeholder="Ex.: 3.000,00" aria-describedby="e-o-limit"><div class="err" id="e-o-limit" hidden></div></div>'
  +'<div class="actions"><button class="btn btn-p" type="submit">Começar</button></div></form>',null,{locked:true});
}
function onbSubmit(){
  const name=$('#o-name').value.trim(),oraw=$('#o-open').value,open=parseMoney(oraw),lraw=$('#o-limit').value.trim(),lim=lraw?parseMoney(lraw):null;
  let bad=null;const flag=(id,m)=>{setErr(id,m);bad=bad||id};
  ['o-name','o-open','o-limit'].forEach(i=>setErr(i,null));
  if(!name)flag('o-name','Informe seu nome.');
  if(!oraw.trim())flag('o-open','Informe o saldo atual. Se estiver zerado, digite 0.');
  else if(isNaN(open))flag('o-open','Use um valor como 1.250,00.');
  if(lraw&&!(lim>0))flag('o-limit','Use um valor maior que zero ou deixe em branco.');
  if(bad){$('#'+bad).focus();return}
  S.name=name;S.opening=open;S.limit=lim;S.onboarded=true;save();closeSheet(true);render();
  toast('Tudo pronto. Registre sua primeira transação.');
}
function openingSheet(){
  openSheet('Saldo inicial da conta','<p class="lbl">É o saldo da conta antes de todos os lançamentos. O saldo disponível é este valor mais as receitas, menos as despesas.</p><form id="openf" novalidate><div class="field"><label for="op-val">Saldo inicial (R$)</label><input class="input" id="op-val" inputmode="decimal" autocomplete="off" value="'+numIn(S.opening||0)+'" aria-describedby="e-op-val" data-autofocus><div class="err" id="e-op-val" hidden></div></div><div class="actions"><button class="btn btn-p" type="submit">Salvar</button></div></form>');
}
function openSubmit(){
  const raw=$('#op-val').value,v=parseMoney(raw);setErr('op-val',null);
  if(!raw.trim()||isNaN(v)){setErr('op-val','Use um valor como 1.250,00. Se estiver zerado, digite 0.');$('#op-val').focus();return}
  S.opening=v;save();closeSheet();render();toast('Saldo inicial atualizado.');
}

/* ---------- eventos ---------- */
document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-act]');if(!el)return;
  const a=el.dataset.act,id=el.dataset.id;
  switch(a){
    case 'go':go(el.dataset.r);break;
    case 'toggle-hide':S.hide=!S.hide;save();render();break;
    case 'auth-mode':{const e=$('#a-email');ui.auth={mode:el.dataset.m,email:e?e.value.trim():((ui.auth&&ui.auth.email)||'')};render();break}
    case 'pw-toggle':{const i=$('#a-pass'),show=i.type==='password';i.type=show?'text':'password';el.textContent=show?'Ocultar':'Mostrar';el.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');break}
    case 'logout':logoutAsk();break;
    case 'wipe':wipeAsk();break;
    case 'opening-edit':openingSheet();break;
    case 'reload-data':enterApp();break;
    case 'toggle-sim':S.simFail=!S.simFail;save();render();break;
    case 'month-prev':{const[min]=bounds();if(addM(S.month,-1)>=min){S.month=addM(S.month,-1);save();render()}break}
    case 'month-next':{const[,max]=bounds();if(addM(S.month,1)<=max){S.month=addM(S.month,1);save();render()}break}
    case 'add':txSheet(null);break;
    case 'edit':txSheet(id);break;
    case 'tx-del':deleteTx(id);break;
    case 'sheet-close':closeSheet();break;
    case 'confirm-ok':{const f=sheet&&sheet.fn;closeSheet();if(f)f();break}
    case 'chip-analyze':go('chat');ask('Analisar meus gastos do mês');break;
    case 'chip-q':ask(el.dataset.q);break;
    case 'retry':if(ui.pending&&ui.pending.state==='error')ask(ui.pending.q,true);break;
    case 'clear-chat':S.chat=[];ui.pending=null;save();paintLog();break;
    case 'hist-clear':ui.h={q:'',type:'all',cat:'all',period:'month',from:'',to:''};render();break;
    case 'goal-new':goalSheet(null);break;
    case 'goal-edit':goalSheet(id);break;
    case 'goal-add':contSheet(id);break;
    case 'goal-del':{const i=S.goals.findIndex(x=>x.id===id);if(i<0)break;const g=S.goals.splice(i,1)[0];save();closeSheet();render();toast('Meta excluída.',{label:'Desfazer',fn:()=>{S.goals.splice(Math.min(i,S.goals.length),0,g);save();render();toast('Exclusão desfeita.')}});break}
    case 'limit-clear':S.limit=null;save();render();toast('Limite removido.');break;
    case 'export':exportCsv();break;
    case 'copy-csv':{const t=$('#csv-t');t.focus();t.select();try{await navigator.clipboard.writeText(t.value);toast('Conteúdo copiado.')}catch(x){toast('Selecione o texto e copie manualmente.')}break}
    case 'toast-act':{const f=ui.toastFn;$('#toast').classList.remove('show');$('#toast').innerHTML='';ui.toastFn=null;if(f)f();break}
    case 'prop-ok':case 'prop-no':{
      const m=S.chat.find(x=>x.id===id);if(!m||!m.proposal||m.proposal.status!=='pending')break;
      const p=m.proposal,d=p.data;
      if(a==='prop-no'){p.status='cancelled';save();paintLog();break}
      if(p.kind==='add'){S.tx.push({id:uid(),ts:Date.now(),type:d.type,desc:d.desc,amt:d.amt,cat:d.cat,date:d.date});S.month=d.date.slice(0,7);p.status='done';save();paintLog();toast((d.type==='income'?'Receita':'Despesa')+' adicionada.')}
      else if(p.kind==='delete'){const i=S.tx.findIndex(x=>x.id===d.id);if(i<0){p.status='gone';save();paintLog();break}const t=S.tx.splice(i,1)[0];p.status='done';save();paintLog();toast('Transação excluída.',{label:'Desfazer',fn:()=>{S.tx.push(t);save();toast('Exclusão desfeita.')}})}
      else{const t=S.tx.find(x=>x.id===d.id);if(!t){p.status='gone';save();paintLog();break}t.cat=d.cat;p.status='done';save();paintLog();toast('Categoria atualizada.')}
      break;
    }
  }
});
document.addEventListener('submit',e=>{
  const f=e.target;e.preventDefault();
  switch(f.id){
    case 'home-ask':{const q=$('#home-q').value;if(!q.trim())return;go('chat');ask(q);break}
    case 'chat-form':{const i=$('#chat-q'),q=i.value;if(!q.trim())return;i.value='';ask(q);break}
    case 'txf':txSubmit();break;
    case 'goalf':goalSubmit();break;
    case 'contf':contSubmit();break;
    case 'limf':limitSubmit();break;
    case 'authf':authSubmit();break;
    case 'onbf':onbSubmit();break;
    case 'openf':openSubmit();break;
    case 'namef':{const v=$('#n-name').value.trim();setErr('n-name',null);if(!v){setErr('n-name','Informe seu nome.');$('#n-name').focus();return}S.name=v;save();render();toast('Nome atualizado.');break}
  }
});
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.id&&t.closest('form')&&$('#e-'+t.id))setErr(t.id,null);
  if(t.id==='h-q'){ui.h.q=t.value;paintHist()}
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.name==='type'&&t.closest('#txf')){const c=$('#f-cat');c.innerHTML=catOpts(t.value,null)}
  if(t.id==='h-type'){ui.h.type=t.value;paintHist()}
  if(t.id==='h-cat'){ui.h.cat=t.value;paintHist()}
  if(t.id==='h-period'){ui.h.period=t.value;$('#h-custom').hidden=t.value!=='custom';paintHist()}
  if(t.id==='h-from'){ui.h.from=t.value;paintHist()}
  if(t.id==='h-to'){ui.h.to=t.value;paintHist()}
});
document.addEventListener('keydown',e=>{
  if(!sheet)return;
  if(e.key==='Escape'){if(!sheet.locked)closeSheet();return}
  if(e.key==='Tab'){
    const f=[...$('#sheetRoot').querySelectorAll('button,input:not([type=radio]),input[type=radio]:checked,select,textarea,[href]')].filter(x=>!x.disabled&&x.offsetParent!==null);
    if(!f.length)return;const a=f[0],b=f[f.length-1];
    if(e.shiftKey&&document.activeElement===a){e.preventDefault();b.focus()}
    else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a.focus()}
  }
});

/* teclado virtual: mantém campos e painéis visíveis */
let baseH=window.innerHeight;
function kb(){
  const vv=window.visualViewport;if(!vv)return;
  const k=Math.max(0,Math.round(window.innerHeight-vv.height-vv.offsetTop));
  document.documentElement.style.setProperty('--kb',k+'px');
  baseH=Math.max(baseH,window.innerHeight);
  const ae=document.activeElement;
  const typing=ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)&&!/^(radio|checkbox|button|submit|date|month)$/.test(ae.type||'');
  document.body.classList.toggle('kbd',!!typing&&(k>80||baseH-window.innerHeight>120));
}
if(window.visualViewport){visualViewport.addEventListener('resize',kb);visualViewport.addEventListener('scroll',kb)}
document.addEventListener('focusin',()=>setTimeout(kb,60));
document.addEventListener('focusout',()=>setTimeout(kb,60));

boot();
})();

/* PWA: registra o service worker (só em https ou localhost). */
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
  window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{})});
}

