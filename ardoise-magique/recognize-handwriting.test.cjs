const assert=require('node:assert/strict');
const handler=require('./api/recognize-handwriting.js');

function response(){
  return {
    statusCode:200,
    headers:{},
    payload:null,
    setHeader(k,v){this.headers[k]=v},
    status(n){this.statusCode=n;return this},
    json(v){this.payload=v;return this}
  };
}

async function run(){
  const oldKey=process.env.GOOGLE_VISION_API_KEY;
  const oldFetch=global.fetch;
  try{
    delete process.env.GOOGLE_VISION_API_KEY;

    let res=response();
    await handler({method:'GET'},res);
    assert.equal(res.statusCode,200);
    assert.deepEqual(res.payload,{ok:true,provider:'google-vision',configured:false,feature:'DOCUMENT_TEXT_DETECTION'});

    res=response();
    await handler({method:'POST',body:{expected:'une rue',image:'abc'}},res);
    assert.equal(res.statusCode,503);
    assert.equal(res.payload.code,'GOOGLE_VISION_NOT_CONFIGURED');

    process.env.GOOGLE_VISION_API_KEY='vision-test-key';

    res=response();
    await handler({method:'GET'},res);
    assert.equal(res.payload.configured,true);

    let captured=null;
    global.fetch=async(url,options)=>{
      captured={url,options};
      return {
        ok:true,status:200,
        json:async()=>({responses:[{fullTextAnnotation:{text:'une rue\n'}}]})
      };
    };

    res=response();
    await handler({method:'POST',body:{
      expected:'une rue',
      mode:'text',
      image:'iVBORw0KGgoAAA-test'
    }},res);

    assert.equal(res.statusCode,200);
    assert.equal(res.payload.ok,true);
    assert.equal(res.payload.match,true);
    assert.equal('recognized' in res.payload,false,'recognized text must remain invisible to the child/browser');
    assert.ok(captured.url.includes('https://vision.googleapis.com/v1/images:annotate'));
    assert.ok(captured.url.includes('key=vision-test-key'));

    const body=JSON.parse(captured.options.body);
    assert.equal(body.requests[0].features[0].type,'DOCUMENT_TEXT_DETECTION');
    assert.equal(body.requests[0].image.content,'iVBORw0KGgoAAA-test');

    global.fetch=async()=>({
      ok:true,status:200,
      json:async()=>({responses:[{fullTextAnnotation:{text:'mon frere'}}]})
    });
    res=response();
    await handler({method:'POST',body:{expected:'mon frère',mode:'text',image:'abc'}},res);
    assert.equal(res.payload.match,false,'accent spelling errors must not be accepted');
    assert.ok(res.payload.mistakePositions.length>0,'accent spelling errors must be highlighted');

    global.fetch=async()=>({
      ok:true,status:200,
      json:async()=>({responses:[{textAnnotations:[{description:'une roue'}]}]})
    });
    res=response();
    await handler({method:'POST',body:{expected:'une rue',mode:'text',image:'abc'}},res);
    assert.equal(res.payload.match,false);
    assert.ok(Array.isArray(res.payload.mistakePositions));
    assert.ok(res.payload.mistakePositions.length>0);

    global.fetch=async()=>({
      ok:false,status:403,
      json:async()=>({error:{message:'PERMISSION_DENIED'}})
    });
    res=response();
    await handler({method:'POST',body:{expected:'une rue',mode:'text',image:'abc'}},res);
    assert.equal(res.statusCode,502);
    assert.equal(res.payload.code,'GOOGLE_VISION_ERROR');

    console.log('Google Vision handwriting API checks passed.');
  }finally{
    if(oldKey===undefined)delete process.env.GOOGLE_VISION_API_KEY;
    else process.env.GOOGLE_VISION_API_KEY=oldKey;
    global.fetch=oldFetch;
  }
}
run().catch(err=>{console.error(err);process.exit(1)});
