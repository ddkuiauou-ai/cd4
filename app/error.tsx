'use client'

import { useEffect } from 'react'
 
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])
 
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md mx-auto text-center">
        <h2 className="text-6xl font-bold text-red-600 mb-4">오류</h2>
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">문제가 발생했습니다</h1>
        <p className="text-gray-600 mb-8">
          요청을 처리하는 중에 오류가 발생했습니다.
        </p>
        <button
          onClick={() => reset()}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          다시 시도
        </button>
      </div>
    </div>
  )
}
