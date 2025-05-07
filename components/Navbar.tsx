import { Code } from 'lucide-react';
import React, { useEffect, useState } from 'react';

export default function Navbar() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <div className="flex justify-center h-16 items-center">
      <div className="flex items-center">
        {isClient && <Code className="h-8 w-8 text-primary" />}
        <span className="ml-2 text-xl font-bold">F2C</span>
      </div>
    </div>
  );
}
