const fs=require('fs'),assert=require('assert');
const C=require('./order_com.js');
const OUT='/workspace/acceptance-final/library_delay.json';
const OH='Oh--oh, oh my love',DOVE='You are the one I dream of my dove';
const A=`[SETUP — reading — token 2 "oh" in ${JSON.stringify(OH)} — OW1 — declared — source: acceptance]\n\n[VERSE]\n${OH}\n${DOVE}`;
const B=`[SETUP — rhyme groups — 1.T4,4]\n[SETUP — returns — 1,3;1.line,3.line;1.head,3.head;2.end,4.end]\n\n[VERSE]\n${OH}\n${DOVE}\n${OH}\nwe sing it plain tonight`;
(async()=>{const {server,base}=await C.startServer('cand');const browser=await C.launch();const results=[];
try{for(const mode of ['undo-before-debounce','held-B-write']){
const {ctx,page,errors}=await C.boot(browser,base);const r={mode};results.push(r);
try{
await page.setInputFiles('#ly-file',{name:'a.txt',mimeType:'text/plain',buffer:Buffer.from(A)});
await page.waitForFunction(()=>lyDraft().value.includes('cut v2'));
r.a=await page.evaluate(()=>({text:lyDraft().value,meta:lyricMetaOf(app.lyricMeta)}));
await page.evaluate(()=>{window.__saveCalls=[];window.__held=[];window.__hold=false;const original=lyLibraryStore.saveDraft.bind(lyLibraryStore);lyLibraryStore.saveDraft=async record=>{const copy=JSON.parse(JSON.stringify(record));window.__saveCalls.push({id:copy.draftId,text:copy.text,meta:copy.meta});if(window.__hold&&copy.meta.libraryOrigin?.title==='B delayed')await new Promise(resolve=>window.__held.push(resolve));return original(copy);};});
const envelope=await page.evaluate(async text=>CMLibraryImport.makeWorkingCopyEnvelope(text,{version:1,brief:'',notes:{},drafts:{},ui:{},libraryOrigin:{version:1,handoffId:'handoff:'+crypto.randomUUID(),digest:'0'.repeat(64),importedAt:Date.now(),adapted:false,title:'B delayed',language:'eng',scope:'whole',provenance:{snapshotId:'snap:1',unitId:'unit:1',workId:'work:1',editionId:'ed:1',revisionId:'rev:1'},lineage:[],declarations:[]}}),B);
await page.evaluate(hold=>window.__hold=hold,mode==='held-B-write');
await page.setInputFiles('#ly-file',{name:'b.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(envelope))});
await page.waitForFunction(()=>lyDraft().value.includes('1.T5,4'));
r.b=await page.evaluate(()=>({text:lyDraft().value,meta:lyricMetaOf(app.lyricMeta)}));
if(mode==='held-B-write')await page.waitForFunction(()=>window.__held.length>0);
await page.locator('#btn-undo').click();
await page.waitForFunction(text=>lyDraft().value===text,r.a.text);
r.undo=await page.evaluate(()=>({text:lyDraft().value,meta:lyricMetaOf(app.lyricMeta)}));
await page.waitForTimeout(1800);
await page.evaluate(()=>{window.__hold=false;window.__held.splice(0).forEach(fn=>fn());});
await page.waitForTimeout(1500);
r.stored=await page.evaluate(async ids=>({a:await lyLibraryStore.getDraft(ids[0]),b:await lyLibraryStore.getDraft(ids[1]),session:JSON.parse(localStorage.getItem('codex-workbench-v1')),calls:window.__saveCalls}),[r.undo.meta.draftId,r.b.meta.draftId]);
assert.equal(r.stored.a.text,r.a.text);assert.equal(r.stored.b.text,r.b.text);assert.equal(r.stored.session.lyrics,r.a.text);
assert.equal(r.stored.a.meta.renumbered.items[0].word,'oh');assert.equal(r.stored.b.meta.renumbered.items[0].word,'love');assert.equal(r.stored.session.lyricMeta.draftId,r.undo.meta.draftId);
await page.reload();await page.waitForFunction(()=>typeof UI!=='undefined'&&UI.ready&&!!LY.model);
r.reload=await page.evaluate(()=>({text:lyDraft().value,meta:lyricMetaOf(app.lyricMeta)}));assert.equal(r.reload.text,r.a.text);
await page.locator('[data-ui="ly-tab"][data-id="history"]').click();
await page.locator('[data-ui="ly-library-restore"]').filter({hasText:'Open draft'}).first().waitFor();
await page.locator(`[data-ui="ly-library-restore"][data-id="${r.b.meta.draftId}"]`).click();
await page.waitForFunction(id=>lyMeta().draftId===id,r.b.meta.draftId);
r.reopen=await page.evaluate(()=>({text:lyDraft().value,meta:lyricMetaOf(app.lyricMeta)}));assert.equal(r.reopen.text,r.b.text);assert.equal(r.reopen.meta.renumbered.items[0].word,'love');
r.pass=true;
}catch(e){r.error=e.stack;}r.pageErrors=errors;await ctx.close();fs.writeFileSync(OUT,JSON.stringify(results,null,2));}
}finally{await browser.close();server.close();}console.log(results.map(r=>({mode:r.mode,pass:r.pass,error:r.error})));if(results.some(r=>!r.pass))process.exitCode=1;})().catch(e=>{console.error(e);process.exit(1)});
