import type { AppProps } from 'next/app';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <main className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <Component {...pageProps} />
    </main>
  );
}
