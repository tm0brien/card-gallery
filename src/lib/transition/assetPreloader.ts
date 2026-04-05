const imageCache = new Map<string, Promise<void>>()
const jsonCache = new Map<string, Promise<void>>()

function preloadImage(url: string) {
    if (imageCache.has(url)) return imageCache.get(url)!

    const promise = new Promise<void>((resolve) => {
        const image = new Image()
        image.decoding = 'async'
        image.onload = () => {
            if (typeof image.decode === 'function') {
                image.decode().catch(() => undefined).finally(() => resolve())
                return
            }
            resolve()
        }
        image.onerror = () => resolve()
        image.src = url
    })

    imageCache.set(url, promise)
    return promise
}

function preloadJson(url: string) {
    if (jsonCache.has(url)) return jsonCache.get(url)!

    const promise = fetch(url, { credentials: 'same-origin' })
        .then(() => undefined)
        .catch(() => undefined)

    jsonCache.set(url, promise)
    return promise
}

export async function preloadCardAssets(cardId: string) {
    const basePath = `/assets/${cardId}`
    const imageUrls = [
        `${basePath}/front.png`,
        `${basePath}/back.png`,
        `${basePath}/left.png`,
        `${basePath}/right.png`,
        `${basePath}/top.png`,
        `${basePath}/bottom.png`,
    ]

    await Promise.all([
        ...imageUrls.map((url) => preloadImage(url)),
        preloadJson(`${basePath}/card-data.json`),
    ])
}
