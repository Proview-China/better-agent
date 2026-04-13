import { render, Box, Text } from 'ink';
import React, { useEffect, useState } from 'react';

function App() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    // Simulate what my fix did
    process.stdout.write("\u001B[?1049h");
    const interval = setInterval(() => setCount(c => c + 1), 1000);
    return () => {
      clearInterval(interval);
      process.stdout.write("\u001B[?1049l");
    };
  }, []);

  return React.createElement(Box, { height: process.stdout.rows, borderStyle: 'single' }, 
    React.createElement(Text, null, "Count: " + count)
  );
}

// Print something to move cursor down
console.log("Hello");
console.log("World");

render(React.createElement(App));
