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