import { Code } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center h-16 items-center">
          <div className="flex items-center">
            <Code className="h-8 w-8 text-primary" />
            <span className="ml-2 text-xl font-bold">F2C</span>
          </div>
        </div>
      </div>
    </nav>
  )
}
