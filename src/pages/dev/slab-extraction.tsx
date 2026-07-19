import dynamic from 'next/dynamic'
import Head from 'next/head'

// The workbench is canvas/WebGL heavy and reads localStorage — client only.
const SlabExtractionWorkbench = dynamic(() => import('../../components/slab-extraction/SlabExtractionWorkbench'), {
    ssr: false,
    loading: () => (
        <p style={{ color: '#ddd8cf', background: '#17150f', margin: 0, minHeight: '100vh', padding: 20 }}>
            Loading workbench…
        </p>
    )
})

export default function SlabExtractionPage() {
    return (
        <>
            <Head>
                <title>Slab extraction workbench</title>
                <meta name="robots" content="noindex" />
            </Head>
            <SlabExtractionWorkbench />
        </>
    )
}
