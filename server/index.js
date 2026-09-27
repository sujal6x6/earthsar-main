// Hosting launchers may require this file rather than execute it directly.
// Always start here; tests and tools import ./app instead.
const { start } = require('./app');
start().then(server => console.log('earthsar running on port ' + server.address().port)).catch(err => {
  console.error('Server startup failed:', err.message);
  process.exitCode = 1;
});
