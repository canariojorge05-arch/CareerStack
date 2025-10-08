export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <h1 className="text-2xl font-semibold">Privacy & Cookies</h1>
        <p className="text-sm text-muted-foreground">
          We use strictly necessary cookies to maintain your session (keep you logged in) and to improve your experience.
          These cookies are required for core functionality like authentication.
        </p>
        <section className="space-y-2">
          <h2 className="text-xl font-medium">What we store</h2>
          <ul className="list-disc pl-6 text-sm text-muted-foreground space-y-1">
            <li>Session cookie to identify your logged-in session</li>
            <li>Local preferences such as UI settings (non-sensitive)</li>
          </ul>
        </section>
        <section className="space-y-2">
          <h2 className="text-xl font-medium">Managing cookies</h2>
          <p className="text-sm text-muted-foreground">
            You can manage or delete cookies in your browser settings. If you block session cookies, you may not be able to log in.
          </p>
        </section>
        <div className="pt-4">
          <a href="/" className="text-blue-600 hover:underline text-sm">Return to Home</a>
        </div>
      </div>
    </div>
  );
}