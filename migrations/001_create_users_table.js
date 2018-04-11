exports.up = knex =>
  knex.schema.createTable('users', t => {
    t.increments('id').primary()
    t.string('first_name')
    t.string('last_name')
  })

exports.down = knex => knex.schema.dropTableIfExists('users')
