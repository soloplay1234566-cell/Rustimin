import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowRight, AudioLines, ChevronRight, Disc3, FileMusic, FolderOpen, Globe2, Heart, Headphones, Library, ListMusic, LoaderCircle, Maximize2, MoreHorizontal, Music2, Pause, Play, Plus, Radio, Repeat, Search, Settings2, Shuffle, SkipBack, SkipForward, Sparkles, Trash2, Volume2, VolumeX, X } from 'lucide-react'
import { countries, demos, formatTime, parseFilename, parseLrc, validStreamUrl, type Track } from './model'
import { deleteTrack, getSetting, readTracks, setSetting, storeTrack } from './storage'

type Page = 'now' | 'library' | 'favorites' | 'radio' | 'settings'
type Station = {stationuuid:string; name:string; url_resolved:string; countrycode:string; tags:string; codec:string}
declare global {interface Window { desktop?: {fullscreen:()=>Promise<void>} }}
const labels: Record<Page,string> = {now:'Сейчас играет', library:'Моя медиатека', favorites:'Избранное', radio:'Музыка мира', settings:'Настройки'}
const radioHosts = ['de1.api.radio-browser.info', 'de2.api.radio-browser.info']
function Bars({active=false}:{active?:boolean}) { return <span className={`bars ${active?'moving':''}`} aria-hidden="true">{[0,1,2,3,4].map(i=><i key={i} style={{animationDelay:`${i*.13}s`}} />)}</span> }

