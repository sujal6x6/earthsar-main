// Run manually during deployment; no public HTTP setup endpoint exists.
const { migrate, pool } = require('../server/db');
const { bootstrapAdmin } = require('../server/auth');
(async () => {
  try {
    await migrate();
    await bootstrapAdmin();
    console.log('Database initialized.');
  } catch (err) {
    console.error('Setup failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
