import sharp from 'sharp'
const shot = '/var/folders/qv/bzsmnx6970d4ngj3ncs4km_c0000gn/T/cursor/screenshots/page-2026-06-11T20-03-02-725Z.png'
// right edge strip: view x ~552-580, y ~95-500 → px x 2020-2125, y 350-1830
await sharp(shot)
    .extract({ left: 1980, top: 320, width: 220, height: 1550 })
    .rotate(-90)
    .resize(1200)
    .toFile('/tmp/right-edge-crop.png')
console.log('ok')
