import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';

const app = createApp();

process.on('uncaughtException', (err) => {
  logger.fatal(err, 'uncaughtException');
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  logger.fatal(err, 'unhandledRejection');
  process.exit(1);
});

app.listen(config.PORT, () => {
  logger.info(`RunTurf API listening on http://localhost:${config.PORT}`);
});
