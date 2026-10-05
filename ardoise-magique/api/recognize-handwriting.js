function normalizeText(value){
  return String(value||'')
    .normalize('NFC')
    .toLocaleLowerCase('fr')
    .replace(/[’]/g,"'")
    .replace(/[.,;:!?]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function normalizeMath(value){
  return String(value||'')
    .replace(/[{}$\s]/g,'')
    .replace(/[xX*]/g,'×')
    .replace(/[/:]/g,'÷')
    .replace(/[−–—]/g,'-')
    .trim();
}

function diffExpectedIndices(expected,recognized){
  const a=[...normalizeText(expected)];
  const b=[...normalizeText(recognized)];
  const n=a.length,m=b.length;
  const dp=Array.from({length:n+1},()=>Array(m+1).fill(0));
  for(let i=0;i<=n;i++)dp[i][0]=i;
  for(let j=0;j<=m;j++)dp[0][j]=j;
  for(let i=1;i<=n;i++){
    for(let j=1;j<=m;j++){
      const cost=a[i-1]===b[j-1]?0:1;
      dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+cost);
    }
  }
  const bad=new Set();
  let i=n,j=m;
  while(i>0||j>0){
    if(i>0&&j>0&&a[i-1]===b[j-1]){i--;j--;continue}
    const sub=i>0&&j>0?dp[i-1][j-1]:Infinity;
    const del=i>0?dp[i-1][j]:Infinity;
    const ins=j>0?dp[i][j-1]:Infinity;
    const best=Math.min(sub,del,ins);
    if(best===sub){bad.add(i-1);i--;j--}
    else if(best===del){bad.add(i-1);i--}
    else{if(i<n)bad.add(i);j--}
  }
  return [...bad].filter(x=>x>=0&&x<n).sort((x,y)=>x-y);
}

function cleanBase64(value){
  return String(value||'').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/,'').replace(/\s+/g,'');
}

function extractVisionText(payload){
  const response=payload?.responses?.[0]||{};
  if(response.error){
    const err=new Error(response.error.message||'Google Vision error');
    err.code='VISION_UPSTREAM_ERROR';
    throw err;
  }
  return String(
    response?.fullTextAnnotation?.text
    ||response?.textAnnotations?.[0]?.description
    ||''
  ).trim();
}

module.exports=async function handler(req,res){
  const apiKey=process.env.GOOGLE_VISION_API_KEY;

  if(req.method==='GET'){
    return res.status(200).json({
      ok:true,
      provider:'google-vision',
      configured:Boolean(apiKey),
      feature:'DOCUMENT_TEXT_DETECTION'
    });
  }

  if(req.method!=='POST'){
    res.setHeader('Allow','GET, POST');
    return res.status(405).json({ok:false,code:'METHOD_NOT_ALLOWED',message:'GET ou POST uniquement.'});
  }

  if(!apiKey){
    return res.status(503).json({
      ok:false,
      code:'GOOGLE_VISION_NOT_CONFIGURED',
      message:'Google Vision n’est pas encore configuré.'
    });
  }

  try{
    const input=typeof req.body==='string'?JSON.parse(req.body):(req.body||{});
    const expected=String(input.expected||'').trim();
    const mode=input.mode==='math'?'math':'text';
    const image=cleanBase64(input.image);

    if(!expected||!image){
      return res.status(400).json({ok:false,code:'EMPTY_INK',message:'Aucune écriture à reconnaître.'});
    }

    if(image.length>5_500_000){
      return res.status(413).json({ok:false,code:'IMAGE_TOO_LARGE',message:'L’écriture envoyée est trop grande.'});
    }

    const payload={
      requests:[{
        image:{content:image},
        features:[{type:'DOCUMENT_TEXT_DETECTION'}],
        imageContext:{languageHints:['fr']}
      }]
    };

    const upstream=await fetch(
      'https://vision.googleapis.com/v1/images:annotate?key='+encodeURIComponent(apiKey),
      {
        method:'POST',
        headers:{'Content-Type':'application/json; charset=utf-8'},
        body:JSON.stringify(payload)
      }
    );

    const data=await upstream.json().catch(()=>({}));
    if(!upstream.ok){
      console.error('Google Vision recognition error',upstream.status,JSON.stringify(data).slice(0,600));
      return res.status(502).json({ok:false,code:'GOOGLE_VISION_ERROR',message:'Google Vision n’a pas pu lire l’écriture.'});
    }

    let recognized='';
    try{
      recognized=extractVisionText(data);
    }catch(error){
      console.error('Google Vision response error',error.message);
      return res.status(502).json({ok:false,code:'GOOGLE_VISION_ERROR',message:'Google Vision n’a pas pu lire l’écriture.'});
    }

    const wanted=mode==='math'?normalizeMath(expected):normalizeText(expected);
    const got=mode==='math'?normalizeMath(recognized):normalizeText(recognized);
    const match=Boolean(got)&&got===wanted;
    const mistakePositions=match||mode==='math'?[]:diffExpectedIndices(expected,recognized);

    return res.status(200).json({
      ok:true,
      match,
      quality:match?'accepted':'different',
      mistakePositions
    });
  }catch(error){
    console.error('Handwriting recognition failure',error);
    return res.status(500).json({ok:false,code:'RECOGNITION_ERROR',message:'Erreur de reconnaissance.'});
  }
};
