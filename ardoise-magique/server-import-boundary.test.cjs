'use strict';
const assert=require('node:assert/strict');
const Module=require('node:module');
const path=require('node:path');

const originalLoad=Module._load;
const routes={};
let apiImports=0;
const app={
  disable(){return this;},
  use(){return this;},
  all(route,handler){routes[route]=handler;return this;},
  get(route,handler){routes['GET '+route]=handler;return this;},
  listen(){return {close(){}};}
};
function express(){return app;}
express.json=()=>()=>{};
express.static=()=>()=>{};

Module._load=function(request,parent,isMain){
  if(request==='express')return express;
  if(request.startsWith('./api/')){
    apiImports++;
    throw new Error('Simulated unavailable API provider configuration');
  }
  return originalLoad.call(this,request,parent,isMain);
};

try{
  assert.doesNotThrow(()=>require(path.join(__dirname,'server.js')),
    'the app should start without initializing optional API services');
  assert.equal(apiImports,0,'API modules must not load during app startup');
  assert.equal(typeof routes['/api/sync'],'function','the API route remains registered');

  let routedError;
  routes['/api/sync']({}, {}, error=>{routedError=error;});
  assert.match(routedError.message,/Simulated unavailable API provider configuration/);
  assert.equal(apiImports,1,'the service should load only when its route is used');
  process.stdout.write('PASS: app startup is isolated from optional API initialization failures\\n');
}finally{
  Module._load=originalLoad;
}
