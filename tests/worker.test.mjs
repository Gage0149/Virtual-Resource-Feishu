import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker,{revision} from '../worker/index.js';
const env={FEISHU_APP_ID:'test',FEISHU_APP_SECRET:'test-secret',ASSETS:{fetch:()=>new Response('asset')}};
const request=(path,method='GET',body,withCreds=true)=>new Request('https://manager.test'+path,{method,headers:withCreds?{'x-feishu-app-id':'test','x-feishu-app-secret':'test-secret','content-type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});
const ep='/api/table/records?app_token=baseTest&table_id=tblTest';
const fields={资源名称:'旧标题',分类:['recCategory']};
const originalFetch=globalThis.fetch;
let calls=[];
function mock(handler){calls=[];globalThis.fetch=async(url,options={})=>{calls.push({url,options});if(url.includes('/auth/'))return Response.json({code:0,tenant_access_token:'mock',expire:7200});return Response.json({code:0,data:await handler(url,options)});};}
test('personal mode reports missing browser or runtime credentials',async()=>{const noEnv={ASSETS:env.ASSETS};assert.equal((await worker.fetch(request(ep,'GET',null,false),noEnv)).status,503);});
test('personal mode does not require a base allowlist',async()=>{mock(url=>url.includes('/records')?{items:[]}:{items:[]});assert.equal((await worker.fetch(request(ep.replace('baseTest','baseOther')),env)).status,200);});
test('records and fields follow pagination and records include revision',async()=>{mock(url=>url.includes('/records')?url.includes('page_token=next')?{items:[{record_id:'rec2',fields}],has_more:false}:{items:[{record_id:'rec1',fields}],has_more:true,page_token:'next'}:url.includes('page_token=next')?{items:[{field_name:'B'}]}:{items:[{field_name:'A'}],has_more:true,page_token:'next'});const d=await(await worker.fetch(request(ep),env)).json();assert.equal(d.items.length,2);assert.equal(d.items[0].revision,await revision(fields));const f=await(await worker.fetch(request(ep.replace('/records','/fields')),env)).json();assert.equal(f.items.length,2);});
test('update preserves incremental fields and rejects stale edits',async()=>{mock((url,opt)=>opt.method==='PUT'?{record:{record_id:'rec1',fields:JSON.parse(opt.body).fields}}:url.includes('/fields')?{items:[{field_name:'资源名称',type:1}]}:{record:{record_id:'rec1',fields}});let r=await worker.fetch(request(ep+'&record_id=rec1','PUT',{revision:'stale',fields:{资源名称:'新标题'}}),env);assert.equal(r.status,409);assert.equal(calls.filter(c=>c.options.method==='PUT').length,0);r=await worker.fetch(request(ep+'&record_id=rec1','PUT',{revision:await revision(fields),fields:{资源名称:'新标题'}}),env);assert.equal(r.status,200);assert.deepEqual(JSON.parse(calls.find(c=>c.options.method==='PUT').options.body),{fields:{资源名称:'新标题'}});});
test('computed fields cannot be written',async()=>{mock(()=>({items:[{field_name:'公式',type:20,is_computed:true}]}));assert.equal((await worker.fetch(request(ep,'POST',{fields:{公式:'x'}}),env)).status,400);});
test('wiki resolves to bitable token and validates selected table',async()=>{mock(url=>url.includes('/wiki/')?{node:{obj_type:'bitable',obj_token:'baseTest'}}:{items:[{table_id:'tblTest',name:'资源总表'}]});const r=await worker.fetch(request('/api/resolve','POST',{url:'https://team.feishu.cn/wiki/wikiNode?table=tblTest'}),env);assert.equal(r.status,200);assert.equal((await r.json()).appToken,'baseTest');});
test('ordinary wiki document is rejected with specific message',async()=>{mock(()=>({node:{obj_type:'docx',obj_token:'docTest'}}));const r=await worker.fetch(request('/api/resolve','POST',{url:'https://team.feishu.cn/wiki/wikiNode'}),env);assert.equal(r.status,400);assert.match((await r.json()).message,/不是多维表格/);});
test('upstream failure is never reported as a saved record',async()=>{globalThis.fetch=async()=>Response.json({code:1254302,msg:'permission denied'});const r=await worker.fetch(request(ep,'POST',{fields:{资源名称:'x'}}),env);assert.equal(r.status,502);});
test('delete requires a current revision',async()=>{mock(()=>({record:{fields}}));const r=await worker.fetch(request(ep+'&record_id=rec1','DELETE',{revision:'stale'}),env);assert.equal(r.status,409);assert.equal(calls.filter(c=>c.options.method==='DELETE').length,0);globalThis.fetch=originalFetch;});

test('bitable attachment download includes advanced permission context',async()=>{
  let mediaRequest='';
  globalThis.fetch=async(url,options={})=>{
    if(String(url).includes('/auth/'))return Response.json({code:0,tenant_access_token:'mock',expire:7200});
    mediaRequest=String(url);
    return new Response(new Uint8Array([137,80,78,71]),{status:200,headers:{'content-type':'image/png'}});
  };
  const path='/api/media?file_token=boxToken123&app_token=baseTest&table_id=tblTest&field_id=fldCover&record_id=recTest';
  const r=await worker.fetch(request(path),env);
  assert.equal(r.status,200);
  const parsed=new URL(mediaRequest);
  const extra=JSON.parse(parsed.searchParams.get('extra'));
  assert.equal(extra.bitablePerm.tableId,'tblTest');
  assert.deepEqual(extra.bitablePerm.attachments,{fldCover:{recTest:['boxToken123']}});
  globalThis.fetch=originalFetch;
});


test('cover upload proxies multipart media upload to Feishu',async()=>{
  let uploadUrl='',uploadOptions;
  globalThis.fetch=async(url,options={})=>{
    if(String(url).includes('/auth/'))return Response.json({code:0,tenant_access_token:'mock',expire:7200});
    uploadUrl=String(url);uploadOptions=options;
    return Response.json({code:0,data:{file_token:'boxUploaded'}});
  };
  const fd=new FormData();fd.set('app_token','baseTest');fd.set('file',new File([new Uint8Array([137,80,78,71])],'cover.png',{type:'image/png'}));
  const req=new Request('https://manager.test/api/media/upload',{method:'POST',headers:{'x-feishu-app-id':'test','x-feishu-app-secret':'test-secret'},body:fd});
  const r=await worker.fetch(req,env);assert.equal(r.status,200);assert.equal((await r.json()).file_token,'boxUploaded');assert.match(uploadUrl,/drive\/v1\/medias\/upload_all/);assert.equal(uploadOptions.method,'POST');
  globalThis.fetch=originalFetch;
});
