const T = require(process.argv[2] + '/src/lyric-tokens.js');
const V1PAGE = /(?:[A-Za-zÀ-ɏḀ-ỿ]|['-])+/g, L=/[A-Za-zÀ-ɏḀ-ỿ]/;
const pageV1 = (t)=>{t=String(t).replace(/[’‘]/g,"'").replace(/\([^)]*\)/g,' ');return (t.match(V1PAGE)||[]).filter(w=>L.test(w));};
const lines = process.argv.slice(3);
for (const l of lines) {
  const v2 = T.readerLine(l,{stripParens:true}).tokens.map(t=>({t:t.text,p:JSON.stringify(t.pieces)}));
  const g1 = T.v1GraderSpans(l,true);
  console.log(JSON.stringify(l));
  console.log('  pageV1 :', JSON.stringify(pageV1(l)));
  console.log('  graderV1:', g1 ? g1.map(s=>s.text+JSON.stringify(s.pieces)).join(' ') : null);
  console.log('  v2     :', v2.map(x=>x.t+x.p).join(' '));
}
