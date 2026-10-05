const assert=require('node:assert/strict');
const crypto=require('node:crypto');
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
  const oldApp=process.env.MYSCRIPT_APPLICATION_KEY;
  const oldHmac=process.env.MYSCRIPT_HMAC_KEY;
  const oldFetch=global.fetch;
  try{
    delete process.env.MYSCRIPT_APPLICATION_KEY;
    delete process.env.MYSCRIPT_HMAC_KEY;
    let res=response();
    await handler({method:'POST',body:{expected:'une rue',strokes:[{x:[1,2],y:[1,2],t:[1,2]}]}},res);
    assert.equal(res.statusCode,503);
    assert.equal(res.payload.code,'MYSCRIPT_NOT_CONFIGURED');

    process.env.MYSCRIPT_APPLICATION_KEY='app-test';
    process.env.MYSCRIPT_HMAC_KEY='hmac-test';

    let captured=null;
    global.fetch=async(url,options)=>{
      captured={url,options};
      return {ok:true,status:200,text:async()=> 'une rue'};
    };

    res=response();
    await handler({
      method:'POST',
      body:{
        expected:'une rue',
        mode:'text',
        lexicon:['une rue','le roi','mon frère'],
        strokes:[
          {x:[10,11,12],y:[20,21,22],t:[5000.4,5000.4,5002.2]},
          {x:[30,31],y:[40,41],t:[5100.1,5101.1]}
        ]
      }
    },res);

    assert.equal(res.statusCode,200);
    assert.equal(res.payload.ok,true);
    assert.equal(res.payload.match,true);
    assert.equal('recognized' in res.payload,false,'recognized text must remain invisible to the child/browser');

    assert.equal(captured.url,'https://cloud.myscript.com/api/v4.0/iink/recognize/');
    const body=JSON.parse(captured.options.body);
    assert.equal(body.contentType,'Text');
    assert.equal(body.configuration.lang,'fr_FR');
    assert.ok(body.configuration.text.configuration.customLexicon.includes('une'));
    assert.ok(body.configuration.text.configuration.customLexicon.includes('rue'));
    assert.equal(body.strokes[0].t[0],0,'timestamps must be normalized from the first ink point');
    for(const stroke of body.strokes){
      for(let i=1;i<stroke.t.length;i++)assert.ok(stroke.t[i]>stroke.t[i-1],'stroke timestamps must be strictly increasing');
    }
    const expectedHmac=crypto.createHmac('sha512','app-test'+'hmac-test').update(captured.options.body,'utf8').digest('hex');
    assert.equal(captured.options.headers.applicationKey,'app-test');
    assert.equal(captured.options.headers.hmac,expectedHmac);
    assert.match(captured.options.headers.Accept,/text\/plain/);

    global.fetch=async()=>({ok:true,status:200,text:async()=> 'mon frere'});
    res=response();
    await handler({method:'POST',body:{
      expected:'mon frère',mode:'text',lexicon:['mon frère'],
      strokes:[{x:[1,2,3],y:[1,2,3],t:[100,101,102]}]
    }},res);
    assert.equal(res.payload.match,true,'accent-only differences should be accepted');

    global.fetch=async()=>({ok:true,status:200,text:async()=> 'une roue'});
    res=response();
    await handler({method:'POST',body:{
      expected:'une rue',mode:'text',lexicon:['une rue'],
      strokes:[{x:[1,2,3],y:[1,2,3],t:[100,101,102]}]
    }},res);
    assert.equal(res.payload.match,false);
    assert.ok(Array.isArray(res.payload.mistakePositions));
    assert.ok(res.payload.mistakePositions.length>0);

    console.log('MyScript handwriting API checks passed.');
  }finally{
    if(oldApp===undefined)delete process.env.MYSCRIPT_APPLICATION_KEY;else process.env.MYSCRIPT_APPLICATION_KEY=oldApp;
    if(oldHmac===undefined)delete process.env.MYSCRIPT_HMAC_KEY;else process.env.MYSCRIPT_HMAC_KEY=oldHmac;
    global.fetch=oldFetch;
  }
}
run().catch(err=>{console.error(err);process.exit(1)});
