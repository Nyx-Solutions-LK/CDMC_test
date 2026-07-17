const { buildApp } = require('./app');
const config = require('./config/env');

const app = buildApp();

app.listen(config.port, () => {
  console.log(`Nyx Solutions portal backend listening on http://localhost:${config.port}`);
});
