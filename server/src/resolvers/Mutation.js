const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { APP_SECRET, getUserId } = require('../utils')

async function post(parent, args, context, info) {
  const userId = await getUserId(context)

  return context.prisma.createLink({
    url: args.url,
    description: args.description,
    postedBy: { connect: { id: userId } },
  })
}

async function signup(parent, args, context, info) {
  // In the signup mutation, the first thing to do is encrypting
  // the User’s password using the bcryptjs library.
  const password = await bcrypt.hash(args.password, 10)
  // The next step is to use the prisma client instance to store the new User in the database.
  const user = await context.prisma.createUser({ ...args, password })
  // You’re then generating a JWT which is signed with an APP_SECRET.
  const token = jwt.sign({ userId: user.id }, APP_SECRET)
  // Finally, you return the token and the user in an object that adheres to 
  // the shape of an AuthPayload object from your GraphQL schema.
  return {
    token,
    user
  }
}

async function login(parent, args, context, info) {
  // Instead of creating a new User object, you’re now using the prisma client 
  // instance to retrieve the existing User record by the email address that was 
  // sent along as an argument in the login mutation. If no User with that email 
  // address was found, you’re returning a corresponding error.
  const user = await context.prisma.user({ email: args.email })
  if (!user) {
    throw new Error('No such user found')
  }

  // The next step is to compare the provided password with the one that is stored
  // in the database. If the two don’t match, you’re returning an error as well.
  const valid = await bcrypt.compare(args.password, user.password)
  if (!valid) {
    throw new Error('Invalid password')
  }

  const token = jwt.sign({ userId: user.id }, APP_SECRET)

  // In the end, you’re returning token and user again.
  return {
    token,
    user
  }
}

async function deleteLink(parent, args, context, info) {
  // authenticate token
  await getUserId(context)

  return context.prisma.deleteLink({
    where: { id: args.id }
  })
}

async function updateLink(parent, args, context, info) {
  // authenticate token
  await getUserId(context)

  return context.prisma.updateLink({
    data: {
      url: args.url,
      description: args.description
    },
    where: {
      id: args.id
    }
  })
}

module.exports = {
  signup,
  login,
  post,
  deleteLink,
  updateLink
}