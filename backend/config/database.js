const mongoose = require("mongoose");

let connectionPromise = null;

function configurationError(message) {
  const error = new Error(message);
  error.code = "AUTH_NOT_CONFIGURED";
  return error;
}

function getMongoConfig() {
  const uri = String(process.env.MONGO_URI || "").trim();

  if (!uri) {
    throw configurationError("MONGO_URI is not configured.");
  }

  const uriDatabaseMatch = uri.match(
    /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/
  );
  const uriDatabase = uriDatabaseMatch
    ? decodeURIComponent(uriDatabaseMatch[1]).trim()
    : "";
  const configuredDatabase = String(
    process.env.MONGO_DB_NAME || ""
  ).trim();
  const database = configuredDatabase || uriDatabase;

  if (!database) {
    throw configurationError(
      "MONGO_DB_NAME is required when MONGO_URI does not include a database name."
    );
  }

  if (
    configuredDatabase &&
    uriDatabase &&
    configuredDatabase !== uriDatabase
  ) {
    throw configurationError(
      "MONGO_URI and MONGO_DB_NAME point to different databases."
    );
  }

  return { uri, database };
}

function describeMongoError(error) {
  return String(error?.message || "Unknown database error").replace(
    /mongodb(?:\+srv)?:\/\/[^@\s]+@/gi,
    "mongodb://<redacted>@"
  );
}

function connectMongo() {
  if (mongoose.connection.readyState === 1) {
    return Promise.resolve(mongoose.connection);
  }

  if (!connectionPromise) {
    let config;

    try {
      config = getMongoConfig();
    } catch (error) {
      return Promise.reject(error);
    }

    connectionPromise = mongoose
      .connect(config.uri, {
        dbName: config.database,
        serverSelectionTimeoutMS: 8000,
      })
      .then((mongooseInstance) => {
        const connection = mongooseInstance.connection;
        console.log(
          `MongoDB connected (database: ${config.database}, host: ${
            connection.host || "unknown"
          })`
        );
        return connection;
      })
      .catch((error) => {
        connectionPromise = null;
        throw error;
      });
  }

  return connectionPromise;
}

module.exports = { connectMongo, getMongoConfig, describeMongoError };
