/**
 * Dev-only helper: capture screenshots of the /dev/slab-extraction workbench
 * for visual verification. Not part of the app.
 *
 * Usage: node scripts/screenshot-workbench.mjs [outDir] [background] [mode]
 */
import fs from 'node:fs'

import puppeteer from 'puppeteer-core'

const outDir = process.argv[2] ?? '/tmp/slab-shots'
const background = process.argv[3] ?? null
const mode = process.argv[4] ?? null
fs.mkdirSync(outDir, { recursive: true })

const browser = await puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: 'new',
    args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--window-size=1920,1400'
    ]
})
const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1400, deviceScaleFactor: 1 })
page.on('console', msg => {
    if (msg.type() === 'error') console.log('[console.error]', msg.text())
})
page.on('pageerror', err => console.log('[pageerror]', err.message))

await page.goto('http://localhost:3100/dev/slab-extraction', { waitUntil: 'networkidle0', timeout: 60000 })
await page.waitForSelector('canvas', { timeout: 30000 })
// Wait for the pipeline to produce maps (meta line shows timing).
await page.waitForFunction(() => document.body.innerText.includes('pipeline'), { timeout: 30000 })
await new Promise(r => setTimeout(r, 1500))

async function clickButtonWithText(text) {
    const clicked = await page.evaluate(t => {
        const buttons = [...document.querySelectorAll('button')]
        const target = buttons.find(b => b.textContent.trim().toLowerCase() === t.toLowerCase())
        if (target) {
            target.click()
            return true
        }
        return false
    }, text)
    if (!clicked) console.log(`button not found: ${text}`)
    await new Promise(r => setTimeout(r, 1200))
}

if (background) await clickButtonWithText(background)
if (mode) await clickButtonWithText(mode)

await page.screenshot({ path: `${outDir}/workbench-full.png`, fullPage: true })

// Also capture the two large tiles individually.
const tiles = await page.$$('.widePair .tile')
for (let i = 0; i < tiles.length; i++) {
    await tiles[i].screenshot({ path: `${outDir}/tile-${i === 0 ? '2d' : '3d'}.png` })
}

console.log(`saved screenshots to ${outDir}`)
await browser.close()
