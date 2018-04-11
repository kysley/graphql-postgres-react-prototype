const knex = require('knex')(
  require('./config/knexfile.js')[process.env.NODE_ENV || "development"]
)

module.exports = knex
