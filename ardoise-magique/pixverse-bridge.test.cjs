const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

const routePath=path.join(__dirname,'api/harmonie-pixverse.js');
assert.ok(fs.existsSync(routePath),'PixVerse API bridge route must exist');
const handler=require(routePath);

function response(){
  return {
    headers:{},statusCode:200,body:null,ended:false,
    setHeader(name,value){this.headers[name]=value;return this},
    status(code){this.statusCode=code;return this},
    json(body){this.body=body;return this},
    end(){this.ended=true;return this}
  };
}

async function invoke(req,env={}){
  const before={PIXVERSE_API_KEY:process.env.PIXVERSE_API_KEY,HARMONIE_BRIDGE_TOKEN:process.env.HARMONIE_BRIDGE_TOKEN};
  if(env.PIXVERSE_API_KEY===undefined)delete process.env.PIXVERSE_API_KEY;else process.env.PIXVERSE_API_KEY=env.PIXVERSE_API_KEY;
  if(env.HARMONIE_BRIDGE_TOKEN===undefined)delete process.env.HARMONIE_BRIDGE_TOKEN;else process.env.HARMONIE_BRIDGE_TOKEN=env.HARMONIE_BRIDGE_TOKEN;
  const res=response();
  try{await handler(req,res);return res}
  finally{
    for(const key of Object.keys(before)){
      if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];
    }
  }
}

(async()=>{
  const method=await invoke({method:'GET',headers:{},body:{}});
  assert.equal(method.statusCode,405);
  assert.equal(method.headers.Allow,'POST');

  const unauthorized=await invoke({method:'POST',headers:{},body:{action:'generate'}},{PIXVERSE_API_KEY:'test-key',HARMONIE_BRIDGE_TOKEN:'secret-token'});
  assert.equal(unauthorized.statusCode,401);

  const missingApiKey=await invoke({method:'POST',headers:{authorization:'Bearer secret-token'},body:{action:'generate'}},{HARMONIE_BRIDGE_TOKEN:'secret-token'});
  assert.equal(missingApiKey.statusCode,503);
  assert.equal(missingApiKey.body.code,'PIXVERSE_NOT_CONFIGURED');
  assert.ok(!JSON.stringify(missingApiKey.body).includes('secret-token'));

  const invalid=await invoke({method:'POST',headers:{authorization:'Bearer secret-token'},body:{action:'generate',imageDataUrl:'data:image/png;base64,%%%'}},{PIXVERSE_API_KEY:'test-key',HARMONIE_BRIDGE_TOKEN:'secret-token'});
  assert.equal(invalid.statusCode,400);
  assert.equal(invalid.body.code,'INVALID_IMAGE');

  const unsupported=await invoke({method:'POST',headers:{authorization:'Bearer secret-token'},body:{action:'admin'}},{PIXVERSE_API_KEY:'test-key',HARMONIE_BRIDGE_TOKEN:'secret-token'});
  assert.equal(unsupported.statusCode,400);
  assert.equal(unsupported.body.code,'INVALID_ACTION');

  const originalFetch=global.fetch;
  const calls=[];
  global.fetch=async(url,options={})=>{
    calls.push({url:String(url),options});
    if(String(url).endsWith('/image/upload')) return new Response(JSON.stringify({ErrCode:0,Resp:{img_id:77}}),{status:200});
    if(String(url).endsWith('/video/img/generate')){
      const payload=JSON.parse(options.body);
      assert.equal(payload.duration,10);
      assert.equal(payload.quality,'1080p');
      assert.equal(payload.img_id,77);
      return new Response(JSON.stringify({ErrCode:0,Resp:{video_id:123}}),{status:200});
    }
    return new Response(JSON.stringify({ErrCode:0,Resp:{status:1,url:'https://media.pixverse.ai/test.mp4',outputWidth:1080,outputHeight:1920}}),{status:200});
  };
  try{
    const created=await invoke({method:'POST',headers:{authorization:'Bearer secret-token'},body:{
      action:'generate',imageDataUrl:'data:image/png;base64,aGVsbG8=',quality:'1080p',prompt:'Animate a complete full-body teacher on green screen with all items visible.'
    }},{PIXVERSE_API_KEY:'pixverse-private-key',HARMONIE_BRIDGE_TOKEN:'secret-token'});
    assert.equal(created.statusCode,200);
    assert.equal(created.body.videoId,'123');
    assert.ok(!JSON.stringify(created.body).includes('pixverse-private-key'));
    assert.equal(calls.length,2);
    assert.equal(calls[0].options.headers['API-KEY'],'pixverse-private-key');
    assert.ok(calls[0].options.body instanceof FormData);
    assert.ok(calls.every(call=>call.options.headers['Ai-trace-id']));

    const ready=await invoke({method:'POST',headers:{authorization:'Bearer secret-token'},body:{action:'status',videoId:'123'}},{PIXVERSE_API_KEY:'pixverse-private-key',HARMONIE_BRIDGE_TOKEN:'secret-token'});
    assert.equal(ready.statusCode,200);
    assert.equal(ready.body.status,1);
    assert.equal(ready.body.url,'https://media.pixverse.ai/test.mp4');
    assert.equal(calls.length,3);
  }finally{
    global.fetch=originalFetch;
  }

  console.log('PixVerse bridge auth checks passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
