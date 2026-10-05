function escapeSsml(value){
  return String(value||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&apos;');
}

function stableSsml(text){
  const clean=String(text||'')
    .replace(/\s+/g,' ')
    .replace(/\s*([,;:!?])\s*/g,'$1 ')
    .replace(/\s*\.\s*/g,'. ')
    .trim();
  const parts=clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  const body=parts.map(sentence=>{
    let spoken=escapeSsml(sentence);
    spoken=spoken.replace(/deuxième/gi,'<phoneme alphabet="ipa" ph="dø.zjɛm">deuxième</phoneme>');
    spoken=spoken.replace(/deuxièmes/gi,'<phoneme alphabet="ipa" ph="dø.zjɛm">deuxièmes</phoneme>');
    return '<s>'+spoken+'</s>';
  }).join('<break time="140ms"/>');
  return '<speak><prosody rate="94%" volume="+1dB">'+body+'</prosody></speak>';
}

module.exports=async function handler(req,res){
  const apiKey=process.env.GOOGLE_TTS_API_KEY;

  if(req.method==='GET'){
    return res.status(200).json({
      ok:true,
      provider:'google-text-to-speech',
      configured:Boolean(apiKey),
      voice:'fr-FR-Chirp3-HD-Leda'
    });
  }

  if(req.method!=='POST'){
    res.setHeader('Allow','GET, POST');
    return res.status(405).json({ok:false,code:'METHOD_NOT_ALLOWED'});
  }

  if(!apiKey){
    return res.status(503).json({
      ok:false,
      code:'GOOGLE_TTS_NOT_CONFIGURED',
      message:'La voix naturelle n’est pas encore configurée.'
    });
  }

  try{
    const input=typeof req.body==='string'?JSON.parse(req.body):(req.body||{});
    const text=String(input.text||'').replace(/\s+/g,' ').trim();
    if(!text)return res.status(400).json({ok:false,code:'EMPTY_TEXT'});
    if(text.length>500)return res.status(413).json({ok:false,code:'TEXT_TOO_LONG'});

    const upstream=await fetch(
      'https://texttospeech.googleapis.com/v1/text:synthesize?key='+encodeURIComponent(apiKey),
      {
        method:'POST',
        headers:{'Content-Type':'application/json; charset=utf-8'},
        body:JSON.stringify({
          input:{ssml:stableSsml(text)},
          voice:{
            languageCode:'fr-FR',
            name:'fr-FR-Chirp3-HD-Leda'
          },
          audioConfig:{
            audioEncoding:'MP3'
          }
        })
      }
    );

    const data=await upstream.json().catch(()=>({}));
    if(!upstream.ok||!data.audioContent){
      console.error('Google TTS error',upstream.status,JSON.stringify(data).slice(0,600));
      return res.status(502).json({ok:false,code:'GOOGLE_TTS_ERROR'});
    }

    res.setHeader('Cache-Control','private, max-age=86400');
    return res.status(200).json({ok:true,audioContent:data.audioContent});
  }catch(error){
    console.error('Teacher speech failure',error);
    return res.status(500).json({ok:false,code:'TTS_ERROR'});
  }
};
