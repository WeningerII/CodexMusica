// Headless Chromium emulation: phone, gate opened from the Tools-panel callout "Run review", then Cancel. usage: node probe_tools_callout.js <root>
const fs=require('fs'),path=require('path');const {chromium}=require('playwright');const root=path.resolve(process.argv[2]);
const text='[VERSE — 40 lines]\n'+Array.from({length:40},(_,i)=>`I sing the quiet song ${i+1}`).join('\n');
(async()=>{const base=process.env.PLAYWRIGHT_BROWSERS_PATH;const executablePath=fs.readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).map(n=>path.join(base,n,'chrome-linux/chrome')).find(fs.existsSync);
const b=await chromium.launch({headless:true,executablePath,args:['--no-sandbox']});const res={};
for (const [w,h] of [[390,508],[390,844]]) {
const ctx=await b.newContext({viewport:{width:w,height:h},isMobile:true,hasTouch:true});
await ctx.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname==='127.0.0.1'){const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(f.startsWith(root+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile())return r.fulfill({path:f});return r.fulfill({status:404});}if(u.hostname==='mcp.codexmusica.com')return r.fulfill({json:{ok:true,enabled:true}});return r.abort();});
await ctx.addInitScript(()=>localStorage.setItem('codex-theme','light'));const p=await ctx.newPage();await p.goto('http://127.0.0.1/codex.html#lyrics');
await p.waitForFunction(()=>typeof LY!=='undefined'&&LY.model&&UI.ready);
await p.evaluate(t=>{lyDraft().value=t;uiSaveLyrics();pushHistory();lyDraftSet('rhythm','0','meter','6/8');LY.tool='';lyRefresh(true);},text);
await p.tap('#ly-mtab-tools');await p.waitForTimeout(200);
const btn=p.locator('#ly-panel-tools [data-ui="ly-run-review"]');const has=await btn.count();
if(has){await btn.focus();await p.keyboard.press('Enter');await p.waitForTimeout(200);
const open=await p.evaluate(()=>{const r=document.querySelector('[data-ui="ly-gate-apply"]')?.getBoundingClientRect();return {gate:!!LY.gate,applyTop:r&&Math.round(r.top),vh:innerHeight}});
await p.locator('[data-ui="ly-gate-close"]').focus();await p.keyboard.press('Enter');await p.waitForTimeout(200);
res[`${w}x${h}`]={open,after:await p.evaluate(()=>{const a=document.activeElement;const r=a.getBoundingClientRect();return {ui:a.dataset?.ui||a.tagName,inTools:!!a.closest('#ly-panel-tools'),inHead:!!a.closest('#ly-head'),top:Math.round(r.top),bottom:Math.round(r.bottom),vh:innerHeight}})};} else res[`${w}x${h}`]='no tools callout';
await ctx.close();}
await b.close();console.log(JSON.stringify(res,null,1));})();
