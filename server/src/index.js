const { GraphQLServer } = require('graphql-yoga')

// 1
// typeDefs defines the GraphQL schema
// The exclamation mark in the type definition means that this field can never be null.
const typeDefs = `
 type Query {
   info: String!
 }
`

// 2
const resolvers = {
  Query: {
    info: () => 'This is the API of a Hackernews Clone'
  }
}

// 3
// This tells the server what API operations are accepted and how they should be resolved.
const server = new GraphQLServer({
  typeDefs,
  resolvers
})

/**
 * typeDefs: These are the type definitions from your application
 * schema imported from src/schema.graphql.
 * 
 * resolvers: This is a JavaScript object that mirrors the Query,
 * Mutation and Subscription types and their fields from your
 * application schema. Each field in the application schema is
 * represented by a function with the same name in that object.
 * 
 * context: This is an object that gets passed through the resolver
 * chain and every resolver can read from or write to.
 */


server.start(() => console.log(`Server is running on http://localhost:4000`))
