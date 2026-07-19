/**
 * Dev-only helper: capture individual map canvases and layer-toggle
 * screenshots from the workbench for debugging.
 */
import fs from 'node:fs'

import puppeteer from 'puppeteer-core'

const outDir = process.argv[2] ?? '/tmp/slab-inspect'
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

// Save each preview tile (map canvases) at natural resolution.
const tiles = await page.$$('.grid .tile, .grid figure')
const dataUrls = await page.evaluate(() => {
    const results = {}
    document.querySelectorAll('figure').forEach(fig => {
        const title = fig.querySelector('figcaption strong')?.textContent?.trim() ?? 'unknown'
        const canvas = fig.querySelector('canvas')
        if (canvas) results[title] = canvas.toDataURL('image/png')
    })
    return results
})
for (const [title, url] of Object.entries(dataUrls)) {
    const name = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    fs.writeFileSync(`${outDir}/${name}.png`, Buffer.from(url.split(',')[1], 'base64'))
}

async function setCheckbox(labelText, checked) {
    await page.evaluate(
        (t, c) => {
            const labels = [...document.querySelectorAll('label')]
            const label = labels.find(l => l.textContent.trim().startsWith(t))
            const input = label?.querySelector('input[type=checkbox]')
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
}

await shot3d('3d-all-on')
await setCheckbox('Highlight overlay (3D)', false)
await shot3d('3d-no-highlight')
await setCheckbox('Shadow overlay (3D)', false)
await shot3d('3d-no-detail')
await setCheckbox('Highlight overlay (3D)', true)
await setCheckbox('Shadow overlay (3D)', true)

console.log('saved to', outDir)
await browser.close()
