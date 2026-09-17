const API = 'https://open.feishu.cn/open-apis';
const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
class ApiError extends Error { constructor(message,status=400){super(message);this.status=status;} }
let cached;
function credentials(request,env){
  const appId=(env.FEISHU_APP_ID||'').trim();
  const appSecret=(env.FEISHU_APP_SECRET||'').trim();
  const missing=[];
  if(!appId) missing.push('FEISHU_APP_ID');
  if(!appSecret) missing.push('FEISHU_APP_SECRET');
  if(missing.length) throw new ApiError(`后台尚未配置：${missing.join('、')}`,503);
  return {appId,appSecret};
}
function configuredTables(env){
  const mainApp=(env.FEISHU_APP_TOKEN||'').trim();
  const make=(tableKey,appKey)=>{const table=(env[tableKey]||'').trim();if(!table)return null;return {appToken:(env[appKey]||mainApp).trim(),tableId:table};};
  return {
    resources:make('FEISHU_TABLE_ID','FEISHU_RESOURCE_APP_TOKEN'),
    categories:make('FEISHU_CATEGORY_TABLE_ID','FEISHU_CATEGORY_APP_TOKEN'),
    platforms:make('FEISHU_PLATFORM_TABLE_ID','FEISHU_PLATFORM_APP_TOKEN'),
    publications:make('FEISHU_PUBLICATION_TABLE_ID','FEISHU_PUBLICATION_APP_TOKEN')
  };
}

