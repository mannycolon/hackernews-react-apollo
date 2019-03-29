function feed (parent, args, context, info) {
  const where = args.filter ? {
    OR: [
      { description_contains: args.filter },
      { url_contains: args.filter },
    ]
  } : {}

  const links = context.prisma.links({
    where,
    skip: args.skip,
    first: args.first,
  })

  return links
}

module.exports = {
  feed
}