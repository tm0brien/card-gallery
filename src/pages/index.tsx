import Root from 'components/Root'
import Head from 'next/head'

export default function Home() {
    return (
        <>
            <Head>
                <title>Next.js starter template</title>
                <meta name="description" content="Simple starter template for Next.js apps." />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <Root />
        </>
    )
}
