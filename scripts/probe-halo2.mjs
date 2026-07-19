/** Dev-only: pin down the transmission halo parameter. */
import fs from 'node:fs'

import puppeteer from 'puppeteer-core'

const outDir = '/tmp/slab-halo2'
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
await new Promise(r => setTimeout(r, 1200))

async function clickButton(text) {
    await page.evaluate(t => {
        const buttons = [...document.querySelectorAll('button')]
        buttons.find(b => b.textContent.trim().toLowerCase() === t.toLowerCase())?.click()
    }, text)
    await new Promise(r => setTimeout(r, 700))
}

async function setSlider(label, value) {
    await page.evaluate(
        (t, v) => {
            const labels = [...document.querySelectorAll('label')]
            const input = labels.find(l => l.textContent.trim().startsWith(t))?.querySelector('input[type=range]')
            if (!input) return
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
            setter.call(input, String(v))
            input.dispatchEvent(new Event('input', { bubbles: true }))
        },
        label,
        value
    )
    await new Promise(r => setTimeout(r, 700))
}

async function shot3d(name) {
    const tile = (await page.$$('.widePair .tile'))[1]
    await tile.screenshot({ path: `${outDir}/${name}.png` })
    console.log(name)
}

await clickButton('Red')
await setSlider('Roughness', 0)
await shot3d('rough-0')
await setSlider('Thickness', 0)
await shot3d('rough-0-thick-0')
await setSlider('IOR', 1)
await shot3d('rough0-thick0-ior1')

console.log('done')
await browser.close()
