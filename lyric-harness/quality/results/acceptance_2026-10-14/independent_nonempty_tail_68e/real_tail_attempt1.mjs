import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {writeFileSync} from 'node:fs';
const root=process.env.ACCEPTANCE_ROOT||'/workspace/acceptance-68e';
const load=p=>import(pathToFileURL(root+'/'+p));
const {Client}=await load('mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js');
const {InMemoryTransport}=await load('mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/inMemory.js');
const {buildServer}=await load('mcp/tools.js');
const {withExecutionContext}=await load('mcp/execution_context.js');
const {_workerInternals,RUNS}=await load('mcp/lyric_tools.js');
const {decodeState}=await load('mcp/state_codec.js');
const server=buildServer(),client=new Client({name:'independent-nonempty-tail',version:'1'},{capabilities:{}});
const [ct,st]=InMemoryTransport.createLinkedPair();await Promise.all([server.connect(st),client.connect(ct)]);
const input=['Cat','Dog','Sun'], edits=['I watched the window like a diplomat','She tumbled down the stairs, an acrobat'];
const evidence={head:'68e213d0aadf589319bce345b8eebc4b0d0a60f1',host_call_limit:4,host_continuation_limit:3,timeout_ms:120000,input,edits,calls:[]};
async function call(args){assert.ok(evidence.calls.length<evidence.host_call_limit,'host call bound');const t=Date.now();const res=await client.callTool({name:'lyric_revise',arguments:args},undefined,{timeout:120000});assert.ok(!res.isError,JSON.stringify(res));const row=res.content.map(x=>{try{return JSON.parse(x.text)}catch{return null}}).find(x=>typeof x?.exit_code==='number');assert.ok(row);const state=decodeState(row.state);evidence.calls.push({number:evidence.calls.length+1,seconds:(Date.now()-t)/1000,exit_code:row.exit_code,status:row.status,run_id:row.run_id,run_revision:row.run_revision,final_draft:row.final_draft,pending:state.pending,accepted_lines:state.accepted_lines,outcomes:state.outcomes,answered:state.answered});return {row,state};}
try{
 const first=await call({scheme:'AAA',relation:'class:RHYME',draft:input,writer:'interview',attempts:1,backtrack:0,max_rounds:1});
 assert.equal(first.state.pending.kind,'propose');assert.equal(first.state.pending.record.line,2);
 const omitted=[3];assert.ok(omitted.length>0);assert.ok(!first.state.answered.propose.some(x=>omitted.includes(x.line)));evidence.omitted_tail=omitted;
 const ctl=new AbortController();let checkpoints=0;
 const stopped=await withExecutionContext({signal:ctl.signal,onCheckpoint(record){if(record.status==='accepted'){checkpoints++;ctl.abort();}}},()=>call({state:first.row.state,answer:edits[0]}));
 assert.equal(stopped.row.status,'interrupted');assert.ok(checkpoints>0);assert.deepEqual(stopped.state.accepted_lines,[input[0],edits[0],input[2]]);assert.ok(stopped.state.outcomes.some(x=>x.line===2&&x.accepted===true));
 // Kill the actual Python process and clear the connector cache: restart from serialized state.
 await _workerInternals.kill();RUNS.del(stopped.row.run_id);assert.equal(RUNS.byId(stopped.row.run_id), undefined);
 const resumed=await call({state:stopped.row.state});
 assert.equal(resumed.row.exit_code,4);assert.equal(resumed.state.pending.kind,'propose');assert.equal(resumed.state.pending.record.line,3);assert.deepEqual(resumed.state.accepted_lines,stopped.state.accepted_lines);
 assert.ok(!resumed.state.answered.propose.some(x=>x.line===3));
 const finished=await call({state:resumed.row.state,answer:edits[1]});
 assert.deepEqual(finished.row.final_draft,[input[0],...edits]);assert.deepEqual(finished.state.accepted_lines,[input[0],...edits]);assert.deepEqual(finished.row.replay_draft,input);
 assert.ok(finished.state.outcomes.some(x=>x.line===3&&x.accepted===true));
 evidence.actual_retained_edits=[{line:2,before:'Dog',after:edits[0]},{line:3,before:'Sun',after:edits[1]}];evidence.pass=true;console.log('PASS real MCP/Python: nonempty remaining tail [3], actual accepted L2 survives interruption/worker kill/cache loss, resumed L3 accepted; 4 calls/3 continuations.');
}finally{writeFileSync('/workspace/acceptance-tail/real_tail.json',JSON.stringify(evidence,null,2)+'\n');await Promise.allSettled([client.close(),server.close()]);await _workerInternals.kill();}
