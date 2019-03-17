# Notes

## GraphQL schema
  
  GraphQL schemas are usually written in the GraphQL Schema Definition Language (SDL). The SDL has a type system that allows to define data structures (just like other strongly typed programming languages such as Java, TypeScript, Swift, Go, …).

  But how does that help in defining the API for a GraphQL server? Every GraphQL schema has three special root types, these are called Query, Mutation and Subscription. The root types correspond to the three operation types offered by GraphQL: queries, mutations and subscriptions. The fields on these root types are called root field and define the available API operations.

```ts
type Query {
  users: [User!]!
  user(id: ID!): User
}

type Mutation {
  createUser(name: String!): User!
}

type User {
  id: ID!
  name: String!
}
```

In this case, we have three root fields: users and user on Query as well as createUser on Mutation. The additional definition of the User type is required because otherwise the schema definition would be incomplete.

When the type of a root field is an object type, you can further expand the query (or mutation/subscription) with fields of that object type. The expanded part is called selection set.

Here are the operations that are accepted by a GraphQL API that implements the above schema:

```ts
// Query for all users
query {
  users {
    id
    name
  }
}

// Query a single user by their id
query {
  user(id: "user-1") {
    id
    name
  }
}

// Create a new user
mutation {
  createUser(name: "Bob") {
    id
    name
  }
}
```

There are a few things to note:

- In these examples, we always query `id` and `name` of the returned `User` objects. We could potentially omit either of them. Note however when querying an object type, it is required that you query at least one of its fields in a selection set.

