const crypto=require('node:crypto');

function normalizeText(value){
  return String(value||'')
    .normalize('NFC')
    .toLocaleLowerCase('fr')
    .replace(/[’]/g,"'")
    .replace(/[.,;:!?]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function withoutDiacritics(value){
  return normalizeText(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

function normalizeMath(value){
  return String(value||'')
    .replace(/\\left|\\right|\\mathrm|\\text/g,'')
    .replace(/[{}$\s]/g,'')
    .replace(/\\times/g,'×')
    .replace(/\\div/g,'÷')
    .trim();
}

function extractPlainText(raw,mode){
  const text=String(raw||'').trim();
  if(!text)return '';
  try{
    const obj=JSON.parse(text);
    const candidates=[
      obj.label,obj.text,obj.value,obj.result,
      obj?.words?.map?.(x=>x.label||x.text||'').join(' '),
      obj?.expressions?.map?.(x=>x.label||x.text||'').join(' ')
    ].filter(x=>typeof x==='string'&&x.trim());
    if(candidates.length)return candidates[0].trim();
  }catch{}
  return mode==='math'?normalizeMath(text):text;
}

function diffExpectedIndices(expected,recognized){
  const a=[...withoutDiacritics(expected)];
  const b=[...withoutDiacritics(recognized)];
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

module.exports=async function handler(req,res){
  if(req.method!=='POST'){
    res.setHeader('Allow','POST');
    return res.status(405).json({ok:false,code:'METHOD_NOT_ALLOWED',message:'POST uniquement.'});
  }

  const applicationKey=process.env.MYSCRIPT_APPLICATION_KEY;
  const hmacKey=process.env.MYSCRIPT_HMAC_KEY;
  if(!applicationKey||!hmacKey){
    return res.status(503).json({ok:false,code:'MYSCRIPT_NOT_CONFIGURED',message:'Clés MyScript non configurées.'});
  }

  try{
    const input=typeof req.body==='string'?JSON.parse(req.body):(req.body||{});
    const expected=String(input.expected||'').trim();
    const mode=input.mode==='math'?'math':'text';
    const strokes=Array.isArray(input.strokes)?input.strokes:[];
    const lexicon=Array.isArray(input.lexicon)?input.lexicon.map(String).filter(Boolean).slice(0,100):[];

    if(!expected||!strokes.length){
      return res.status(400).json({ok:false,code:'EMPTY_INK',message:'Aucune écriture à reconnaître.'});
    }

    const cleanStrokes=strokes.map((stroke,index)=>{
      const x=Array.isArray(stroke.x)?stroke.x.map(Number):[];
      const y=Array.isArray(stroke.y)?stroke.y.map(Number):[];
      const t=Array.isArray(stroke.t)?stroke.t.map(Number):[];
      const valid=x.length>1&&x.length===y.length&&x.every(Number.isFinite)&&y.every(Number.isFinite);
      if(!valid)return null;
      const out={id:String(index+1),x,y};
      if(t.length===x.length&&t.every(Number.isFinite))out.t=t;
      return out;
    }).filter(Boolean);

    if(!cleanStrokes.length){
      return res.status(400).json({ok:false,code:'EMPTY_INK',message:'Aucun trait exploitable.'});
    }

    // Safari/iPad fournit des temps relatifs à la page. MyScript attend surtout
    // une chronologie propre : on repart du premier point et on garantit une
    // progression strictement croissante à l'intérieur de chaque trait.
    const timed=cleanStrokes.flatMap(st=>Array.isArray(st.t)?st.t:[]).filter(Number.isFinite);
    if(timed.length){
      const baseT=Math.min(...timed);
      for(const st of cleanStrokes){
        if(!Array.isArray(st.t))continue;
        let previous=-1;
        st.t=st.t.map(value=>{
          const relative=Math.max(0,Math.round(value-baseT));
          const normalized=Math.max(relative,previous+1);
          previous=normalized;
          return normalized;
        });
      }
    }

    const configuration={lang:'fr_FR'};
    if(mode==='text'){
      const words=[...new Set(lexicon.flatMap(v=>normalizeText(v).split(/\s+/)).filter(Boolean))].slice(0,200);
      configuration.text={configuration:{customLexicon:words,addLKText:true}};
    }

    const payload={
      scaleX:25.4/96,
      scaleY:25.4/96,
      contentType:mode==='math'?'Math':'Text',
      configuration,
      strokes:cleanStrokes
    };

    const body=JSON.stringify(payload);
    const hmac=crypto.createHmac('sha512',applicationKey+hmacKey).update(body,'utf8').digest('hex');
    const accept=mode==='math'?'application/x-latex,application/json':'text/plain,application/json';

    const upstream=await fetch('https://cloud.myscript.com/api/v4.0/iink/recognize/',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Accept':accept,
        'applicationKey':applicationKey,
        'hmac':hmac
      },
      body
    });

    const raw=await upstream.text();
    if(!upstream.ok){
      console.error('MyScript recognition error',upstream.status,raw.slice(0,600));
      return res.status(502).json({ok:false,code:'MYSCRIPT_ERROR',message:'MyScript n’a pas pu lire l’écriture.'});
    }

    const recognized=extractPlainText(raw,mode);
    const wanted=mode==='math'?normalizeMath(expected):normalizeText(expected);
    const got=mode==='math'?normalizeMath(recognized):normalizeText(recognized);
    const match=mode==='math'
      ? got===wanted
      : (got===wanted||withoutDiacritics(got)===withoutDiacritics(wanted));

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
