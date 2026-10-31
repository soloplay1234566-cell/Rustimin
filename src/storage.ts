import { openDB } from 'idb'
import type { Track } from './model'
const database = openDB('rustimin', 1, {upgrade(db) {db.createObjectStore('tracks', {keyPath:'id'}); db.createObjectStore('settings')}})
export async function readTracks(): Promise<(Track & {blob: Blob})[]> {return (await database).getAll('tracks')}
export async function storeTrack(track: Track, blob: Blob) {return (await database).put('tracks', {...track, src:undefined, blob})}
export async function deleteTrack(id: string) {return (await database).delete('tracks', id)}
export async function getSetting<T>(key:string, fallback:T):Promise<T> {return (await database).get('settings', key).then(x => x ?? fallback)}
export async function setSetting(key: string, value:unknown) {return (await database).put('settings', value, key)}
