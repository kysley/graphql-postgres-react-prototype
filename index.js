require("dotenv").config()

const express = require("express")
const cors = require("cors")
const bodyParser = require("body-parser")
const { graphqlExpress, graphiqlExpress } = require("apollo-server-express")
const { makeExecutableSchema } = require("graphql-tools")
const { SubscriptionServer } = require("subscriptions-transport-ws")
const { execute, subscribe } = require("graphql")
const { createServer } = require("http")
const { PostgresPubSub } = require("graphql-postgres-subscriptions")

const pubsub = new PostgresPubSub({
  user: process.env.DBUSER,
  host: process.env.DBHOST,
  database: process.env.DB,
  password: process.env.DBPASSWORD,
  port: process.env.DBPORT,
})

const database = require("./database")

const PORT = process.env.PORT || 3000
const HOST = process.env.HOST || "localhost"

const typeDefs = `
  type User { first_name: String!, last_name: String!, id: Int! }
  type Query {
    users: [User]!
    user(id: Int!): User!
  }
  type Mutation { addUser(first_name: String!, last_name: String!): Int }
  type Subscription { userAdded: User }
`

const resolvers = {
  Query: {
    users: async () => {
      const users = await database("users").select()
      return users
    },
    user: async (_, { id }) => {
      const [user] = await database("users")
        .where("id", id)
        .select()
      return user
    },
  },
  Mutation: {
    addUser: async (_, { first_name, last_name }) => {
      const [id] = await database("users")
        .returning("id")
        .insert({ first_name, last_name })
      pubsub.publish("userAdded", { userAdded: { first_name, last_name, id } })
      return id
    },
  },
  Subscription: {
    userAdded: {
      subscribe: () => pubsub.asyncIterator("userAdded"),
    },
  },
}

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
})

const server = express()

server.use(cors())

server.use("/graphql", bodyParser.json(), graphqlExpress({ schema }))

server.use(
  "/graphiql",
  graphiqlExpress({
    endpointURL: "/graphql",
    subscriptionsEndpoint: `ws://${HOST}:${PORT}/subscriptions`,
  })
)

const ws = createServer(server)

ws.listen(PORT, () => {
  console.log(`Go to http://${HOST}:${PORT}/graphiql to run queries!`)
  new SubscriptionServer(
    {
      execute,
      subscribe,
      schema
    },
    {
      server: ws,
      path: "/subscriptions",
    },
  )
})