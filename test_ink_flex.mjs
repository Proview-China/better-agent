import { render, Box, Text } from 'ink';
import React from 'react';

function App() {
  return React.createElement(Box, { flexDirection: 'column', height: 15, borderStyle: 'single' }, 
    React.createElement(Box, { flexGrow: 1, height: 10, borderStyle: 'single' }, 
      React.createElement(Text, null, "TranscriptPane")
    ),
    React.createElement(Box, { borderStyle: 'single' }, 
      React.createElement(Text, null, "ComposerPane")
    )
  );
}

render(React.createElement(App));
