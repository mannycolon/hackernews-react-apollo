const jwt = require('jsonwebtoken')
const APP_SECRET = 'GraphQL-is-aw3some'// used to sign the JWTs which you’re issuing for your users.

/**
 * helper function called in resolvers which require authentication
 * @param {object} context 
 */
async function getUserId(context) {
  // retrieves the Authorization header (which contains the User’s JWT) from the context.
  const Authorization = context.request.get('Authorization')
  if (Authorization) {
    const token = Authorization.replace('Bearer ', '')
    // verify the JWT and retrieve the User’s ID from it.
    const { userId } = jwt.verify(token, APP_SECRET)

    return userId
  }

  // if the process above is not successful for any reason, the function will throw an exception.
  throw new Error('Not authenticated')
}

module.exports = {
  APP_SECRET,
  getUserId,
}
