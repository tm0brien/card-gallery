import type { GetServerSideProps } from 'next'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
    const slug = (ctx.params?.slug as string[] | undefined) ?? []

    if (slug.length === 2 && slug[0] === 'card') {
        return {
            redirect: {
                destination: `/card/${slug[1]}`,
                permanent: false,
            },
        }
    }

    return {
        redirect: {
            destination: '/',
            permanent: false,
        },
    }
}

export default function V2Redirect() {
    return null
}