export default function App() {
  const [page,setPage] = useState<Page>('now')
  const [tracks,setTracks] = useState<Track[]>(demos)
  const [current,setCurrent] = useState<Track>(demos[0])
  const [queue,setQueue] = useState<Track[]>(demos)
  const [playing,setPlaying] = useState(false)
  const [loading,setLoading] = useState(false)
  const [position,setPosition] = useState(0)
  const [duration,setDuration] = useState(0)
  const [volume,setVolume] = useState(.7)
  const [muted,setMuted] = useState(false)
  const [repeat,setRepeat] = useState(false)
  const [shuffle,setShuffle] = useState(false)
  const [favorites,setFavorites] = useState<Track[]>([])
  const [savedRadios,setSavedRadios] = useState<Track[]>([])
  const [query,setQuery] = useState('')
  const [country,setCountry] = useState('RU')
  const [stations,setStations] = useState<Track[]>([])
  const [radioLoading,setRadioLoading] = useState(false)
  const [radioError,setRadioError] = useState('')
  const [retry,setRetry] = useState(0)
  const [toast,setToast] = useState('')
  const [queueOpen,setQueueOpen] = useState(false)
  const [streamOpen,setStreamOpen] = useState(false)
  const [streamName,setStreamName] = useState('')
  const [streamUrl,setStreamUrl] = useState('')
  const [dragging,setDragging] = useState(false)
  const [loaded,setLoaded] = useState(false)
  const [clock,setClock] = useState(new Date())
  const [reducedMotion,setReducedMotion] = useState(false)
  const audio = useRef<HTMLAudioElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const lyricInput = useRef<HTMLInputElement>(null)
  const objectUrls = useRef(new Set<string>())
  const autoplay = useRef(false)
  const activeLine = useRef<HTMLDivElement>(null)
  const lyricContainer = useRef<HTMLDivElement>(null)
  const lyricIndex = (current.lyrics || []).reduce((last,line,i)=>position >= line.time ? i : last,-1)
  const isFavorite = favorites.some(t=>t.id===current.id)
  const isRadio = current.kind === 'radio'

  useEffect(()=>{
    let alive=true
    Promise.all([readTracks(),getSetting<Track[]>('favorites',[]),getSetting('volume',.7),getSetting<Track[]>('radios',[]),getSetting('reducedMotion',false)]).then(([saved,favs,vol,radios,motion])=>{
      if(!alive)return
      const local=saved.map(t=>{const src=URL.createObjectURL(t.blob);objectUrls.current.add(src);return {...t,src}})
      setTracks([...demos,...local]);setFavorites(favs);setVolume(vol);setSavedRadios(radios);setReducedMotion(motion);setLoaded(true)
    }).catch(()=>{setToast('Не удалось открыть хранилище. Проверьте свободное место и разрешения.');setLoaded(true)})
    return ()=>{alive=false;objectUrls.current.forEach(u=>URL.revokeObjectURL(u));objectUrls.current.clear()}
  },[])
  useEffect(()=>{if(toast){const id=setTimeout(()=>setToast(''),5000);return()=>clearTimeout(id)}},[toast])
  useEffect(()=>{const id=setInterval(()=>setClock(new Date()),1000);return()=>clearInterval(id)},[])
  useEffect(()=>{if(audio.current){audio.current.volume=volume;audio.current.muted=muted}if(loaded)setSetting('volume',volume).catch(()=>setToast('Не удалось сохранить громкость'))},[volume,muted,loaded])
  useEffect(()=>{
    const el=audio.current;if(!el || !current.src)return
    el.src=current.src;el.load();setPosition(0);setDuration(0);setPlaying(false);setLoading(false)
    if(autoplay.current){autoplay.current=false;setLoading(true);el.play().catch(err=>{if(err.name!=='AbortError'){setLoading(false);setToast('Не удалось включить аудио. Проверьте файл или доступность радиостанции.')}})}
  },[current.id,current.src])
  useEffect(()=>{const line=activeLine.current;const container=lyricContainer.current;if(line&&container)container.scrollTo({top:line.offsetTop-container.offsetTop-container.clientHeight/2+line.clientHeight/2,behavior:reducedMotion?'instant':'smooth'})},[lyricIndex, page, reducedMotion])
  useEffect(()=>{
    if(page!=='radio')return
    const controller=new AbortController();let alive=true
    setRadioLoading(true);setRadioError('');setStations([])
    const timer=setTimeout(async()=>{
      let result:Station[]|undefined
      for(const host of radioHosts){
        try{
          const params=new URLSearchParams({countrycode:country,limit:'48',hidebroken:'true',order:'votes',reverse:'true', ...(query.trim()?{name:query.trim()}: {})})
          const response=await fetch(`https://${host}/json/stations/search?${params}`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(9000)])})
          if(!response.ok)throw new Error('HTTP '+response.status)
          result=await response.json();if(!Array.isArray(result))throw new Error('Invalid response');break
        }catch{if(controller.signal.aborted)return}
      }
      if(!alive)return
      setRadioLoading(false)
      if(result)setStations(result.filter(s=>validStreamUrl(s.url_resolved)).map(s=>({id:s.stationuuid,title:s.name,artist:countries.find(c=>c.code===s.countrycode)?.name || s.countrycode,cover:'./art/orbit.svg',src:s.url_resolved,kind:'radio',country:s.countrycode,genre:s.tags.split(',').slice(0,2).join(' · ') || s.codec})))
      else setRadioError('Каталог радио сейчас недоступен. Проверьте интернет или добавьте прямую ссылку на поток.')
    },350)
    return()=>{alive=false;clearTimeout(timer);controller.abort()}
  },[page,country,query,retry])
  useEffect(()=>{
    if(!('mediaSession' in navigator))return
    navigator.mediaSession.metadata=new MediaMetadata({title:current.title,artist:current.artist,album:current.kind==='radio'?'Rustimin Radio':'Rustimin'})
    navigator.mediaSession.playbackState=playing?'playing':'paused'
    const handlers: [MediaSessionAction, MediaSessionActionHandler][]=[['play',()=>audio.current?.play().catch(()=>setToast('Не удалось включить аудио'))],['pause',()=>audio.current?.pause()],['previoustrack',()=>nextTrack(-1)],['nexttrack',()=>nextTrack()],['seekbackward',()=>seek(Math.max(0,position-10))],['seekforward',()=>seek(position+10)]]
    handlers.forEach(([action,handler])=>{try{navigator.mediaSession.setActionHandler(action,handler)}catch{/* Unsupported media action */}})
    return()=>handlers.forEach(([action])=>{try{navigator.mediaSession.setActionHandler(action,null)}catch{/* Unsupported media action */}})
  })
  const notifySave = (key:string, value:unknown) => {setSetting(key,value).catch(()=>setToast('Не удалось сохранить изменения. Проверьте свободное место.'))}
  function navigate(next:Page){setPage(next);setQuery('')}
  function playTrack(track:Track, list:Track[]=queue){
    const resolved=track.kind==='local'?tracks.find(t=>t.id===track.id):track
    if(!resolved?.src){setToast('Файл не найден в медиатеке. Добавьте его снова.');return}
    setQueue(list)
    if(current.id===resolved.id){audio.current?.play().catch(()=>setToast('Не удалось воспроизвести аудио'));return}
    autoplay.current=true;setCurrent(resolved)
  }
  function togglePlay(){const el=audio.current;if(!el)return;if(el.paused){setLoading(true);el.play().catch(()=>{setLoading(false);setToast('Источник недоступен или формат аудио не поддерживается.')})}else{el.pause();setLoading(false)}}
  function nextTrack(direction=1){
    if(queue.length===0)return
    const index=queue.findIndex(t=>t.id===current.id)
    let next=(index+direction+queue.length)%queue.length
    if(shuffle && queue.length>1)next=(Math.max(0,index)+1+Math.floor(Math.random()*(queue.length-1)))%queue.length
    const target=queue[next]
    if(target.id===current.id){if(audio.current){audio.current.currentTime=0;audio.current.play().catch(()=>setToast('Не удалось воспроизвести аудио'))}}else playTrack(target)
  }
  function seek(value:number){if(audio.current && !isRadio && Number.isFinite(audio.current.duration)){audio.current.currentTime=value;setPosition(value)}}
  function favorite(track:Track){const next=favorites.some(t=>t.id===track.id)?favorites.filter(t=>t.id!==track.id):[...favorites,{...track,src:track.kind==='local'?undefined:track.src}];setFavorites(next);notifySave('favorites',next)}
  useEffect(()=>{
    const handler=(event:KeyboardEvent)=>{if(event.code==='Escape'){setQueueOpen(false);setStreamOpen(false);return}
      if(event.key==='Tab'&&(queueOpen||streamOpen)){const dialog=document.querySelector('[role=dialog]');const nodes=dialog?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),[tabindex="0"]');if(nodes?.length){const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}}
      const tag=(event.target as HTMLElement).tagName;if(['INPUT','TEXTAREA','SELECT','BUTTON'].includes(tag) || (event.target as HTMLElement).isContentEditable)return
      if(event.code==='Space'){event.preventDefault();togglePlay()}
      if(event.code==='ArrowRight'){event.preventDefault();event.ctrlKey?nextTrack():seek(position+5)}
      if(event.code==='ArrowLeft'){event.preventDefault();event.ctrlKey?nextTrack(-1):seek(Math.max(0,position-5))}
      if(event.code==='Escape'){setQueueOpen(false);setStreamOpen(false)}
    };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)
  })
  async function importMusic(files:FileList|File[]|null){
    if(!files)return
    const valid=Array.from(files).filter(f=>/\.(mp3|wav|ogg|flac|m4a|aac|opus|webm)$/i.test(f.name))
    if(!valid.length){setToast('Выберите аудиофайлы MP3, FLAC, WAV, OGG или M4A.');return}
    const imported:Track[]=[]
    for(const file of valid){
      const track:Track={id:crypto.randomUUID(),...parseFilename(file.name),cover:'./art/dawn.svg',kind:'local',genre:'Локальный файл'}
      try{await storeTrack(track,file);const src=URL.createObjectURL(file);objectUrls.current.add(src);imported.push({...track,src})}catch{setToast('Не удалось сохранить файл. Возможно, в хранилище недостаточно места.');break}
    }
    setTracks(prev=>[...prev,...imported]);if(imported.length)setToast(`Добавлено треков: ${imported.length}`)
    if(fileInput.current)fileInput.current.value=''
  }
  async function importLyrics(file?:File){
    if(!file)return
    const target=current;const lyrics=parseLrc(await file.text())
    if(!lyrics.length){setToast('В LRC не найдены строки с метками времени, например [00:12.00].');return}
    const updated={...target,lyrics}
    try{
      if(target.kind==='local'){const saved=(await readTracks()).find(t=>t.id===target.id);if(saved)await storeTrack(updated,saved.blob)}
      setCurrent(prev=>prev.id===target.id?updated:prev);setTracks(prev=>prev.map(t=>t.id===target.id?updated:t));setQueue(prev=>prev.map(t=>t.id===target.id?updated:t));setToast('Текст песни добавлен')
    }catch{setToast('Не удалось сохранить текст песни')}
    if(lyricInput.current)lyricInput.current.value=''
  }
  async function removeTrack(track:Track){
    try{await deleteTrack(track.id);setTracks(prev=>prev.filter(t=>t.id!==track.id));setQueue(prev=>prev.filter(t=>t.id!==track.id));if(current.id===track.id)setCurrent(demos[0]);if(favorites.some(t=>t.id===track.id))favorite(track);if(track.src){URL.revokeObjectURL(track.src);objectUrls.current.delete(track.src)}setToast('Трек удалён из медиатеки. Исходный файл сохранён.')}catch{setToast('Не удалось удалить трек')}
  }
  function addStream(){
    if(!streamName.trim() || !validStreamUrl(streamUrl.trim())){setToast('Укажите название и прямую HTTP/HTTPS-ссылку на аудиопоток.');return}
    const track:Track={id:crypto.randomUUID(),title:streamName.trim(),artist:'Моя радиостанция',cover:'./art/orbit.svg',src:streamUrl.trim(),kind:'radio',genre:'Live'}
    const next=[...savedRadios,track];setSavedRadios(next);notifySave('radios',next);setStreamOpen(false);setStreamName('');setStreamUrl('');setToast('Радиостанция сохранена')
  }
  async function fullscreen(){try{if(window.desktop)await window.desktop.fullscreen();else if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{setToast('Полноэкранный режим недоступен')}}
  const filtered=(page==='favorites'?favorites:tracks).filter(t=>`${t.title} ${t.artist}`.toLowerCase().includes(query.toLowerCase()))
  function trackRow(track:Track, index:number, list:Track[]){return <div className={`track-row ${current.id===track.id?'selected':''}`} key={track.id}>
    <button className="track-number icon-button" aria-label={`Включить ${track.title}`} onClick={()=>playTrack(track,list)}>{current.id===track.id&&playing?<Bars active/>:<><span>{String(index+1).padStart(2,'0')}</span><Play size={16} className="row-play"/></>}</button>
    <img src={track.cover} alt=""/><button className="track-name" onClick={()=>playTrack(track,list)}><strong>{track.title}</strong><small>{track.artist}</small></button>
    <span className="track-genre">{track.genre || (track.kind==='radio'?'Радио':'Музыка')}</span><span className="track-time">{track.kind==='radio'?<span className="live">LIVE</span>:track.duration?formatTime(track.duration):'—'}</span>
    <button className={`icon-button ${favorites.some(t=>t.id===track.id)?'liked':''}`} title="В избранное" aria-label={`Избранное: ${track.title}`} aria-pressed={favorites.some(t=>t.id===track.id)} onClick={()=>favorite(track)}><Heart size={17}/></button>
    {track.kind==='local'&&<button className="icon-button delete" title="Удалить из медиатеки" aria-label={`Удалить ${track.title}`} onClick={()=>removeTrack(track)}><Trash2 size={15}/></button>}
  </div>}

  return <div className={`app ${reducedMotion?'reduce-motion':''} ${dragging?'dragging':''}`} onDragOver={event=>{event.preventDefault();setDragging(true)}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setDragging(false)}} onDrop={event=>{event.preventDefault();setDragging(false);importMusic(event.dataTransfer.files)}}>
    <audio ref={audio} onPlay={()=>{setPlaying(true);setLoading(false)}} onPause={()=>setPlaying(false)} onWaiting={()=>setLoading(true)} onPlaying={()=>setLoading(false)} onCanPlay={()=>setLoading(false)} onTimeUpdate={()=>setPosition(audio.current?.currentTime || 0)} onDurationChange={()=>setDuration(Number.isFinite(audio.current?.duration)?audio.current!.duration:0)} onEnded={()=>{if(repeat){seek(0);audio.current?.play().catch(()=>setToast('Не удалось повторить трек'))}else nextTrack()}} onError={()=>{setPlaying(false);setLoading(false);setToast('Аудио недоступно. Проверьте формат файла или подключение к радиостанции.')}}/>
    <input ref={fileInput} type="file" accept="audio/*,.flac,.opus" multiple hidden onChange={e=>importMusic(e.target.files)}/>
    <input ref={lyricInput} type="file" accept=".lrc" hidden onChange={e=>importLyrics(e.target.files?.[0])}/>
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e=>{e.preventDefault();navigate('now')}}><span className="brand-mark"><AudioLines size={25}/></span>rustimin<span className="brand-dot">.</span></a>
      <div className="nav-caption">ТВОЁ ПРОСТРАНСТВО</div>
      <nav>{([{id:'now',icon:AudioLines},{id:'library',icon:Library},{id:'favorites',icon:Heart},{id:'radio',icon:Globe2}] as const).map(item=><button key={item.id} className={`nav-item ${page===item.id?'active':''}`} onClick={()=>navigate(item.id)}><item.icon size={19}/><span>{labels[item.id]}</span>{item.id==='now'&&<span className="nav-live"/>}{item.id==='favorites'&&favorites.length>0&&<small>{favorites.length}</small>}</button>)}</nav>
      <div className="sidebar-divider"/>
      <div className="nav-caption">ТВОЯ КОЛЛЕКЦИЯ<button className="icon-button" title="Добавить музыку" aria-label="Добавить музыку" onClick={()=>fileInput.current?.click()}><Plus size={16}/></button></div>
      <button className="collection-link" onClick={()=>{navigate('library');setQuery('ORIGINALS')}}><span className="collection-icon purple"><Sparkles size={16}/></span><span>Ночная волна<small>Rustimin Originals</small></span></button>
      <button className="collection-link" onClick={()=>navigate('library')}><span className="collection-icon rose"><FolderOpen size={16}/></span><span>Мои треки<small>{tracks.filter(t=>t.kind==='local').length} локальных файлов</small></span></button>
      <div className="sidebar-bottom"><div className="import-prompt"><div className="little-orbit"><Headphones size={22}/></div><strong>Твоя музыка. Твой мир.</strong><p>Добавь любимые треки<br/>и растворись в моменте.</p><button className="button secondary" onClick={()=>fileInput.current?.click()}><Plus size={15}/>Добавить музыку</button></div>
      <button className={`nav-item settings-link ${page==='settings'?'active':''}`} onClick={()=>navigate('settings')}><Settings2 size={18}/>Настройки<span className="version">v1.0</span></button></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb">Моё пространство<ChevronRight size={14}/><span>{labels[page]}</span></div><div className="top-actions"><label className="search"><Search size={17}/><input aria-label="Поиск музыки" placeholder={page==='radio'?'Найти радиостанцию':'Найти в медиатеке'} value={query} onChange={e=>{setQuery(e.target.value);if(page==='now'||page==='settings')setPage('library')}}/><kbd>⌕</kbd></label><button className="icon-button fullscreen" title="Полный экран" aria-label="Полный экран" onClick={fullscreen}><Maximize2 size={17}/></button><div className="avatar" title="Локальная медиатека">R</div></div></header>
      <main>
        <div className="page-heading"><div><div className="eyebrow"><span/>ТВОЯ МУЗЫКАЛЬНАЯ ВСЕЛЕННАЯ</div><h1>{page==='now'?<>Поймай свой <em>вайб.</em></>:labels[page]}</h1><p>{page==='now'?'Весь мир на паузе. Только ты и музыка.':page==='library'?'Любимые звуки всегда рядом — даже без интернета.':page==='favorites'?'Музыка, к которой хочется возвращаться.':page==='radio'?'Один мир. Тысячи частот. Найди свою.':'Сделай это пространство своим.'}</p></div><div className="date-block"><span>{clock.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</span><small>{clock.toLocaleDateString('ru-RU',{day:'numeric',month:'long',weekday:'short'})}</small></div></div>
        {page==='now'&&<>
          <section className="listening-layout">
            <div className="left-stack"><div className="artwork" style={{backgroundImage:`url("${current.cover}")`}}><span className="on-air"><Bars active={playing}/>{playing?'Сейчас играет':'В своём ритме'}</span><button className={`art-heart icon-button ${isFavorite?'liked':''}`} aria-label="В избранное" aria-pressed={isFavorite} onClick={()=>favorite(current)}><Heart size={18}/></button><div className="artwork-overlay"><div><span>{current.kind==='radio'?'WORLD RADIO':current.kind==='local'?'YOUR COLLECTION':'RUSTIMIN ORIGINALS'}</span><strong>{current.title}</strong></div><span className="art-counter">{String(Math.max(0,queue.findIndex(t=>t.id===current.id))+1).padStart(2,'0')} / {String(queue.length).padStart(2,'0')}</span></div></div>
            <div className="glass now-card"><div className="now-title"><div><h2>{current.title}</h2><p>{current.artist}</p></div><button className="icon-button" title="Очередь воспроизведения" aria-label="Открыть очередь" onClick={()=>setQueueOpen(true)}><MoreHorizontal size={21}/></button></div><div className="mini-wave"><Bars active={playing}/><span>{isRadio?'Прямой эфир':current.genre || 'Твоя коллекция'}</span><span className="quality">{current.kind==='local'?'LOCAL':current.kind==='radio'?'LIVE':'ORIGINAL'}</span></div></div>
            <div className="widgets"><div className="glass sound-widget"><div className="widget-label"><Heart size={13}/><span>Пульс музыки</span><small>{playing?'В эфире':'Пауза'}</small></div><div className="sound-value">{Math.round((muted?0:volume)*100)}<span>% <small>громкость</small></span></div><svg className={`pulse ${playing?'animate':''}`} viewBox="0 0 200 38" fill="none" aria-hidden="true"><path d="M0 25H22L27 19L33 28H52L59 26L64 4L69 35L74 24H101L107 27L116 25L122 10L128 32L132 24H152L158 19L166 28H200"/></svg><small className="widget-foot">{muted?'Звук выключен':'Звук, который чувствуешь'}</small></div><div className="glass route-widget"><div className="widget-label"><ListMusic size={13}/><span>Твой маршрут</span></div><div className="route-visual"><svg viewBox="0 0 200 80" fill="none" aria-hidden="true"><path className="route-grid" d="M0 10H200M0 35H200M0 60H200M25 0V80M60 0V80M95 0V80M130 0V80M165 0V80"/><path className="route-line" d="M15 70V48H66V31H118V16H176"/><circle cx="176" cy="16" r="5"/></svg></div><button onClick={()=>setQueueOpen(true)}>Дальше — любимое<ArrowRight size={12}/></button></div></div>
            </div>
            <div className="lyrics-panel glass"><div className="panel-heading"><span><ListMusic size={16}/>Текст и настроение</span><span className="synced"><span/>{current.lyrics?.length?'SYNC':'AMBIENT'}</span></div><div className="lyric-scroller" ref={lyricContainer} key={current.id}>
              {current.lyrics?.length?<div className="lyric-lines">{current.lyrics.map((line,i)=><div key={`${line.time}-${i}`} ref={i===lyricIndex?activeLine:null} className={`lyric-line ${i===lyricIndex?'current':i<lyricIndex?'past':''}`} onClick={()=>seek(line.time)} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')seek(line.time)}}>{line.text || '•••'}</div>)}</div>:<div className="no-lyrics"><span className="orbital-disc"><Disc3 size={55}/></span><h2>{isRadio?'На одной волне.':'Почувствуй музыку.'}</h2><p>{isRadio?'Прямой эфир. Новые открытия каждую минуту.':'Добавь текст в формате LRC — и каждая строка зазвучит вместе с музыкой.'}</p>{!isRadio&&<button className="button secondary" onClick={()=>lyricInput.current?.click()}><Plus size={15}/>Добавить текст</button>}</div>}
            </div><div className="floating-sparks" aria-hidden="true">✧<span>✧</span><i>✦</i><b>✧</b></div><div className="lyrics-foot"><span>{current.kind==='demo'?'Авторский инструментал · визуальные строки':current.lyrics?.length?'Нажми на строку, чтобы перейти к ней':isRadio?'Радио без границ':'Текст появится после импорта LRC'}</span><button className="icon-button" title="Загрузить LRC" aria-label="Загрузить текст LRC" onClick={()=>lyricInput.current?.click()} disabled={isRadio}><ArrowDownToLine size={15}/></button></div></div>
          </section>
          <section className="discover"><div className="section-heading"><h2>За пределами плейлиста<span>Найди своё звучание</span></h2><button className="text-button" onClick={()=>navigate('radio')}>Открыть мир<ArrowRight size={15}/></button></div><div className="country-cards">{countries.slice(0,4).map((c,i)=><button className={`country-card country-${i}`} key={c.code} onClick={()=>{navigate('radio');setCountry(c.code)}}><div className="country-art">{i===0?<span className="cyrillic-art">Я</span>:i===1?<span className="stars-art">✦</span>:i===2?<span className="uk-art">✳</span>:<span className="fr-art">é</span>}</div><span className="country-card-info"><small>{c.flag} {c.name.toUpperCase()}</small><strong>{i===0?'На родной волне':i===1?'American mood':i===2?'British frequency':'La vie en musique'}</strong><span>Интернет-радио <ArrowRight size={13}/></span></span></button>)}</div></section>
        </>}
        {(page==='library'||page==='favorites')&&<section className="library-panel glass"><div className="section-heading"><h2>{page==='favorites'?'Сохранённые треки':'Все треки'}<span>{filtered.length} в коллекции</span></h2><button className="button primary" onClick={()=>fileInput.current?.click()}><Plus size={16}/>Добавить музыку</button></div><div className="table-label"><span>#</span><span>КОМПОЗИЦИЯ</span><span>ЖАНР / ИСТОЧНИК</span><span>ВРЕМЯ</span></div>{filtered.map((t,i)=>trackRow(t,i,filtered))}{!filtered.length&&<div className="empty-state"><Music2 size={42}/><h2>{query?'Ничего не найдено':'Здесь будет твоя музыка'}</h2><p>{query?'Попробуй другое название или исполнителя.':page==='favorites'?'Нажми на сердечко рядом с любимым треком.':'Перетащи аудиофайлы в окно приложения.'}</p></div>}<div className="library-note"><FolderOpen size={15}/>Твои файлы хранятся на этом устройстве. Три трека Originals доступны сразу.</div></section>}
        {page==='radio'&&<section className="radio-section"><div className="radio-toolbar"><div className="country-tabs">{countries.map(c=><button className={country===c.code?'active':''} key={c.code} onClick={()=>setCountry(c.code)}>{c.flag} {c.name}</button>)}</div><button className="button secondary" onClick={()=>setStreamOpen(true)}><Plus size={16}/>Свой поток</button></div><p className="radio-disclaimer">Прямые эфиры станций выбранной страны. Язык и репертуар зависят от станции.</p>{savedRadios.length>0&&<div className="glass custom-stations"><h3>Мои радиостанции</h3>{savedRadios.map((t,i)=><div className="custom-row" key={t.id}>{trackRow(t,i,savedRadios)}<button className="icon-button" aria-label={`Удалить станцию ${t.title}`} onClick={()=>{const next=savedRadios.filter(s=>s.id!==t.id);setSavedRadios(next);notifySave('radios',next)}}><Trash2 size={16}/></button></div>)}</div>}{radioLoading?<div className="empty-state"><LoaderCircle className="spin" size={32}/><h2>Ловим твою волну…</h2><p>Ищем радиостанции в эфире</p></div>:radioError?<div className="glass empty-state"><Radio size={40}/><h2>Не удалось поймать сигнал</h2><p>{radioError}</p><button className="button secondary" onClick={()=>setRetry(r=>r+1)}>Попробовать снова</button></div>:stations.length===0?<div className="empty-state"><Search size={35}/><h2>Станции не найдены</h2><p>Попробуй другое название или страну.</p></div>:<div className="station-grid">{stations.map((t,i)=><article className={`glass station ${current.id===t.id?'selected':''}`} key={t.id}><div className={`station-icon tone-${i%4}`}><Radio size={26}/></div><span className="live">LIVE</span><h3>{t.title}</h3><p>{t.genre}</p><div><small>{t.artist}</small><button className="round-play" aria-label={`Слушать ${t.title}`} onClick={()=>playTrack(t,stations)}>{current.id===t.id&&playing?<Bars active/>:<Play size={18} fill="currentColor"/>}</button><button className={`icon-button ${favorites.some(f=>f.id===t.id)?'liked':''}`} aria-label={`Избранное: ${t.title}`} onClick={()=>favorite(t)}><Heart size={17}/></button></div></article>)}</div>}<p className="radio-credit">Каталог Radio Browser · Доступность эфиров зависит от станции и региона.</p></section>}
        {page==='settings'&&<div className="settings-grid"><section className="glass setting-card"><div className="setting-icon"><Settings2 size={24}/></div><h2>Твой комфорт</h2><div className="setting-row"><div><strong>Уменьшить анимацию</strong><p>Спокойный интерфейс без движения</p></div><button className={`toggle ${reducedMotion?'on':''}`} aria-label="Уменьшить анимацию" role="switch" aria-checked={reducedMotion} onClick={()=>{setReducedMotion(!reducedMotion);notifySave('reducedMotion',!reducedMotion)}}><span/></button></div><div className="setting-row"><div><strong>Громкость</strong><p>{Math.round(volume*100)}%</p></div><input type="range" min="0" max="1" step=".01" aria-label="Громкость в настройках" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></div></section><section className="glass setting-card"><div className="setting-icon"><Headphones size={24}/></div><h2>Всё под рукой</h2><div className="shortcut"><span>Воспроизвести / пауза</span><kbd>Пробел</kbd></div><div className="shortcut"><span>Перемотка на 5 секунд</span><kbd>← →</kbd></div><div className="shortcut"><span>Следующий / предыдущий</span><kbd>Ctrl + ← →</kbd></div><p>Поддерживаются системные кнопки воспроизведения.</p></section><section className="glass setting-card about"><div className="brand"><span className="brand-mark"><AudioLines size={25}/></span>rustimin.</div><p>Личное пространство для твоей музыки. Локальная медиатека, синхронные тексты и радиостанции со всего мира.</p><p>Версия 1.0.0 · Без аккаунта · Файлы остаются на устройстве</p><p>Полные треки — из твоей медиатеки. Радио — прямые эфиры. Originals — оригинальные инструментальные композиции, созданные для приложения.</p></section></div>}
        <footer className="content-footer"><span><span className="status-dot"/>Твоё пространство для музыки</span><span>MADE FOR YOUR MOMENTS <Sparkles size={12}/></span></footer>
      </main>
    </div>
    <div className="player"><div className="player-track"><button className="player-cover" aria-label="Показать текущий трек" onClick={()=>navigate('now')}><img src={current.cover} alt=""/></button><div><strong>{current.title}</strong><small>{current.artist}</small></div><button className={`icon-button ${isFavorite?'liked':''}`} aria-label="Сохранить текущий трек" aria-pressed={isFavorite} onClick={()=>favorite(current)}><Heart size={18}/></button></div><div className="transport"><div className="transport-buttons"><button className={`icon-button ${shuffle?'enabled':''}`} aria-label="Случайный порядок" aria-pressed={shuffle} onClick={()=>setShuffle(!shuffle)}><Shuffle size={16}/></button><button className="icon-button" aria-label="Предыдущий трек" onClick={()=>position>3&&!isRadio?seek(0):nextTrack(-1)}><SkipBack size={21} fill="currentColor"/></button><button className="play-button" aria-label={playing?'Пауза':'Воспроизвести'} onClick={togglePlay}>{loading?<LoaderCircle className="spin" size={23}/>:playing?<Pause size={23} fill="currentColor"/>:<Play size={23} fill="currentColor"/>}</button><button className="icon-button" aria-label="Следующий трек" onClick={()=>nextTrack()}><SkipForward size={21} fill="currentColor"/></button><button className={`icon-button ${repeat?'enabled':''}`} aria-label="Повтор трека" aria-pressed={repeat} onClick={()=>setRepeat(!repeat)} disabled={isRadio}><Repeat size={17}/></button></div><div className="seek-row"><span>{formatTime(position)}</span><input type="range" aria-label="Позиция воспроизведения" min="0" max={duration || 1} step=".1" value={Math.min(position,duration || 1)} disabled={isRadio||!duration} onChange={e=>seek(Number(e.target.value))} style={{'--progress':`${duration?position/duration*100:0}%`} as React.CSSProperties}/><span>{isRadio?'LIVE':formatTime(duration || current.duration || 0)}</span></div></div><div className="player-tools"><button className="icon-button" aria-label="Очередь" title="Очередь" onClick={()=>setQueueOpen(!queueOpen)}><ListMusic size={20}/></button><span className="tool-divider"/><button className="icon-button" aria-label={muted?'Включить звук':'Выключить звук'} onClick={()=>setMuted(!muted)}>{muted||volume===0?<VolumeX size={19}/>:<Volume2 size={19}/>}</button><input type="range" aria-label="Громкость" min="0" max="1" step=".01" value={muted?0:volume} onChange={e=>{setVolume(Number(e.target.value));setMuted(false)}}/><span className="volume-value">{Math.round((muted?0:volume)*100)}%</span></div></div>
    {queueOpen&&<div className="modal-backdrop" onClick={()=>setQueueOpen(false)}><section className="queue-panel glass" role="dialog" aria-modal="true" aria-label="Очередь воспроизведения" onClick={e=>e.stopPropagation()}><div className="section-heading"><h2>Твой маршрут<span>{queue.length} треков в очереди</span></h2><button autoFocus className="icon-button" aria-label="Закрыть очередь" onClick={()=>setQueueOpen(false)}><X size={20}/></button></div>{queue.map((t,i)=>trackRow(t,i,queue))}</section></div>}
    {streamOpen&&<div className="modal-backdrop" onClick={()=>setStreamOpen(false)}><form className="stream-modal glass" role="dialog" aria-modal="true" aria-label="Добавить радиостанцию" onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();addStream()}}><button className="modal-close icon-button" type="button" aria-label="Закрыть" onClick={()=>setStreamOpen(false)}><X size={20}/></button><Radio size={30}/><h2>Твоя частота</h2><p>Добавь прямую ссылку на MP3/AAC-поток радиостанции.</p><label>Название<input autoFocus required value={streamName} onChange={e=>setStreamName(e.target.value)} placeholder="Моё любимое радио"/></label><label>Ссылка на поток<input required type="url" value={streamUrl} onChange={e=>setStreamUrl(e.target.value)} placeholder="https://radio.example/stream.mp3"/></label><button className="button primary" type="submit"><Plus size={16}/>Добавить станцию</button></form></div>}
    {toast&&<div className="toast" role="status"><span>{toast}</span><button className="icon-button" aria-label="Закрыть уведомление" onClick={()=>setToast('')}><X size={16}/></button></div>}
    {dragging&&<div className="drop-overlay"><FileMusic size={56}/><h2>Отпусти. И включай.</h2><p>Добавим аудиофайлы в твою медиатеку</p></div>}
  </div>
}
