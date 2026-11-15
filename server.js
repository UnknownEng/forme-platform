const { createApp } = require('./src/app');

const { server, config } = createApp({ LOG_REQUESTS: process.env.FORME_LOG !== '0' });

server.listen(config.PORT, config.HOST, () => {
  const url = `http://${config.HOST}:${server.address().port}`;
  console.log(`Forme platform running at ${url}`);
  console.log(`  Landing page     ${url}/`);
  console.log(`  Merchant console ${url}/console`);
  console.log(`  Demo store       ${url}/demo`);
  console.log(`  API docs         ${url}/docs`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
