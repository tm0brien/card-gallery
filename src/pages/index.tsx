import Head from 'next/head'

export default function Home() {
    return (
        <div style={{ position: 'relative', minHeight: '100vh', width: '100%', padding: 80, boxSizing: 'border-box' }}>
            <Head>
                <title>Next.js starter template</title>
                <meta name="description" content="Simple starter template for Next.js apps." />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            Hello there! This is{' '}
            <code style={{ fontSize: 12, backgroundColor: 'black', color: 'white' }}>nextjs-template</code>.
        </div>
    )
}
