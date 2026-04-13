import { render, Box, Text } from 'ink';
import React, { useEffect, useState } from 'react';

function App() {
  const [terminalSize, setTerminalSize] = useState({ rows: process.stdout.rows, cols: process.stdout.columns });
  
  useEffect(() => {
    const handleResize = () => setTerminalSize({ rows: process.stdout.rows, cols: process.stdout.columns });
    process.stdout.on('resize', handleResize);
    return () => process.stdout.off('resize', handleResize);
  }, []);

  return React.createElement(Box, { flexDirection: 'column', height: terminalSize.rows }, 
    React.createElement(Box, { flexGrow: 1, borderStyle: 'single' }, 
      React.createElement(Text, null, "Upper Half")
    ),
    React.createElement(Box, { height: 5, borderStyle: 'single' }, 
      React.createElement(Text, null, "Lower Half")
    )
  );
}

process.stdout.write("\u001B[?1049h");
const { unmount } = render(React.createElement(App));
setTimeout(() => {
  unmount();
  process.stdout.write("\u001B[?1049l");
}, 2000);
