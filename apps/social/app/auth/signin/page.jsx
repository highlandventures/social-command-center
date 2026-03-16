import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <SignIn
        appearance={{
          elements: {
            rootBox: 'w-full max-w-sm',
            card: 'rounded-xl border border-gray-200 shadow-sm',
          },
        }}
        forceRedirectUrl="/"
      />
    </div>
  );
}
