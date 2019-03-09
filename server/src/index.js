const { GraphQLServer } = require('graphql-yoga')

let links = [{
  id: 'link-0',
  url: 'www.howtographql.com',
  description: 'Fullstack tutorial for GraphQL'
}]

let idCount = links.length
const resolvers = {
  Query: {
    info: () => 'This is the API of a Hackernews Clone',
    feed: () => links,
    link: (parent, args) => {
      const link = links.find((link) => link.id === args.id)
      return link
    },
  },
  Mutation: {
    post: (parent, args) => {// args: carries the arguments for the operation
      const link = {
        id: `link-${idCount++}`,
        url: args.url,
        description: args.description,
      }

      links.push(link)

      return link
    },
    updateLink: (parent, args) => {
      const link = links.find(link => link.id === args.id)
      link.url = args.url
      link.description = args.description

      return link
    },
    deleteLink: (parent, args) => {
      const link = links.find(link => link.id === args.id)
      const index = links.indexOf(link)

      links.splice(index, 1)

      return link
    }
  }
  // In any case, because the implementation of the Link resolvers is trivial, 
  // you can actually omit them and the server will work in the same way as it did before 👌
  // Link: {
  //   id: (parent) => parent.id,
  //   url: (parent) => parent.url,
  //   description: (parent) => parent.description
  // }
}

// 3
// This tells the server what API operations are accepted and how they should be resolved.
const server = new GraphQLServer({
  typeDefs: './src/schema.graphql', // One convenient thing about the constructor of the GraphQLServer is that typeDefs can be provided either directly as a string or by referencing a file that contains your schema definition 
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
