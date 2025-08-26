import Link from 'next/link'

export default function AuthCodeError() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h2>
            <p className="text-gray-600 mb-6">
              There was an error signing you in. This could be due to:
            </p>
            <ul className="text-left text-gray-600 mb-6 space-y-2">
              <li>• Invalid or expired authentication code</li>
              <li>• Network connection issues</li>
              <li>• Supabase configuration problems</li>
            </ul>
            <Link
              href="/login"
              className="inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Try Again
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}