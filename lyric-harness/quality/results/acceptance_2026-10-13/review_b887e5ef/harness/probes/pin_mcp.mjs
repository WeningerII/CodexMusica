import {pathToFileURL} from 'node:url';
const root=process.env.ACCEPTANCE_ROOT;
const load=p=>import(pathToFileURL(root+'/'+p));
const {Client}=await load('mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js');
const {InMemoryTransport}=await load('mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/inMemory.js');
const {buildServer}=await load('mcp/tools.js');
const {_workerInternals}=await load('mcp/lyric_tools.js');
const server=buildServer(),client=new Client({name:'pin-probe',version:'1'},{capabilities:{}});
const [ct,st]=InMemoryTransport.createLinkedPair();await Promise.all([server.connect(st),client.connect(ct)]);
try{
 for (const basis of [undefined,'none']) {
  const args={lines:['Read--read, read it again','the bed is made for me'],groups:'1.T2,2.T2',numbering:'v2',relation:'perfect rhyme'};
  if (basis) args.lexicon_supplement=basis;
  const res=await client.callTool({name:'lyric_check',arguments:args},undefined,{timeout:120000});
  const row=res.content.map(x=>{try{return JSON.parse(x.text)}catch{return null}}).find(x=>typeof x?.exit_code==='number');
  console.log(JSON.stringify({basis:basis??'(default)',isError:res.isError,exit:row?.exit_code,certified:row?.certified,lexicon:row?.lexicon,refused:row?.coverage?.refused_obligations, text: row?null:JSON.stringify(res.content).slice(0,400)}));
 }
} finally {await Promise.allSettled([client.close(),server.close()]);await _workerInternals.kill();}