- For the fields in the selection set, it doesn’t matter whether the type of the root field is required or a list. In the examples schema above, the three root fields all have different [type modifiers](http://graphql.org/learn/schema/#lists-and-non-null) (i.e. different combinations of being a list and/or required) for the `User` type:

  - For the `users` field, the return type `[User!]!` means it returns a list (which itself can not be `null`) of `User` elements. The list can also not contain elements that are `null`. So, you’re always guaranteed to either receive an empty list or a list that only contains non-null `User` objects.
  
  - For the `user(id: ID!)` field, the return type `User` means the returned value could be `null` or a `User` object.

  - For the `createUser(name: String!)` field, the return type `User!` means this operation always returns a `User` object.

## Adding a User model

The first thing you need is a way to represent user data in the database. You can achieve that by adding a `User` type to your Prisma datamodel.

You also want to add a relation between the User and the already existing `Link` type to express that `Link`s are posted by `User`s.

Open `prisma/datamodel.prisma` and replace its current contents with the following:

```ts
type Link {
  id: ID! @unique
  description: String!
  url: String!
  postedBy: User
}

type User {
  id: ID! @unique
  name: String!
  email: String! @unique
  password: String!
  links: [Link!]!
}
```

You’re adding a new relation field called `postedBy` to the `Link` type that points to a `User` instance. The `User` type then has a `links` field that’s a list of `Link`s. This is how you express a one-to-many relationship using SDL.

After every change you’re making to the datamodel file, you need to redeploy the Prisma API to apply your changes and migrate the underlying database schema.

In the root directory of the project, run the following command:

```cmd
  prisma deploy
```

This now updated the Prisma API. You also need to update the auto-generated Prisma client so that it can expose CRUD methods for the newly added `User` model.

```cmd
  prisma generate
```

Right now, it is a bit annoying that you need to explicitly run `prisma generate` every time you’re migrating your database with `prisma deploy`. To make that easier in the future, you can configure a [post-deployment hook](https://www.prisma.io/docs/prisma-cli-and-configuration/prisma-yml-5cy7/#hooks-optional) that gets invoked every time after you ran `prisma deploy`.

Add the following lines to the end of your `prisma.yml`:

```yml
hooks:
  post-deploy:
    - prisma generate
```

The Prisma client will now automatically be regenerated upon a datamodel change.

## Extending the GraphQL schema

Remember the process of schema-driven development? It all starts with extending your schema definition with the new operations that you want to add to the API - in this case a `signup` and `login` mutation.

Open the application schema in `src/schema.graphql` and update the `Mutation` type as follows:

```ts
type Mutation {
  post(url: String!, description: String!): Link!
  signup(email: String!, password: String!, name: String!): AuthPayload
  login(email: String!, password: String!): AuthPayload
}
```

Next, go ahead and add the `AuthPayload` along with a `User` type definition to the file.

Still in `src/schema.graphql`, add the following type definitions:

```ts
type AuthPayload {
  token: String
  user: User
}

type User {
  id: ID!
  name: String!
  email: String!
  links: [Link!]!
}
```

The `signup` and `login` mutations behave very similar. Both return information about the `User` who’s signing up (or logging in) as well as a `token` which can be used to authenticate subsequent requests against your GraphQL API. This information is bundled in the `AuthPayload` type.

Finally, you need to reflect that the relation between `User` and `Link` should be bi-directional by adding the `postedBy` field to the existing `Link` model definition in `schema.graphql`:

```ts
type Link {
  id: ID!
  description: String!
  url: String!
  postedBy: User
}
```

## Implementing the resolver functions

After extending the schema definition with the new operations, you need to implement resolver functions for them. Before doing so, let’s actually refactor your code a bit to keep it more modular!

You’ll pull out the resolvers for each type into their own files.

First, create a new directory called `resolvers` and add four files to it: `Query.js`, `Mutation.js`, `User.js` and `Link.js`. You can do so with the following commands:

```cmd
  mkdir src/resolvers
  touch src/resolvers/Query.js
  touch src/resolvers/Mutation.js
  touch src/resolvers/User.js
  touch src/resolvers/Link.js
```

Next, move the implementation of the `feed` resolver into `Query.js`.

In `Query.js`, add the following function definition:

```js
function feed(parent, args, context, info) {
  return context.prisma.links()
}

module.exports = {
  feed,
}
```

This is pretty straighforward. You’re just reimplementing the same functionality from before with a dedicated function in a different file. The `Mutation` resolvers are next.

## Adding authentication resolvers

Open `Mutation.js` and add the new `login` and `signup` resolvers (you’ll add the `post` resolver in a bit):

```js
async function signup(parent, args, context, info) {
  // 1
  const password = await bcrypt.hash(args.password, 10)
  // 2
  const user = await context.prisma.createUser({ ...args, password })

  // 3
  const token = jwt.sign({ userId: user.id }, APP_SECRET)

  // 4
  return {
    token,
    user,
  }
}

async function login(parent, args, context, info) {
  // 1
  const user = await context.prisma.user({ email: args.email })
  if (!user) {
    throw new Error('No such user found')
  }

  // 2
  const valid = await bcrypt.compare(args.password, user.password)
  if (!valid) {
    throw new Error('Invalid password')
  }

  const token = jwt.sign({ userId: user.id }, APP_SECRET)

  // 3
  return {
    token,
    user,
  }
}

module.exports = {
  signup,
  login,
  post,
}
```

Let’s use the good ol’ numbered comments again to understand what’s going on here - starting with `signup`.

1. In the `signup` mutation, the first thing to do is encrypting the `User`’s password using the `bcryptjs` library which you’ll install soon.

2. The next step is to use the `prisma` client instance to store the new `User` in the database.

3. You’re then generating a JWT which is signed with an `APP_SECRET`. You still need to create this `APP_SECRET` and also install the `jwt` library that’s used here.

4. Finally, you return the `token` and the `user` in an object that adheres to the shape of an `AuthPayload` object from your GraphQL schema.

Now on the `login` mutation:

1. Instead of creating a new `User` object, you’re now using the `prisma` client instance to retrieve the existing `User` record by the `email` address that was sent along as an argument in the `login` mutation. If no `User` with that email address was found, you’re returning a corresponding error.

2. The next step is to compare the provided password with the one that is stored in the database. If the two don’t match, you’re returning an error as well.

3. In the end, you’re returning `token` and `user` again.

Let’s go and finish up the implementation.

First, add the required dependencies to the project:

```cmd
  npm i jsonwebtoken bcryptjs
```

Next, you’ll create a few utilities that are being reused in a few places.

Create a new file inside the `src` directory and call it `utils.js`:

```cmd
  touch src/utils.js
```

Now, add the following code to it:

```js
const jwt = require('jsonwebtoken')
const APP_SECRET = 'GraphQL-is-aw3some'

function getUserId(context) {
  const Authorization = context.request.get('Authorization')
  if (Authorization) {
    const token = Authorization.replace('Bearer ', '')
    const { userId } = jwt.verify(token, APP_SECRET)
    return userId
  }

  throw new Error('Not authenticated')
}

module.exports = {
  APP_SECRET,
  getUserId,
}
```

The `APP_SECRET` is used to sign the JWTs which you’re issuing for your users.

The `getUserId` function is a helper function that you’ll call in resolvers which require authentication (such as `post`). It first retrieves the `Authorization` header (which contains the `User`’s JWT) from the `context`. It then verifies the JWT and retrieves the `User`’s ID from it. Notice that if that process is not successful for any reason, the function will throw an exception. You can therefore use it to “protect” the resolvers which require authentication.

To make everything work, be sure to add the following import statements to the top of `Mutation.js`:

```js
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { APP_SECRET, getUserId } = require('../utils')
```

Right now, there’s one more minor issue. You’re accessing a `request` object on the `context`. However, when initializing the `context`, you’re really only attaching the `prisma` client instance to it - there’s no `request` object yet that could be accessed.

To change this, open `index.js` and adjust the instantiation of the `GraphQLServer` as follows:

```js
const server = new GraphQLServer({
  typeDefs: './src/schema.graphql',
  resolvers,
  context: request => {
    return {
      ...request,
      prisma,
    }
  },
})
```

Instead of attaching an object directly, you’re now creating the `context` as a function which returns the `context`. The advantage of this approach is that you can attach the HTTP request that carries the incoming GraphQL query (or mutation) to the `context` as well. This will allow your resolvers to read the `Authorization` header and validate if the user who submitted the request is eligible to perform the requested operation.

## Requiring authentication for the post mutation

Before you’re going to test your authentication flow, make sure to complete your schema/resolver setup. Right now the `post` resolver is still missing.

In `Mutation.js`, add the following resolver implementation for `post`:

```js
function post(parent, args, context, info) {
  const userId = getUserId(context)
  return context.prisma.createLink({
    url: args.url,
    description: args.description,
    postedBy: { connect: { id: userId } },
  })
}
```

Two things have changed in the implementation compared to the previous implementation in `index.js`:

1. You’re now using the `getUserId` function to retrieve the ID of the `User`. This ID is stored in the JWT that’s set at the `Authorization` header of the incoming HTTP request. Therefore, you know which `User` is creating the `Link` here. Recall that an unsuccessful retrieval of the `userId` will lead to an exception and the function scope is exited before the `createLink` mutation is invoked. In that case, the GraphQL response will just contain an error indicating that the user was not authenticated.

2. You’re then also using that `userId` to connect the `Link` to be created with the `User` who is creating it. This is happening through a [nested object write](https://www.prisma.io/docs/-rsc6#nested-object-writes).

## Resolving relations

There’s one more thing you need to do before you can launch the GraphQL server again and test the new functionality: Ensuring the relation between `User` and `Link` gets properly resolved.

Notice how we’ve omitted all resolvers for scalar values from the `User` and `Link` types? These are following the simple pattern that we saw at the beginning of the tutorial:

```js
Link: {
  id: parent => parent.id,
  url: parent => parent.url,
  description: parent => parent.description,
}
```

However, we’ve now added two fields to our GraphQL schema that can not be resolved in the same way: `postedBy` on `Link` and `links` on `User`. These fields need to be explicitly implemented because our GraphQL server can not infer where to get that data from.

To resolve the `postedBy` relation, open `Link.js` and add the following code to it:

```js
function postedBy(parent, args, context) {
  return context.prisma.link({ id: parent.id }).postedBy()
}

module.exports = {
  postedBy,
}
```

In the `postedBy` resolver, you’re first fetching the `Link` using the `prisma` client instance and then invoke `postedBy` on it. Notice that the resolver needs to be called `postedBy` because it resolves the `postedBy` field from the `Link` type in `schema.graphql`.

You can resolve the `links` relation in a similar way.

Open `User.js` and add the following code to it:

```js
function links(parent, args, context) {
  return context.prisma.user({ id: parent.id }).links()
}

module.exports = {
  links,
}
```

## Putting it all together

Awesome! The last thing you need to do now is use the new resolver implementations in `index.js`.

Open `index.js` and import the modules which now contain the resolvers at the top of the file:

```js
const Query = require('./resolvers/Query')
const Mutation = require('./resolvers/Mutation')
const User = require('./resolvers/User')
const Link = require('./resolvers/Link')
```

Then, update the definition of the `resolvers` object to looks as follows:

```js
const resolvers = {
  Query,
  Mutation,
  User,
  Link
}
```

## Testing the authentication flow

The very first thing you’ll do is test the signup mutation and thereby create a new User in the database.

Now, send the following mutation to create a new User:

```js
mutation {
  signup(
    name: "Alice"
    email: "alice@prisma.io"
    password: "graphql"
  ) {
    token
    user {
      id
    }
  }
}
```

From the server’s response, copy the authentication `token` and open another tab in the Playground. Inside that new tab, open the **HTTP HEADERS** pane in the bottom-left corner and specify the `Authorization` header - similar to what you did with the Prisma Playground before. Replace the `__TOKEN__` placeholder in the following snippet with the copied token:

```json
{
  "Authorization": "Bearer __TOKEN__"
}
```

Whenever you’re now sending a query/mutation from that tab, it will carry the authentication token.

With the `Authorization` header in place, send the following to your GraphQL server:

```js
mutation {
  post(
    url: "www.graphqlconf.org"
    description: "An awesome GraphQL conference"
  ) {
    id
  }
}
```

When your server receives this mutation, it invokes the post resolver and therefore validates the provided JWT. Additionally, the new Link that was created is now connected to the User for which you previously sent the signup mutation.

To verify everything worked, you can send the following login mutation:

```js
mutation {
  login(
    email: "alice@prisma.io"
    password: "graphql"
  ) {
    token
    user {
      email
      links {
        url
        description
      }
    }
  }
}
```

This will return a response similar to this:

```json
{
  "data": {
    "login": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjanBzaHVsazJoM3lqMDk0NzZzd2JrOHVnIiwiaWF0IjoxNTQ1MDYyNTQyfQ.KjGZTxr1jyJH7HcT_0glRInBef37OKCTDl0tZzogekw",
      "user": {
        "email": "alice@prisma.io",
        "links": [
          {
            "url": "www.graphqlconf.org",
            "description": "An awesome GraphQL conference"
          }
        ]
      }
    }
  }
}
```

## Realtime GraphQL Subscriptions

- What are GraphQL subscriptions?

  - Subscriptions are a GraphQL feature that allows a server to send data to its clients when a specific event happens. Subscriptions are usually implemented with WebSockets. In that setup, the server maintains a steady connection to its subscribed client. This also breaks the “Request-Response-Cycle” that were used for all previous interactions with the API.

  - Instead, the client initially opens up a long-lived connection to the server by sending a subscription query that specifies which event it is interested in. Every time this particular event happens, the server uses the connection to push the event data to the subscribed client(s).

## Subscriptions with Prisma

Luckily, Prisma comes with out-of-the-box support for subscriptions.

For each model in your Prisma datamodel, Prisma lets you subscribe to the following events:

- A new model is **created**
- An existing model **updated**
- An existing model is **deleted**

You can subscribe to these events using the `$subscribe` method of the Prisma client.

## Subscribing to new `Link` elements

Let’s implement the subscription that allows your clients to subscribe to newly created `Link` elements.

Just like with queries and mutations, the first step to implement a subscription is to extend your GraphQL schema definition.

Open your application schema and add the `Subscription` type:

```js
type Subscription {
  newLink: Link
}
```

Next, go ahead and implement the resolver for the `newLink` field. Resolvers for subscriptions are slightly different than the ones for queries and mutations:

1. Rather than returning any data directly, they return an AsyncIterator which subsequently is used by the GraphQL server to push the event data to the client.

1. Subscription resolvers are wrapped inside an object and need to be provided as the value for a subscribe field. You also need to provide another field called resolve that actually returns the data from the data emitted by the AsyncIterator.

To adhere to the modular structure of your resolver implementation, first create a new file called `Subscription.js`:

```bash
  touch src/resolvers/Subscription.js
```

Here’s how you need to implement the subscription resolver in that new file:

```js
function newLinkSubscribe(parent, args, context, info) {
  return context.prisma.$subscribe.link({ mutation_in: ['CREATED'] }).node()
}

const newLink = {
  subscribe: newLinkSubscribe,
  resolve: payload => {
    return payload
  },
}

module.exports = {
  newLink,
}
```

The code seems pretty straightforward. As mentioned before, the subscription resolver is provided as the value for a `subscribe` field inside a plain JavaScript object.

As mentioned, the `prisma` client instance on the `context` exposes a `$subscribe` property which proxies the subscriptions from the Prisma API. This function is used to resolve subscriptions and push the event data. Prisma is taking care of all the complexity of handling the realtime functionality under the hood.

Open `index.js` and add an import statement for the `Subscription` module to the top of the file:

```js
const Subscription = require('./resolvers/Subscription')

```

Then, update the definition of the `resolvers` object to looks as follows:

```js
const resolvers = {
  Query,
  Mutation,
  Subscription,
  User,
  Link,
}
```

## Testing subscriptions

It’s time to test your realtime API ⚡️ You can do so, by using two instances (i.e. windows) of the GraphQL Playground at once.

- If you haven’t already, restart the server by first killing it with CTRL+C, then run node `src/index.js` again.

- Next, open two browser windows and navigate both to the endpoint of your GraphQL server: `http://localhost:4000`.

As you might guess, you’ll use one Playground to send a subscription query and thereby create a permanent websocket connection to the server. The second one will be used to send a `post` mutation which triggers the subscription.

In one Playground, send the following subscription:

```js
subscription {
  newLink {
      id
      url
      description
      postedBy {
        id
        name
        email
      }
  }
}
```

In contrast to what happens when sending queries and mutations, you’ll not immediately see the result of the operation. Instead, there’s a loading spinner indicating that it’s waiting for an event to happen.

![subscription listening](https://imgur.com/hmqRJws.png)

Time to trigger a subscription event.

Send the following `post` mutation inside a GraphQL Playground. Remember that you need to be authenticated for that (see the previous chapter to learn how that works):

```js
mutation {
  post(
    url: "www.graphqlweekly.com"
    description: "Curated GraphQL content coming to your email inbox every Friday"
  ) {
    id
  }
}
```

Now observe the Playground where the subscription was running:

![newLink received](https://imgur.com/0BJQhWj.png)

## Adding a voting feature

Implementing a `vote` mutation:

The next feature to be added is a voting feature which lets users upvote certain links. The very first step here is to extend your Prisma datamodel to represent votes in the database.

Open `prisma/datamodel.prisma` and adjust it to look as follows:

```js
type Link {
  id: ID! @unique
  createdAt: DateTime!
  description: String!
  url: String!
  postedBy: User
  votes: [Vote!]!
}

type User {
  id: ID! @unique
  name: String!
  email: String! @unique
  password: String!
  links: [Link!]!
  votes: [Vote!]!
}

type Vote {
  id: ID! @unique
  link: Link!
  user: User!
}
```

As you can see, you added a new `Vote` type to the datamodel. It has one-to-many relationships to the `User` and the `Link` type.

To apply the changes and update your Prisma client API so it includes CRUD operations for the new `Vote` type, you need to deploy the service again.

Run the following command in your terminal:

```bash
  prisma deploy
```

Thanks to the post-deploy hook, you don’t need to manually run `prisma generate` again to update your Prisma client.

Now, with the process of schema-driven development in mind, go ahead and extend the schema definition of your application schema so that your GraphQL server also exposes a `vote` mutation:

```js
type Mutation {
  post(url: String!, description: String!): Link!
  signup(email: String!, password: String!, name: String!): AuthPayload
  login(email: String!, password: String!): AuthPayload
  vote(linkId: ID!): Vote
}
```

The referenced `Vote` type also needs to be defined in the GraphQL schema:

```js
type Vote {
  id: ID!
  link: Link!
  user: User!
}
```

It should also be possible to query all the `votes` from a `Link`, so you need to adjust the `Link` type in `schema.graphql` as well.

Open `schema.graphql` and add the `votes` field to `Link`:

```js
type Link {
  id: ID!
  description: String!
  url: String!
  postedBy: User
  votes: [Vote!]!
}
```

You know what’s next: Implementing the corresponding resolver functions.

Add the following function to `src/resolvers/Mutation.js`:

```js
async function vote(parent, args, context, info) {
  // 1
  const userId = getUserId(context)

  // 2
  const linkExists = await context.prisma.$exists.vote({
    user: { id: userId },
    link: { id: args.linkId },
  })
  if (linkExists) {
    throw new Error(`Already voted for link: ${args.linkId}`)
  }

  // 3
  return context.prisma.createVote({
    user: { connect: { id: userId } },
    link: { connect: { id: args.linkId } },
  })
}
```

Here is what’s going on:

1. Similar to what you’re doing in the `post` resolver, the first step is to validate the incoming JWT with the `getUserId` helper function. If it’s valid, the function will return the `userId` of the `User` who is making the request. If the JWT is not valid, the function will throw an exception.

1. The `prisma.$exists.vote(...)` function call is new for you. The `prisma` client instance not only exposes CRUD methods for your models, it also generates one `$exists` function per model. The `$exists` function takes a `where` filter object that allows to specify certain conditions about elements of that type. Only if the condition applies to at least one element in the database, the `$exists` function returns `true`. In this case, you’re using it to verify that the requesting `User` has not yet voted for the `Link` that’s identified by `args.linkId`.

1. If `exists` returns false, the `createVote` method will be used to create a new `Vote` that’s connected to the `User` and the `Link`.

Also, don’t forget to adjust the export statement to include the `vote` resolver in the module:

```js
module.exports = {
  post,
  signup,
  login,
  vote,
}
```

You also need to account for the new relations in your GraphQL schema:

- `votes` on `Link`
- `user` on `Vote`
- `link` on `Vote`

Similar to before, you need to implement resolvers for these.

Open `Link.js` and add the following function to it:

```js
function votes(parent, args, context) {
  return context.prisma.link({ id: parent.id }).votes()
}
```

Don’t forget to include the new resolver in the exports:

```js
module.exports = {
  postedBy,
  votes,
}
```

Finally you need to resolve the relations from the `Vote` type.

Create a new file called `Vote.js` inside `resolvers`:

```bash
  touch src/resolvers/Vote.js
```

Now add the following code to it:

```js
function link(parent, args, context) {
  return context.prisma.vote({ id: parent.id }).link()
}

function user(parent, args, context) {
  return context.prisma.vote({ id: parent.id }).user()
}

module.exports = {
  link,
  user,
}
```

Finally the `Vote` resolver needs to be included in the main `resolvers` object in `index.js`.

Open `index.js` and add a new import statement to its top:

```js
const Vote = require('./resolvers/Vote')
```

Finally, include the `Vote` resolver in the `resolvers` object:

```js
const resolvers = {
  Query,
  Mutation,
  Subscription,
  User,
  Link,
  Vote,
}
```

## Subscribing to new votes

The last task in this chapter is to add a subscription that fires when new `Vote`s are being created. You’ll use an analogous approach as for the `newLink` query for that.

Add a new field to the `Subscription` type of your GraphQL schema:

```js
type Subscription {
  newLink: Link
  newVote: Vote
}
```

Next, you need to add the subscription resolver function.

Add the following code to `Subscription.js`:

```js
function newVoteSubscribe(parent, args, context, info) {
  return context.prisma.$subscribe.vote({ mutation_in: ['CREATED'] }).node()
}

const newVote = {
  subscribe: newVoteSubscribe,
  resolve: payload => {
    return payload
  },
}
```

And update the export statement of the file accordingly:

```js
module.exports = {
  newLink,
  newVote,
}
```

All right, that’s it! You can now test the implementation of your `newVote` subscription.

> If you haven’t done so already, stop and restart the server by first killing it with CTRL+C, then run `node src/index.js`. Afterwards, open a new Playground with the GraphQL CLI by running `graphql playground`.

You can use the following subscription for that:

```js
subscription {
  newVote {
    id
    link {
      url
      description
    }
    user {
      name
      email
    }
  }
}
```

If you’re unsure about writing one yourself, here’s a sample `vote` mutation you can use. You’ll need to replace the `__LINK_ID__` placeholder with the `id` of an actual `Link` from your database. Also, make sure that you’re authenticated when sending the mutation.

```js
mutation {
  vote(linkId: "__LINK_ID__") {
    link {
      url
      description
    }
    user {
      name
      email
    }
  }
}
```