async function token(c){
  if(cached?.id===c.appId && cached.secret===c.appSecret && cached.until>Date.now()) return cached.value;
  const r=await fetch(`${API}/auth/v3/tenant_access_token/internal`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({app_id:c.appId,app_secret:c.appSecret})});
  const d=await r.json();if(!r.ok||d.code!==0)throw new ApiError(`飞书授权失败：${d.msg||r.status}`,502);
  cached={id:c.appId,secret:c.appSecret,value:d.tenant_access_token,until:Date.now()+Math.max(0,(d.expire||7200)-120)*1000};return cached.value;
}
async function fs(c,path,opt={}){
 const r=await fetch(API+path,{...opt,headers:{'content-type':'application/json','authorization':`Bearer ${await token(c)}`,...(opt.headers||{})}});
 const d=await r.json();if(!r.ok||d.code!==0){if(d.code===99991663||d.code===99991664)cached=null;throw new ApiError(`飞书请求失败（${d.code||r.status}）：${d.msg||'请检查应用权限和表格访问权限'}`,r.status===429?429:502);}return d.data||{};
}
async function all(c,path,size=100){let items=[],page='';const seen=new Set();do{const q=new URLSearchParams({page_size:String(size)});if(page)q.set('page_token',page);const d=await fs(c,`${path}?${q}`);items.push(...(d.items||[]));page=d.has_more?d.page_token:'';if(d.has_more&&(!page||seen.has(page)))throw new ApiError('飞书分页返回异常，请重试',502);seen.add(page);}while(page);return items;}
function ids(u){const app=u.searchParams.get('app_token'),table=u.searchParams.get('table_id');if(!/^[A-Za-z0-9_-]+$/.test(app||'')||!/^tbl[A-Za-z0-9_-]+$/.test(table||''))throw new ApiError('表格标识无效');return{app,table};}
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v;}
export async function revision(fields){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(stable(fields))));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function tagged(r){return {...r,revision:await revision(r.fields||{})};}
function checkWriteOrigin(request){if(!['GET','HEAD'].includes(request.method)){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new ApiError('不允许跨站写入',403);}}
export default {async fetch(request,env){const u=new URL(request.url);if(!u.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);try{
 checkWriteOrigin(request);const c=credentials(request,env);
 if(u.pathname==='/api/health'&&request.method==='GET'){const t=configuredTables(env);return json({configured:Boolean(t.resources?.appToken&&t.resources?.tableId),mode:'worker-auto',tables:Object.fromEntries(Object.entries(t).filter(([,v])=>v).map(([k,v])=>[k,{tableId:v.tableId}]))});}
 if(u.pathname==='/api/bootstrap'&&request.method==='GET'){
  const t=configuredTables(env);
  if(!t.resources?.appToken||!t.resources?.tableId)throw new ApiError('后台尚未配置 FEISHU_APP_TOKEN / FEISHU_TABLE_ID',503);
  for(const [k,v] of Object.entries(t)) if(v&&(!/^[A-Za-z0-9_-]+$/.test(v.appToken)||!/^tbl[A-Za-z0-9_-]+$/.test(v.tableId))) throw new ApiError(`${k} 的后台表格配置无效`,503);
  return json({configured:true,interval:Number(env.FEISHU_SYNC_INTERVAL||30),tables:t});
 }
 if(u.pathname==='/api/media/upload'&&request.method==='POST'){
  const form=await request.formData();
  const file=form.get('file');
  const app=(form.get('app_token')||env.FEISHU_APP_TOKEN||'').toString().trim();
  if(!file||typeof file==='string')throw new ApiError('请选择要上传的图片');
  if(!/^[A-Za-z0-9_-]+$/.test(app))throw new ApiError('资源表 App Token 无效');
  if(!file.type?.startsWith('image/'))throw new ApiError('仅支持图片文件');
  if(file.size>20*1024*1024)throw new ApiError('图片不能超过 20MB');
  const fd=new FormData();
  fd.set('file_name',file.name||`cover-${Date.now()}.png`);
  fd.set('parent_type','bitable_image');
  fd.set('parent_node',app);
  fd.set('size',String(file.size));
  fd.set('file',file,file.name||`cover-${Date.now()}.png`);
  const r=await fetch(`${API}/drive/v1/medias/upload_all`,{method:'POST',headers:{authorization:`Bearer ${await token(c)}`},body:fd});
  let d={};try{d=await r.json()}catch{}
  if(!r.ok||d.code!==0)throw new ApiError(`飞书封面上传失败（${d.code||r.status}）：${d.msg||'请检查云文档/多维表格素材上传权限'}`,r.status===400?400:r.status===403?403:502);
  if(!d.data?.file_token)throw new ApiError('飞书封面上传失败：没有返回 file_token',502);
  return json({file_token:d.data.file_token});
 }
 if(u.pathname==='/api/media'&&request.method==='GET'){
  const ft=(u.searchParams.get('file_token')||'').trim();
  const app=(u.searchParams.get('app_token')||env.FEISHU_APP_TOKEN||'').trim();
  const table=(u.searchParams.get('table_id')||env.FEISHU_TABLE_ID||'').trim();
  const field=(u.searchParams.get('field_id')||'').trim();
  const record=(u.searchParams.get('record_id')||'').trim();
  if(!/^[A-Za-z0-9_-]{6,}$/.test(ft))throw new ApiError('附件标识无效');
  if(!/^[A-Za-z0-9_-]+$/.test(app)||!/^tbl[A-Za-z0-9_-]+$/.test(table)||!/^fld[A-Za-z0-9_-]+$/.test(field)||!/^rec[A-Za-z0-9_-]+$/.test(record))throw new ApiError('附件上下文不完整，请重新同步资源',400);
  // Bitable 附件在开启高级权限后，下载素材必须携带 bitablePerm。
  // attachments: { fieldId: { recordId: [fileToken] } }
  const extra=JSON.stringify({bitablePerm:{tableId:table,attachments:{[field]:{[record]:[ft]}}}});
  const mediaUrl=new URL(`${API}/drive/v1/medias/${encodeURIComponent(ft)}/download`);
  mediaUrl.searchParams.set('extra',extra);
  const r=await fetch(mediaUrl,{headers:{authorization:`Bearer ${await token(c)}`}});
  if(!r.ok){let msg='';try{const d=await r.clone().json();msg=d.msg||d.message||''}catch{try{msg=(await r.text()).slice(0,300)}catch{}}throw new ApiError(`飞书附件读取失败：${msg||r.status}`,r.status===400?400:r.status===403?403:502)}
  const h=new Headers();h.set('content-type',r.headers.get('content-type')||'application/octet-stream');h.set('cache-control','private, max-age=21600');h.set('x-content-type-options','nosniff');
  return new Response(r.body,{status:200,headers:h});
 }
 if(u.pathname==='/api/resolve'&&request.method==='POST'){
  const {url,appToken:appTokenOverride}=await request.json();let link;try{link=new URL(url);}catch{throw new ApiError('请输入完整的飞书多维表格链接');}
  if(link.protocol!=='https:'||!/(^|\.)feishu\.cn$/.test(link.hostname))throw new ApiError('仅支持 https 飞书链接');
  const m=link.pathname.match(/^\/(base|wiki)\/([A-Za-z0-9_-]+)/);if(!m)throw new ApiError('请使用多维表格或知识库内多维表格链接');
  let app=m[1]==='base'?m[2]:(appTokenOverride||'').trim();
  if(m[1]==='wiki'&&!app){
    try{const d=await fs(c,`/wiki/v2/spaces/get_node?token=${m[2]}`);if(d.node?.obj_type!=='bitable')throw new ApiError('此知识库节点不是多维表格');app=d.node.obj_token;}
    catch(e){throw new ApiError(`${e.message}。如果这是知识库链接，请在“高级选项”填入右侧开发工具显示的 Base ID (appToken)。`,e.status||400);}
  }
  if(!/^[A-Za-z0-9_-]+$/.test(app||''))throw new ApiError('Base ID (appToken) 无效');
  const tables=await all(c,`/bitable/v1/apps/${app}/tables`);const table=link.searchParams.get('table')||(tables.length===1?tables[0].table_id:'');
  if(!table)throw new ApiError('链接包含多个数据表，请打开目标数据表后复制带 table= 的地址');if(!tables.some(t=>t.table_id===table))throw new ApiError('链接中的数据表不存在或应用无权访问');
  return json({url:link.href,appToken:app,tableId:table,name:tables.find(t=>t.table_id===table).name});
 }
 const {app,table}=ids(u);const base=`/bitable/v1/apps/${app}/tables/${table}`;
 if(u.pathname==='/api/table/fields'&&request.method==='GET')return json({items:await all(c,base+'/fields')});
 if(u.pathname==='/api/table/records'){
  if(request.method==='GET')return json({items:await Promise.all((await all(c,base+'/records',500)).map(tagged))});
  const body=await request.json();const rid=u.searchParams.get('record_id');
  if(['PUT','DELETE'].includes(request.method)){
   if(!/^rec[A-Za-z0-9_-]+$/.test(rid||''))throw new ApiError('记录标识无效');
   if(!body.revision)throw new ApiError('缺少编辑版本，请重新打开记录',409);
   const current=await fs(c,`${base}/records/${rid}`);if(await revision(current.record.fields||{})!==body.revision)throw new ApiError('这条记录已在飞书或其他窗口修改。请关闭后刷新记录再编辑。',409);
  }
  if(['POST','PUT'].includes(request.method)){
   if(!body.fields||Array.isArray(body.fields)||typeof body.fields!=='object')throw new ApiError('字段格式无效');
   const schema=await all(c,base+'/fields');const writable=new Set(schema.filter(f=>!f.is_computed&&[1,2,3,4,5,7,13,15,17,18,21].includes(f.type)).map(f=>f.field_name));
   if(Object.keys(body.fields).some(k=>!writable.has(k)))throw new ApiError('包含只读或暂不支持编辑的字段');
   const d=await fs(c,base+'/records'+(rid?'/'+rid:''),{method:request.method,body:JSON.stringify({fields:body.fields})});return json(d);
  }
  if(request.method==='DELETE'){await fs(c,`${base}/records/${rid}`,{method:'DELETE'});return json({success:true});}
 }
 return json({message:'接口不存在'},404);
 }catch(e){return json({message:e.message||'服务器错误'},e.status||500);}}};
