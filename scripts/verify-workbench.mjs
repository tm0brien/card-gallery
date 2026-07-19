/**
 * Dev-only: run the Phase 11 visual verification matrix and save screenshots:
 * backgrounds (Test A), detail toggles (Test D), rotation (Tests E/F/G).
 */
import fs from 'node:fs'

import puppeteer from 'puppeteer-core'

const outDir = process.argv[2] ?? '/tmp/slab-verify'
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
await page.setViewport({ width: 1920, height: 1400 })
page.on('pageerror', err => console.log('[pageerror]', err.message))
await page.goto('http://localhost:3100/dev/slab-extraction', { waitUntil: 'networkidle0', timeout: 60000 })
await page.waitForFunction(() => document.body.innerText.includes('pipeline'), { timeout: 30000 })
await new Promise(r => setTimeout(r, 1500))

async function clickButton(text) {
    await page.evaluate(t => {
        const buttons = [...document.querySelectorAll('button')]
        buttons.find(b => b.textContent.trim().toLowerCase() === t.toLowerCase())?.click()
    }, text)
    await new Promise(r => setTimeout(r, 900))
}

async function shot3d(name) {
    const tile = (await page.$$('.widePair .tile'))[1]
    await tile.screenshot({ path: `${outDir}/${name}.png` })
    console.log(name)
}

// Test A: background transmission.
for (const bg of ['White', 'Black', 'Mid gray', 'Brown gradient', 'Checkerboard', 'Red', 'Blue']) {
    await clickButton(bg)
    await shot3d(`bg-${bg.toLowerCase().replace(/\s+/g, '-')}`)
}

// Test E/F/G: rotate via pointer drag on the 3D canvas.
await clickButton('Checkerboard')
const tile = (await page.$$('.widePair .tile'))[1]
const canvas = await tile.$('canvas')
const box = await canvas.boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2
async function drag(dx, dy) {
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    for (let i = 1; i <= 10; i++) {
        await page.mouse.move(cx + (dx * i) / 10, cy + (dy * i) / 10)
        await new Promise(r => setTimeout(r, 30))
    }
    await page.mouse.up()
    await new Promise(r => setTimeout(r, 600))
}
await drag(160, 0)
await shot3d('rotate-30')
await drag(160, 0)
await shot3d('rotate-60')
await drag(120, -80)
await shot3d('rotate-grazing')
await drag(-440, 80)

// Test D: toggles on brown background.
await clickButton('Brown gradient')
await shot3d('toggles-all-on')
await page.evaluate(() => {
    const labels = [...document.querySelectorAll('label')]
    for (const t of ['Highlight overlay (3D)', 'Shadow overlay (3D)']) {
        labels
            .find(l => l.textContent.trim().startsWith(t))
            ?.querySelector('input')
            ?.click()
    }
})
await new Promise(r => setTimeout(r, 900))
await shot3d('toggles-all-off')

console.log('saved to', outDir)
await browser.close()
