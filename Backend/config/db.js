const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { Sequelize } = require("sequelize");

const dbName = process.env.DB_NAME || "crm";
const dbUser = process.env.DB_USER || "root";
const dbPass = process.env.DB_PASS || process.env.DB_PASSWORD || "";
const dbHost = process.env.DB_HOST || "localhost";
const dbDialect = process.env.DB_DIALECT || "mysql";

const sequelize = new Sequelize(
  dbName,
  dbUser,
  dbPass,
  {
    host: dbHost,
    dialect: dbDialect,
    logging: false,
    timezone: "+05:30",
  }
);

(async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connection successful!");
  } catch (error) {
    console.error("Unable to connect to the database:", error.message);
  }
})();

module.exports = sequelize;
