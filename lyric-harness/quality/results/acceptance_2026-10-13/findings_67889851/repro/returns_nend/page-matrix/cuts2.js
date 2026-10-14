const T = require(process.argv[2] + '/src/lyric-tokens.js');
const V1PAGE = /(?:[A-Za-zÀ-ɏḀ-ỿ]|['-])+/g, L=/[A-Za-zÀ-ɏḀ-ỿ]/;
const pageV1 = (t,voices)=>{t=String(t).replace(/[’‘]/g,"'"); if(!voices) t=t.replace(/\([^)]*\)/g,' ');return (t.match(V1PAGE)||[]).filter(w=>L.test(w));};
const lines = process.argv.slice(3);
for (const l of lines) for (const voices of [false,true]) {
  const v2 = T.readerLine(l,{stripParens:!voices}).tokens.map(t=>({t:t.text,p:JSON.stringify(t.pieces)}));
  const g1 = T.v1GraderSpans(l,!voices);
  console.log(JSON.stringify(l), 'voices='+voices);
  console.log('  pageV1 :', JSON.stringify(pageV1(l,voices)));
  console.log('  graderV1:', g1 ? g1.map(s=>s.text+JSON.stringify(s.pieces)).join(' ') : null);
  console.log('  v2     :', v2.map(x=>x.t+x.p).join(' '));
}
