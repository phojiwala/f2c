import { Code } from 'lucide-react'
import React, { useEffect, useState } from 'react'

export default function Navbar() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  return (
    <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center h-16 items-center">
          {isClient && <Code className="h-8 w-8 text-primary" />}
          <span className="ml-2 text-xl font-bold">F2C</span>
        </div>
      </div>
    </nav>
  )
}
