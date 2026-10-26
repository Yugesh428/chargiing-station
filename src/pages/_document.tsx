import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en" className="light" style={{ colorScheme: 'light' }}>
      <Head />
      <body className="bg-white antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
