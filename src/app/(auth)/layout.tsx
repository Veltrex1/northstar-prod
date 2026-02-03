import { Logo } from "@/components/ui/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-between p-12">
        <Logo className="text-white" />

        <div className="text-white">
          <h1 className="text-4xl font-bold mb-4">Your Company's Second Brain</h1>
          <p className="text-lg text-primary-100">
            AI-powered Virtual Chief AI Officer that knows everything about your business
          </p>
        </div>

        <div className="text-primary-100 text-sm">
          © 2025 Veltrex Solutions. All rights reserved.
        </div>
      </div>

      {/* Right side - Auth forms */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
