import '../styles/globals.css'

import { AppProps } from 'next/app'

import { ThemeProvider } from '../context/ThemeContext'

const MyApp = ({ Component, pageProps }: AppProps): React.ReactNode => {
    return (
        <ThemeProvider>
            <Component {...pageProps} />
        </ThemeProvider>
    )
}

export default MyApp
