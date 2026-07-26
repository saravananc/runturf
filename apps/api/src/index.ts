import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { captureException, flushObservability, initObservability } from './observability.js';

initObservability();

const app = createApp();

process.on('uncaughtException', (err) => {
  logger.fatal(err, 'uncaughtException');
  captureException(err);
  void flushObservability().finally(() => process.exit(1));
});
process.on('unhandledRejection', (err) => {
  logger.fatal(err, 'unhandledRejection');
  captureException(err);
  void flushObservability().finally(() => process.exit(1));
});

app.listen(config.PORT, () => {
  logger.info(`RunTurf API listening on http://localhost:${config.PORT}`);
});
