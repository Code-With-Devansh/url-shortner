import mongoose from 'mongoose';
import logger from '../logger/index.js';
import config from './index.js';

mongoose.connection.on('connected',    () => logger.info('[mongo] connected'));
mongoose.connection.on('reconnected',  () => logger.info('[mongo] reconnected'));
mongoose.connection.on('disconnected', () => logger.warn('[mongo] disconnected'));
mongoose.connection.on('error',        (err) => logger.error({ err }, '[mongo] error'));

export const mongoConnection = mongoose.connect(config.mongo.uri, {
  serverSelectionTimeoutMS: 10_000,
  socketTimeoutMS: 45_000,
});

export default mongoose;