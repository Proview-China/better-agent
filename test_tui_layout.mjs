import { render, Box, Text } from 'ink';
import React, { useState, useEffect } from 'react';

function App() {
  return React.createElement(Box, { flexDirection: 'column', height: process.stdout.rows }, 
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
}, 1000);
