# hackernews-graphql-server (GraphQL Server)

## Dependencies

- `graphql-yoga` (fully-featured GraphQL server)
  - Here’s a list of its features:
    - GraphQL spec-compliant
    - Supports file upload
    - Realtime functionality with GraphQL subscriptions
    - Works with TypeScript typings
    - Out-of-the-box support for GraphQL Playground
    - Extensible via Express middlewares
    - Resolves custom directives in your GraphQL schema
    - Query performance tracing
    - Accepts both `application/json` and `application/graphql` content-types
    - Runs everywhere: Can be deployed via `now`, `up`, AWS Lambda, Heroku etc.

## Setting up Prisma

First, create the prisma directory and then two files called `prisma.yml` and `datamodel.prisma` by running the following commands in your terminal:

```cmd
mkdir prisma
touch prisma/prisma.yml
touch prisma/datamodel.prisma
```

`prisma.yml`: is the main configuration file for your Prisma setup.

`datamodel.prisma`: on the other hand contains the definition of your datamodel.

`Prisma` uses `GraphQL SDL` for model definitions, so basically copy the existing type definitions from `schema.graphql` into `datamodel.prisma.`

Add the following contents to `prisma.yml`:

```yml
# The HTTP endpoint for your Prisma API
endpoint: ''

# Points to the file that contains your datamodel
datamodel: datamodel.prisma

# Specifies language & location for the generated Prisma client
generate:
  - generator: javascript-client
    output: ../src/generated/prisma-client
```

To learn more about the structure of `prisma.yml`, feel free to check out the [documentation](https://www.prisma.io/docs/-5cy7#reference).

Before deploying the service, you need to install the Prisma CLI.

```cmd
  npm i -g prisma
```

If you want to learn more about setting up Prisma locally or with your own database, you can check the documentation [here](https://www.prisma.io/docs/-a002/).

```cmd
  prisma deploy
```

The prisma deploy command starts an interactive process:

- First select the Demo server. When the browser opens, register with Prisma Cloud and go back to your terminal.

- Then you need to select the region for your Demo server. Once that’s done, you can just hit enter twice to use the suggested values for service and stage.

> Note: Prisma is open-source. You can deploy it with Docker to a cloud provider of your choice (such as Digital Ocean, AWS, Google Cloud, …).

Once the command has finished running, the CLI writes the endpoint for the Prisma API to your `prisma.yml`. It will look similar to this: `https://eu1.prisma.sh/john-doe/hackernews-node/dev`.

The last step is to generate the Prisma client for your datamodel. The Prisma client is an auto-generated client library that lets you read and write data in your database through the Prisma API. You can generate it using the `prisma generate` command. This command reads the information from `prisma.yml` and generates the Prisma client accordingly.

```cmd
  prisma generate
```

The Prisma client is now generated and located in `hackernews-react-apollo/server/src/generated/prisma-client`. To use the client, you can import the `prisma` instance that’s exported from the generated folder. Here’s some sample code that you could use in a simple Node script:

```js
const { prisma } = require('./generated/prisma-client')

async function main() {

  // Create a new link
  const newLink = await prisma.createLink({
    url: 'www.prisma.io',
    description: 'Prisma replaces traditional ORMs',
  })
  console.log(`Created new link: ${newLink.url} (ID: ${newLink.id})`)

  // Read all links from the database and print them to the console
  const allLinks = await prisma.links()
  console.log(allLinks)
}

main().catch(e => console.error(e))
```

Notice that the generated directory also contains a file with TypeScript definitions (`index.d.ts`). This file is there so that your IDE (i.e. Visual Studio Code) can help you with auto-completion when reading and writing data using the Prisma client:

![Prisma client auto-completion example](https://imgur.com/kwGNPN4.png "Prisma client auto-completion example")

## Connecting Server and Database with the Prisma Client

Connecting the GraphQL server with the Prisma API, which provides the interface to your database, via the Prisma client.

### Updating the resolver functions to use Prisma client

Using prisma via the context argument.

```js
const resolvers = {
  Query: {
    info: () => `This is the API of a Hackernews Clone`,
    feed: (root, args, context, info) => {
      return context.prisma.links()
    },
  },
  Mutation: {
    post: (root, args, context) => {
      return context.prisma.createLink({
        url: args.url,
        description: args.description,
      })
    },
  },
}
```

### The `context` argument

The `context` argument is a plain JavaScript object that every resolver in the resolver chain can read from and write to - it thus basically is a means for resolvers to communicate. As you’ll see in a bit, it’s also possible to already write to it at the moment when the GraphQL server itself is being initialized. So, it’s also a way for you to pass arbitrary data or functions to the resolvers. In this case, you’re going to attach this `prisma` client instance to the `context` - more about that soon.

Now that you have a basic understanding of the arguments that are passed into the resolver, let’s see how they’re being used inside the implementation of the resolver function.

### Understanding the `feed` resolver

The `feed` resolver is implemented as follows:

```js
feed: (root, args, context, info) => {
  return context.prisma.links()
},
```

It accesses a `prisma` object on `context`. As you will see in a bit, this `prisma` object actually is a `Prisma` client instance that’s imported from the generated `prisma-client` library.

This `Prisma` client instance effectively lets you access your database through the Prisma API. It exposes a number of methods that let you perform CRUD operations for your models.

So, to summarize, Prisma client exposes a CRUD API for the models in your datamodel for you to read and write in your database. These methods are auto-generated based on your model definitions in `datamodel.prisma`.

But, how do you make sure your resolvers actually get access to that magical and often-mentioned `prisma` client instance?

### Attaching the generated Prisma client to context

```cmd
  npm i prisma-client-lib
```

This dependency is required to make the auto-generated Prisma client work.

Now you can attach the generated `prisma` client instance to the `context` so that your resolvers get access to it.

First, import the `prisma` client instance into `index.js`. At the top of the file, add the following import statement:

```js
const { prisma } = require('./generated/prisma-client')
```

Now you can attach it to the `context` when the `GraphQLServer` is being initialized.

In `index.js`, update the instantiation of the `GraphQLServer` to look as follows:

```js
const server = new GraphQLServer({
  typeDefs: './src/schema.graphql',
  resolvers,
  context: { prisma },
})
```

The `context` object that’s passed into all your GraphQL resolvers is being initialized right here. Because you’re attaching the `prisma` client instance to it when the `GraphQLServer` is instantiated, you can access `context.prisma` in your resolvers.

### Testing the new implementation

With these code changes, you can now go ahead and test if the new implementation with a database works as expected. As usual, run the following command in your terminal to start the GraphQL server:

```cmd
  npm start
```

> Note: Because you’re using a demo database in Prisma Cloud, you can view the stored data in the [Prisma Cloud Console](https://app.prisma.io/).
![Prisma Cloud Console Screenshot](https://imgur.com/ZXJ8RIY.png)