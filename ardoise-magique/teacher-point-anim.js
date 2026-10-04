window.HARMONIE_TEACHER_POINT = null;
window.HARMONIE_TEACHER_POINT_HD_READY = Promise.all([
  './assets/teacher-hd-01.b64',
  './assets/teacher-hd-02.b64',
  './assets/teacher-hd-03.b64',
  './assets/teacher-hd-04a.b64',
  './assets/teacher-hd-04b.b64'
].map(async (url)=>{
  const r=await fetch(url,{cache:'no-cache'});
  if(!r.ok)throw new Error('teacher hd '+r.status);
  return (await r.text()).trim();
})).then(parts=>{
  const b64=parts.join('');
  if(b64.length!==58080)throw new Error('teacher hd length '+b64.length);
  const src='data:image/webp;base64,'+b64;
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>{window.HARMONIE_TEACHER_POINT=src;resolve(src)};
    img.onerror=()=>reject(new Error('teacher hd decode'));
    img.src=src;
  });
}).then((src)=>{
  window.HARMONIE_TEACHER_POINT = src;
  return src;
}).catch((err)=>{
  window.HARMONIE_TEACHER_POINT_ERROR = err;
  console.error('Teacher animation unavailable',err);
  return null;
});
