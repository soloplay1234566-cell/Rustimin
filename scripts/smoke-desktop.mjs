import {_electron as electron} from '@playwright/test'
import assert from 'node:assert/strict'
const app = await electron.launch({args:[process.env.RUSTIMIN_APP || '.', ...(process.env.RUSTIMIN_TEST_NO_SANDBOX === '1' ? ['--no-sandbox'] : []), '--disable-gpu'],timeout:30000})
try {
 const window=await app.firstWindow()
 await window.waitForSelector('h1')
 assert.match(await window.locator('h1').innerText(),/Поймай свой вайб/)
 assert.equal(await window.evaluate(()=>typeof globalThis.desktop?.fullscreen),'function')
 assert.equal(await window.evaluate(()=>typeof globalThis.require),'undefined')
 await window.getByRole('button',{name:'Воспроизвести',exact:true}).click()
 await window.waitForFunction(()=>document.querySelector('audio').currentTime>.2)
 const info=await window.locator('audio').evaluate(a=>({time:a.currentTime,duration:a.duration,paused:a.paused}))
 assert(info.duration>60 && !info.paused)
 await window.screenshot({path:'test-results/rustimin-electron.png'})
 console.log('Desktop smoke passed: production renderer, isolated preload bridge, local audio playback',info)
} finally {await app.close()}
