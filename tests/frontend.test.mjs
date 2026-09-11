import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
const nodes=new Map();
const node=()=>({innerHTML:'',textContent:'',disabled:false,value:'',style:{},classList:{contains:()=>true,add(){},remove(){},toggle(){}},addEventListener(){}});
const storage=()=>({getItem(){return null;},setItem(){},removeItem(){}});
const context=vm.createContext({console,URL,URLSearchParams,Date,JSON,Map,Set,crypto:webcrypto,location:{protocol:'file:'},localStorage:storage(),sessionStorage:storage(),document:{querySelector(s){if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);},querySelectorAll:()=>[],addEventListener(){},body:{style:{}}},window:{addEventListener(){}},setInterval(){},AbortSignal});
vm.runInContext(fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),context);
const run=s=>vm.runInContext(s,context);
test('demo displays twelve resources and proper category labels',()=>{assert.match(nodes.get('#view').innerHTML,/安卓单机游戏合集/);assert.equal(run('filtered().length'),12);assert.equal(run("value(state.data.resources.records[0],'category')"),'游戏 / 安卓单机');});
test('parent category filtering and linked platform filtering work',()=>{assert.equal(run("state.category='游戏';filtered().length"),2);assert.equal(run("state.category='';state.platform='X';filtered().length"),1);run("state.platform=''");});
test('renaming linked classification changes resource label without rewriting resource',()=>{assert.equal(run("state.data.categories.records[0].fields.名称='游戏 / 手机游戏';value(state.data.resources.records[0],'category')"),'游戏 / 手机游戏');});
test('field codecs preserve Feishu URL, numeric, date, checkbox, multi-select and relation types',()=>{const result=run(`formValues({elements:{namedItem(k){return {标题:{value:'文本'},日期:{value:'2026-09-10T12:00'},数量:{value:'0'},链接:{value:'https://example.com'},链接__linktext:{value:'访问'},标签:{value:'甲、乙'},勾选:{checked:false,value:''},分类:{value:'demo_c0',selectedOptions:[{value:'demo_c0'}]}}[k]}}},[{field_name:'标题',type:1},{field_name:'日期',type:5},{field_name:'数量',type:2},{field_name:'链接',type:15},{field_name:'标签',type:4},{field_name:'勾选',type:7},{field_name:'分类',type:18,property:{table_id:'demo_categories'}}])`);assert.equal(result.数量,0);assert.equal(typeof result.日期,'number');assert.equal(result.勾选,false);assert.deepEqual(JSON.parse(JSON.stringify(result.链接)),{link:'https://example.com',text:'访问'});assert.equal(result.标签.length,2);assert.equal(result.分类[0],'demo_c0');});
test('text escaping and unsafe URL protection',()=>{assert.equal(run("safeUrl('javascript:alert(1)')"),'');assert.equal(run("esc('<img onerror=alert(1)>')"),'&lt;img onerror=alert(1)&gt;');});
test('attachment fields are writable while computed and unresolved relation fields stay read-only',()=>{assert.equal(run('writable({type:17})'),true);assert.equal(run('writable({type:1,is_computed:true})'),false);assert.equal(Boolean(run('writable({type:18,property:{table_id:"unknown"}})')),false);});

test('资源封面 attachment field is recognized and supplies media context',()=>{run("state.demo=false;state.config.resources={appToken:'baseTest',tableId:'tblTest'};state.data.resources.schema=[{field_name:'资源封面',field_id:'fldCover',type:17}];state.data.resources.records=[{record_id:'recTest',fields:{资源封面:[{file_token:'boxToken'}]}}]");assert.equal(run("role('cover','resources')"),'资源封面');assert.deepEqual(JSON.parse(JSON.stringify(run("mediaContext(state.data.resources.records[0],'resources')"))),{appToken:'baseTest',tableId:'tblTest',fieldId:'fldCover',recordId:'recTest'});});

test('single and multi-select controls use Feishu options',()=>{assert.match(run(`control({field_name:'网盘链接状态',type:3,property:{options:[{name:'正常'},{name:'失效'}]}},'正常')`),/<select/);assert.match(run(`control({field_name:'发布状态',type:4,property:{options:[{name:'闲鱼 ✅'},{name:'X ✅'}]}},['X ✅'])`),/multiple/);});
