import '../styles/globals.css'

import { AppProps } from 'next/app'

import { RouteTransitionProvider } from '../context/RouteTransitionContext'
import { ThemeProvider } from '../context/ThemeContext'

const MyApp = ({ Component, pageProps }: AppProps): React.ReactNode => {
    return (
        <ThemeProvider>
            <RouteTransitionProvider>
                <Component {...pageProps} />
            </RouteTransitionProvider>
        </ThemeProvider>
    )
}

export default MyApp
