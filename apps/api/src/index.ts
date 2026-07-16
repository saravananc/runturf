import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';

const app = createApp();

app.listen(config.PORT, () => {
  logger.info(`RunTurf API listening on http://localhost:${config.PORT}`);
});
