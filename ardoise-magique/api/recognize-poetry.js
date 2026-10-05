'use strict';

const {v2}=require('@google-cloud/speech');
const speechClient=new v2.SpeechClient();

const POEM=[
  'J’ai regardé les feuilles rouges, elles tombaient.',
  'J’ai regardé les feuilles jaunes, elles volaient.',
  'J’ai regardé les feuilles brunes que le vent poussait.',
  'Rouges, jaunes, brunes, chacune dansait.'
];
const MAX_AUDIO_BYTES=10*1024*1024;

function json(res,status,body){
  res.setHeader('Cache-Control','no-store');
  return res.status(status).json(body);
}

function normalize(text){
  return String(text||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLocaleLowerCase('fr')
    .replace(/[’']/g,' ')
    .replace(/[^a-zœæ\s-]/g,' ')
    .replace(/-/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function words(text){return normalize(text).split(' ').filter(Boolean)}

function editDistance(a,b){
  const prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    let last=prev[0];
    prev[0]=i;
    for(let j=1;j<=b.length;j++){
      const old=prev[j];
      prev[j]=Math.min(
        prev[j]+1,
        prev[j-1]+1,
        last+(a[i-1]===b[j-1]?0:1)
      );
      last=old;
    }
  }
  return prev[b.length];
}

function sameSpokenWord(expected,heard){
  if(expected===heard)return true;
  if(Math.min(expected.length,heard.length)>=4){
    if(editDistance(expected,heard)<=1)return true;
    const shorter=expected.length<=heard.length?expected:heard;
    const longer=expected.length>heard.length?expected:heard;
    if(longer.startsWith(shorter)&&longer.length-shorter.length<=3)return true;
  }
  return false;
}

function compare(expected,spoken){
  const a=words(expected),b=words(spoken);
  const dp=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
  for(let i=1;i<=a.length;i++){
    for(let j=1;j<=b.length;j++){
      dp[i][j]=sameSpokenWord(a[i-1],b[j-1])?dp[i-1][j-1]+1:Math.max(dp[i-1][j],dp[i][j-1]);
    }
  }
  const matched=dp[a.length][b.length];
  const contentScore=a.length?matched/a.length:0;
  const fullMatched=fullExpected.filter(word=>fullSpoken.includes(word)).length;
  const fullScore=fullExpected.length?fullMatched/fullExpected.length:0;
  const score=Math.max(contentScore,contentScore*.86+fullScore*.14);
  const missing=[];
  let i=a.length,j=b.length;
  while(i>0){
    if(j>0&&sameSpokenWord(a[i-1],b[j-1])){i--;j--;continue}
    if(j>0&&dp[i][j-1]>=dp[i-1][j]){j--;continue}
    missing.push(a[i-1]);i--;
  }
  missing.reverse();
  return {score,missingWords:[...new Set(missing)].slice(0,6)};
}

function parseAudio(value){
  const match=String(value||'').match(/^data:(audio\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i);
  if(!match)return null;
  const bytes=Buffer.from(match[2],'base64');
  if(!bytes.length||bytes.length>MAX_AUDIO_BYTES)return null;
  return {mimeType:match[1],bytes};
}

module.exports=async function handler(req,res){
  if(req.method!=='POST'){
    res.setHeader('Allow','POST');
    return json(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'});
  }
  const part=Number(req.body?.part);
  const whole=part===0;
  if(!whole&&(!Number.isInteger(part)||part<1||part>POEM.length)){
    return json(res,400,{ok:false,code:'INVALID_POEM_PART'});
  }
  const audio=parseAudio(req.body?.audioDataUrl);
  if(!audio)return json(res,400,{ok:false,code:'INVALID_AUDIO'});
  const expected=whole?POEM.join(' '):POEM[part-1];

  try{
    const projectId=process.env.GOOGLE_CLOUD_PROJECT||process.env.GCLOUD_PROJECT||'harmonie-ardoise-philippe';
    const [response]=await speechClient.recognize({
      recognizer:`projects/${projectId}/locations/global/recognizers/_`,
      config:{
        autoDecodingConfig:{},
        languageCodes:['fr-FR'],
        model:'short',
        features:{enableAutomaticPunctuation:true}
      },
      content:audio.bytes
    });
    const transcript=(response.results||[])
      .map(r=>r.alternatives?.[0]?.transcript||'')
      .filter(Boolean)
      .join(' ')
      .trim();
    if(!transcript)return json(res,200,{ok:true,transcript:'',score:0,missingWords:words(expected).slice(0,6),match:false,almost:false});
    const result=compare(expected,transcript);
    return json(res,200,{
      ok:true,
      transcript,
      score:result.score,
      missingWords:result.missingWords,
      match:result.score>=0.80,
      almost:result.score>=0.58
    });
  }catch(error){
    console.error('Poetry Speech-to-Text',error?.code||error?.message||error);
    return json(res,502,{ok:false,code:'SPEECH_RECOGNITION_FAILED'});
  }
};
