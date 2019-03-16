const { GraphQLServer } = require('graphql-yoga')
const { prisma } = require('./generated/prisma-client')
const Query = require('./resolvers/Query')
const Mutation = require('./resolvers/Mutation')
const Subscription = require('./resolvers/Subscription')
const User = require('./resolvers/User')
const Link = require('./resolvers/Link')

const resolvers = {
  Query,
  Mutation,
  Subscription,
  User,
  Link
}

/**
 * This tells the server what API operations are accepted and how they should be resolved.
 * 
 * typeDefs:
 * These are the type definitions from your application
 * schema imported from src/schema.graphql.
 * 
 * resolvers:
 * This is a JavaScript object that mirrors the Query,
 * Mutation and Subscription types and their fields from your
 * application schema. Each field in the application schema is
 * represented by a function with the same name in that object.
 * 
 * context:
 * This is an object that gets passed through the resolver
 * chain and every resolver can read from or write to.
 */
const server = new GraphQLServer({
  typeDefs: './src/schema.graphql', // One convenient thing about the constructor of the GraphQLServer is that typeDefs can be provided either directly as a string or by referencing a file that contains your schema definition 
  resolvers,
  context: request => {
    return {
      ...request,
      prisma
    }
  },
})

server.start(() => console.log(`Server is running on http://localhost:4000`))
