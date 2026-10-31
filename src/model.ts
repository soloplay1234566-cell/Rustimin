export type Lyric = { time: number; text: string }
export type Track = {id: string; title: string; artist: string; cover: string; src?: string; duration?: number; kind: 'demo' | 'local' | 'radio'; country?: string; genre?: string; lyrics?: Lyric[]}
export function parseLrc(input: string): Lyric[] {
  const offset = Number(input.match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0) / 1000
  return input.split(/\r?\n/).flatMap(line => {
    const matches = [...line.matchAll(/\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/g)]
    const text = line.replace(/\[[^\]]*\]/g, '').trim()
    return matches.filter(m => Number(m[2]) < 60).map(m => ({time: Math.max(0, Number(m[1]) * 60 + Number(m[2]) + Number('0.' + (m[3] || '0')) + offset), text}))
  }).sort((a,b) => a.time-b.time)
}
export function formatTime(seconds: number): string { if(!Number.isFinite(seconds) || seconds < 0) return '0:00'; return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}` }
export function parseFilename(name: string) {const stem = name.replace(/\.[^.]+$/, ''); const parts = stem.split(' - '); return {artist: parts.length > 1 ? parts.shift()! : 'Моя музыка', title: parts.join(' - ') || stem} }
export function validStreamUrl(value: string): boolean {try {const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password} catch{return false}}
export const demos: Track[] = [
 {id:'night', title:'После полуночи', artist:'RUSTIMIN · ORIGINALS', cover:'./art/night.svg', src:'./audio/night.mp3', duration:64, kind:'demo', genre:'Ambient', lyrics:[{time:0,text:'Город засыпает.'},{time:12,text:'Музыка остаётся.'},{time:24,text:'Побудь в этом моменте.'},{time:40,text:'Эта ночь — твоя.'},{time:56,text:'И пусть весь мир подождёт.'}]},
 {id:'orbit', title:'Невесомость', artist:'RUSTIMIN · ORIGINALS', cover:'./art/orbit.svg', src:'./audio/orbit.mp3', duration:64, kind:'demo', genre:'Electronic'},
 {id:'dawn', title:'Тихий рассвет', artist:'RUSTIMIN · ORIGINALS', cover:'./art/dawn.svg', src:'./audio/dawn.mp3', duration:64, kind:'demo', genre:'Chillout'}
]
export const countries = [{code:'RU', name:'Россия', flag:'🇷🇺', label:'Русская музыка'}, {code:'US', name:'США', flag:'🇺🇸', label:'Американская музыка'}, {code:'GB', name:'Великобритания', flag:'🇬🇧', label:'Британская музыка'}, {code:'FR', name:'Франция', flag:'🇫🇷', label:'Французская музыка'}, {code:'DE', name:'Германия', flag:'🇩🇪', label:'Немецкая музыка'}, {code:'JP', name:'Япония', flag:'🇯🇵', label:'Японская музыка'}, {code:'KR', name:'Южная Корея', flag:'🇰🇷', label:'Корейская музыка'}, {code:'BR', name:'Бразилия', flag:'🇧🇷', label:'Бразильская музыка'}]
