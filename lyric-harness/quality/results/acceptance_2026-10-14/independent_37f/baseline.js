const fs=require('fs'),vm=require('vm'),path=require('path');
const root=process.argv[2];const app={lyricMeta:{version:1,ui:{renumbered:{items:[{kind:'reading',word:'oh',n:[1],from:2,to:3}],more:7}}}};
const ctx=vm.createContext({console,app,uiRegisterPage:()=>{},chatState:{generation:0},UI:{},lyricMetaOf:x=>x,uiCount:(n,w)=>`${n} ${w}`});
for(const f of ['src/lyric-tokens.js','src/pages/lyrics.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
const before='[SETUP — rhyme groups — '+Array(124).fill('1.T2,2.end').join(';')+']\n\n[VERSE]\nOh--oh, oh my love\nwe sing it plain tonight';ctx.before=before;
const got=vm.runInContext('lyMigrateSavedReadings(before)',ctx);ctx.after=got.text;
const out={head:require('child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),selected:before.slice(29,34),before:[29,34],after:vm.runInContext('[lyMapOffset(before,after,29,"start"),lyMapOffset(before,after,34,"end")]',ctx),moved:got.moved.length};
ctx.got=got;out.more_before=7;vm.runInContext('lyRecordRenumbered(got)',ctx);out.record_after=app.lyricMeta.renumbered;console.log(JSON.stringify(out,null,2));
