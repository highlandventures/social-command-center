'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SignUpPage() {
  const router = useRouter();

  // With Google OAuth, sign-up and sign-in are the same flow.
  // New users are auto-created on first Google sign-in.
  useEffect(() => {
    router.replace('/auth/signin');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-gray-400">Redirecting to sign in...</div>
    </div>
  );
}
