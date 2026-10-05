'use strict';
const crypto=require('node:crypto');
const {Firestore}=require('@google-cloud/firestore');

const db=new Firestore();
const collection=db.collection('harmonie_family_sync');

function json(res,status,body){
  res.setHeader('Cache-Control','no-store');
  return res.status(status).json(body);
}

function codeId(code){
  const clean=String(code||'').toUpperCase().replace(/[^A-Z2-9]/g,'');
  if(!/^[A-Z2-9]{10}$/.test(clean))return null;
  return crypto.createHash('sha256').update('harmonie:'+clean).digest('hex');
}

function cleanState(input){
  const state=input&&typeof input==='object'?input:{};
  const stats={};
  for(const [key,value] of Object.entries(state.stats||{}).slice(0,1200)){
    if(value&&typeof value==='object')stats[String(key).slice(0,180)]=value;
  }
  return {
    stats,
    sessions:Array.isArray(state.sessions)?state.sessions.slice(0,120):[],
    customLessons:Array.isArray(state.customLessons)?state.customLessons.slice(0,100):[]
  };
}

function mergeStats(a={},b={}){
  const out={...a};
  for(const [key,r] of Object.entries(b||{})){
    const l=out[key]||{};
    const lt=Date.parse(l.last||'')||0;
    const rt=Date.parse(r?.last||'')||0;
    const latest=rt>=lt?r:l;
    const dueValues=[Number(l.due),Number(r?.due)].filter(Number.isFinite);
    out[key]={
      ...latest,
      attempts:Math.max(Number(l.attempts||0),Number(r?.attempts||0)),
      correct:Math.max(Number(l.correct||0),Number(r?.correct||0)),
      errors:Math.max(Number(l.errors||0),Number(r?.errors||0)),
      hints:Math.max(Number(l.hints||0),Number(r?.hints||0)),
      mastery:Math.max(Number(l.mastery||0),Number(r?.mastery||0)),
      due:dueValues.length?Math.min(...dueValues):Date.now()
    };
  }
  return out;
}

function mergeSessions(a=[],b=[]){
  const map=new Map();
  for(const s of [...b,...a]){
    if(!s||!s.date)continue;
    const key=[s.date,s.lessonId,s.stars,s.total].join('|');
    if(!map.has(key))map.set(key,s);
  }
  return [...map.values()].sort((x,y)=>String(y.date).localeCompare(String(x.date))).slice(0,120);
}

function mergeLessons(a=[],b=[]){
  const map=new Map();
  for(const l of [...a,...b])if(l?.id)map.set(String(l.id),l);
  return [...map.values()].slice(0,100);
}

function mergeState(a,b){
  const left=cleanState(a),right=cleanState(b);
  return {
    stats:mergeStats(left.stats,right.stats),
    sessions:mergeSessions(left.sessions,right.sessions),
    customLessons:mergeLessons(left.customLessons,right.customLessons)
  };
}

module.exports=async function handler(req,res){
  if(req.method!=='POST'){
    res.setHeader('Allow','POST');
    return json(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'});
  }
  const id=codeId(req.body?.code);
  if(!id)return json(res,400,{ok:false,code:'INVALID_SYNC_CODE'});
  const ref=db.collection('harmonie_family_sync').doc(id);
  const action=String(req.body?.action||'');

  if(action==='pull'){
    const snap=await ref.get();
    return json(res,200,{ok:true,exists:snap.exists,state:snap.exists?cleanState(snap.data()?.state):null});
  }
  if(action!=='push')return json(res,400,{ok:false,code:'INVALID_SYNC_ACTION'});

  const incoming=cleanState(req.body?.state);
  let merged=incoming;
  await db.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    merged=mergeState(snap.exists?snap.data()?.state:null,incoming);
    tx.set(ref,{state:merged,updatedAt:Date.now()},{merge:true});
  });
  return json(res,200,{ok:true,exists:true,state:merged});
};
