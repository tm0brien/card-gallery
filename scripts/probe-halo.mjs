/** Dev-only: isolate the white halo by toggling layers. */
import fs from 'node:fs'

import puppeteer from 'puppeteer-core'

const outDir = '/tmp/slab-halo'
fs.mkdirSync(outDir, { recursive: true })

const browser = await puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1920,1400']
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
    await new Promise(r => setTimeout(r, 800))
}

async function setCheckbox(labelText, checked) {
    await page.evaluate(
        (t, c) => {
            const labels = [...document.querySelectorAll('label')]
            const input = labels.find(l => l.textContent.trim().startsWith(t))?.querySelector('input')
            if (input && input.checked !== c) input.click()
        },
        labelText,
        checked
    )
    await new Promise(r => setTimeout(r, 800))
}

async function shot3d(name) {
    const tile = (await page.$$('.widePair .tile'))[1]
    await tile.screenshot({ path: `${outDir}/${name}.png` })
    console.log(name)
}

await clickButton('Red')
await setCheckbox('Highlight overlay (3D)', false)
await setCheckbox('Shadow overlay (3D)', false)
await shot3d('plastic-only')
await setCheckbox('Plastic slab (3D)', false)
await shot3d('card-only')
await setCheckbox('Highlight overlay (3D)', true)
await setCheckbox('Shadow overlay (3D)', true)
await shot3d('no-plastic-all-detail')

console.log('done')
await browser.close()
