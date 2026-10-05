'use strict';

const express=require('express');
const path=require('node:path');

const app=express();
const root=__dirname;
const wrap=handler=>(req,res,next)=>Promise.resolve(handler(req,res)).catch(next);

app.disable('x-powered-by');
app.use(express.json({limit:'8mb'}));

app.all('/api/teacher-speech',wrap(require('./api/teacher-speech')));
app.all('/api/sync',wrap(require('./api/sync')));
app.all('/api/recognize-handwriting',wrap(require('./api/recognize-handwriting')));
app.all('/api/recognize-poetry',wrap(require('./api/recognize-poetry')));
app.all('/api/harmonie-idle-video',wrap(require('./api/harmonie-idle-video')));
app.all('/api/harmonie-point-video',wrap(require('./api/harmonie-point-video')));
app.all('/api/teacher-video',wrap(require('./api/teacher-video')));
app.all('/api/harmonie-pixverse',wrap(require('./api/harmonie-pixverse')));

app.use(express.static(root,{
  index:'index.html',
  maxAge:'1h',
  setHeaders(res,filePath){
    if(/\.(mp4|m4a|wav)$/i.test(filePath))res.setHeader('Accept-Ranges','bytes');
    if(/\.(html|js|css|json)$/i.test(filePath))res.setHeader('Cache-Control','public, max-age=300');
  }
}));

app.get('*',(req,res,next)=>{
  if(req.path.startsWith('/api/'))return next();
  res.sendFile(path.join(root,'index.html'));
});

app.use((err,req,res,next)=>{
  console.error('Harmonie server error',err);
  if(res.headersSent)return next(err);
  res.status(500).json({ok:false,error:'SERVER_ERROR'});
});

const port=Number(process.env.PORT||8080);
app.listen(port,'0.0.0.0',()=>console.log('Harmonie listening on '+port));
