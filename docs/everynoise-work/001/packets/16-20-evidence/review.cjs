const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'../../../../../');
const C=require(path.join(root,'scripts/_loader'));const sigs=require(path.join(root,'references/_tradition_signatures.json'));const P=require('../16-20.json');
for(const e of P.entries){C.TRADITIONS.push(e.tradition);C.TRADITION_EXTRAS[e.id]=e.extras;sigs[e.id]=e.signature_tokens}
const {seedTraditionCards,renderWorkspace}=require(path.join(root,'scripts/_seed_workspace'));
const R={checked_at:new Date().toISOString(),scope:'Production Node seed/render with packet records in memory. Browser parity remains parent overlay responsibility.',entries:[]};
for(const e of P.entries){const cards=seedTraditionCards(e.id);const formats={};for(const format of ['rich','tags','prose','compact'])formats[format]=renderWorkspace(cards,{format});R.entries.push({id:e.id,signature_tokens:e.signature_tokens,prefaces:cards.map(c=>({instrument:c.instrumentId,preface:c.preface})),formats});console.log(e.id,formats.rich);}
fs.writeFileSync(path.join(__dirname,'render-review.json'),JSON.stringify(R,null,2)+'\n');
