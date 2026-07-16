const { buildApp } = require('./app');
const config = require('./config/env');

const app = buildApp();

app.listen(config.port, () => {
  console.log(`CDMC backend listening on http://localhost:${config.port}`);
});
