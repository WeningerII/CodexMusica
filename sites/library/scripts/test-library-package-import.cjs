const fs = require("node:fs"), ts = require("typescript"), assert = require("node:assert/strict"), crypto = require("node:crypto");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText, filename);
(async () => {
 const { importPackagePart } = require("../lib/library-package-import.ts");
 const bytes = new TextEncoder().encode("Pinned package bytes");
 const hash = crypto.createHash("sha256").update(bytes).digest("hex");
 const secret = "test-only-publication-key-over-32-bytes";
 const objects = new Map();
 const env = { DB:{}, READER_BRIDGE_SECRET:secret,
  ASSETS:{fetch:async()=>Response.json({manifest:{snapshot_id:"test-snapshot"},exports:{text:{parts:[{path:"part.bin",bytes:bytes.length,sha256:hash}]}}})},
  LIBRARY:{head:async key=>objects.has(key)?{size:objects.get(key).bytes.length,customMetadata:objects.get(key).options.customMetadata}:null,
   put:async(key,bytes,options)=>objects.set(key,{bytes,options})}};
 const call = (method, payload, {expired=false,badSignature=false,index=0}={}) => {
  const time = String(Math.floor(Date.now()/1000)-(expired?301:0));
  const input = ["library-package-v1",method,"test-snapshot","text",String(index),hash,time].join("\n");
  const signature = badSignature?"0".repeat(64):crypto.createHmac("sha256",secret).update(input).digest("hex");
  return importPackagePart(new Request("https://test.invalid/api/library/exports/package-parts/text/"+index+"?snapshot=test-snapshot",{method,headers:{"x-library-upload-time":time,"x-library-upload-signature":signature},...(payload?{body:payload}:{})}),env);
 };
 await assert.rejects(call("POST",bytes,{badSignature:true}), e=>e.code==="FORBIDDEN");
 await assert.rejects(call("POST",bytes,{expired:true}), e=>e.code==="FORBIDDEN");
 await assert.rejects(call("POST",bytes,{index:1}), e=>e.code==="BAD_REQUEST");
 await assert.rejects(call("POST",new Uint8Array(bytes.length)), e=>e.code==="STORAGE_CORRUPT");
 await assert.rejects(call("POST",new Uint8Array(bytes.length+1)), e=>e.code==="RESOURCE_LIMIT");
 assert.equal((await (await call("GET")).json()).ready,false);
 assert.equal((await (await call("POST",bytes)).json()).ready,true);
 assert.equal((await (await call("GET")).json()).ready,true);
 assert.equal(objects.size,1);
 console.log(JSON.stringify({passed:true,signature_required:true,expired_refused:true,corrupt_refused:true,size_bounded:true,verified_staging:true}));
})().catch(e=>{console.error(e);process.exitCode=1});
