import test from 'node:test'
import assert from 'node:assert/strict'
import {parseLrc, formatTime, parseFilename, validStreamUrl} from '../src/model.ts'
test('LRC supports multiple timestamps, milliseconds, offset and metadata',()=>{
  assert.deepEqual(parseLrc('[ar:Artist]\n[offset:-200]\n[00:12.50][01:02.005]Припев\n[00:01]Начало\n[00:99.00]Неверно'),[{time:.8,text:'Начало'},{time:12.3,text:'Припев'},{time:61.805,text:'Припев'}])
})
test('Untimed text is not represented as synchronized lyrics',()=>assert.deepEqual(parseLrc('Текст без времени\n[ar:Имя]'),[]))
test('LRC negative times are clamped',()=>assert.deepEqual(parseLrc('[offset:-500]\n[00:00.1]Начало'),[{time:0,text:'Начало'}]))
test('Duration handles live streams and invalid input',()=>{assert.equal(formatTime(Infinity),'0:00');assert.equal(formatTime(125.8),'2:05');assert.equal(formatTime(-1),'0:00')})
test('Track import preserves titles with separators',()=>{assert.deepEqual(parseFilename('Артист - Ночь - remix.flac'),{artist:'Артист',title:'Ночь - remix'});assert.deepEqual(parseFilename('track.mp3'),{artist:'Моя музыка',title:'track'})})
test('Custom radio accepts only HTTP media URLs without credentials',()=>{assert.equal(validStreamUrl('https://radio.example/stream.mp3'),true);for(const url of ['javascript:alert(1)','file:///etc/passwd','https://user:password@example.com','not a url'])assert.equal(validStreamUrl(url),false)})
