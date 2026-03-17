import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <SignUp
        appearance={{
          elements: {
            rootBox: 'w-full max-w-sm',
            card: 'rounded-xl border border-gray-200 shadow-sm',
          },
        }}
        forceRedirectUrl="/dashboard"
      />
    </div>
  );
}
