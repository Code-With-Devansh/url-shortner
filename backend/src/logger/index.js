import pino from "pino";
import productionLogger from './productionLogger.js'
import devLogger from './devLogger.js'
let logger = devLogger

if(process.env.NODE_ENV === 'production'){
    logger = productionLogger
}

export default logger;