import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function LoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect /login to home page which now has the login form
    router.replace('/');
  }, [router]);

  return null;
}
