const SOURCE='https://d2ol7oe51mr4n9.cloudfront.net/user_3CNZlGstqB82H8rW1cNlNbHQ2QU/c3d59621-f172-45e5-b2eb-2851e6e9810a.mp4';

module.exports=async function handler(req,res){
  if(req.method!=='GET'&&req.method!=='HEAD'){
    res.setHeader('Allow','GET, HEAD');
    return res.status(405).end();
  }
  try{
    const headers={};
    if(req.headers.range)headers.Range=req.headers.range;
    const upstream=await fetch(SOURCE,{headers});
    if(!upstream.ok&&upstream.status!==206){
      return res.status(502).json({ok:false,error:'teacher_video_unavailable'});
    }
    const passthrough=['content-type','content-length','content-range','accept-ranges','etag','last-modified'];
    for(const name of passthrough){
      const value=upstream.headers.get(name);
      if(value)res.setHeader(name,value);
    }
    res.setHeader('Cache-Control','public, max-age=86400, s-maxage=604800, immutable');
    res.status(upstream.status);
    if(req.method==='HEAD')return res.end();
    const bytes=Buffer.from(await upstream.arrayBuffer());
    return res.end(bytes);
  }catch(error){
    console.error('teacher-video proxy',error);
    return res.status(502).json({ok:false,error:'teacher_video_proxy_error'});
  }
};
