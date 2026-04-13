import { render, Box, Text } from 'ink';
import React from 'react';

function App() {
  return React.createElement(Box, { flexDirection: 'column', width: 80, borderStyle: 'single' }, 
    React.createElement(Text, { wrap: "truncate-end" },
      React.createElement(Text, { color: 'red' }, "1".repeat(50)),
      React.createElement(Text, { color: 'green' }, "2".repeat(50))
    )
  );
}

render(React.createElement(App));
