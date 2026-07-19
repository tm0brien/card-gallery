/** Dev-only: probe 3D rendering with different slider values. */
import fs from 'node:fs'

import puppeteer from 'puppeteer-core'

const outDir = '/tmp/slab-probe'
fs.mkdirSync(outDir, { recursive: true })

const browser = await puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1920,1400']
})
const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1400 })
await page.goto('http://localhost:3100/dev/slab-extraction', { waitUntil: 'networkidle0', timeout: 60000 })
await page.waitForFunction(() => document.body.innerText.includes('pipeline'), { timeout: 30000 })
await new Promise(r => setTimeout(r, 1500))

async function setSlider(label, value) {
    await page.evaluate(
        (t, v) => {
            const labels = [...document.querySelectorAll('label')]
            const target = labels.find(l => l.textContent.trim().startsWith(t))
            const input = target?.querySelector('input[type=range]')
            if (!input) return
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
            setter.call(input, String(v))
            input.dispatchEvent(new Event('input', { bubbles: true }))
            input.dispatchEvent(new Event('change', { bubbles: true }))
        },
        label,
        value
    )
    await new Promise(r => setTimeout(r, 900))
}

async function shot3d(name) {
    const tile = (await page.$$('.widePair .tile'))[1]
    await tile.screenshot({ path: `${outDir}/${name}.png` })
    console.log(name)
}

await shot3d('baseline')
await setSlider('Environment intensity', 0)
await shot3d('env-0')
await setSlider('Environment intensity', 0.8)
await setSlider('Roughness', 0.3)
await shot3d('rough-030')
await setSlider('Roughness', 0.04)
await setSlider('Thickness', 0)
await shot3d('thickness-0')

await browser.close()
