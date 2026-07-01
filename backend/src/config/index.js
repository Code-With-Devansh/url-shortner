export default {
  app: {
    env: process.env.NODE_ENV,
    port: Number(process.env.PORT),
    baseUrl: process.env.BASE_URL,
    frontendUrl: process.env.APP_URL,
    corsOrigin: process.env.APP_URL_CORS,
  },
  jwt: {
    accessTokenSecret: process.env.JWT_SECRET,
    refreshTokenSecret: process.env.JWT_REFRESH_SECRET,
    accessTokenExpiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN,
    refreshTokenExpiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN,
  },
  redis: {
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
  },
  mongo: {
    uri: process.env.MONGO_URI,
  },
  email: {
    resendApiKey: process.env.RESEND_API_KEY,
  },
   logging: {
    level: process.env.LOG_LEVEL,
  },
  passwordPepper:process.env.PASSWORD_PEPPER,
  useAtlasSearch:process.env.USE_ATLAS_SEARCH,

};
