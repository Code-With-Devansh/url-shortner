
import productionLogger from './productionLogger.js';
import devLogger from './devLogger.js';

const logger = process.env.NODE_ENV === 'production'
  ? productionLogger
  : devLogger;

export default logger;