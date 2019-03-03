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