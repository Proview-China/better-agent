import pty from 'node-pty';

const ptyProcess = pty.spawn('npm', ['run', 'chat:single-agent:tui'], {
  name: 'xterm-color',
  cols: 80,
  rows: 40,
  cwd: process.cwd(),
  env: process.env
});

ptyProcess.on('data', function(data) {
  process.stdout.write(data);
});

setTimeout(() => {
  ptyProcess.write('\x03'); // ctrl-c
  process.exit(0);
}, 5000);
