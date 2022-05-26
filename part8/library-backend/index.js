const { ApolloServer, UserInputError, gql } = require('apollo-server')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const Author = require('./models/author')
const Book = require('./models/book')
const User = require('./models/user')

const JWT_SECRET = "NEED_HERE_A_SECRET_KEY"
const MONGODB_URI = 'mongodb+srv://test:test@bloglisttest.mn5ka.mongodb.net/GraphQL?retryWrites=true&w=majority'

console.log('connecting to', MONGODB_URI)

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('connected to MongoDB')
  })
  .catch((error) => {
    console.log('error connection to MongoDB:', error.message)
  })

const typeDefs = gql`
  type Book {
    title: String!
    published: Int!
    author: Author!
    genres: [String!]!
    id: ID!
  }

  type Author {
    name: String!
    born: Int
    bookCount: Int
   }

   type User {
    username: String!
    favouriteGenre: String!
    id: ID!
  }
  
  type Token {
    value: String!
  }
  
   type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(author: String, genre: String): [Book!]
    allAuthors: [Author]!
    me: User
   }
  
   type Mutation {
    addBook(
      title: String!
      published: Int!
      author: String!
      genres: [String!]!
    ): Book

    editAuthor(
      name: String!
      setBornTo: Int!
    ): Author

    createUser(
      username: String!
      favouriteGenre: String!
    ): User
    
    login(
      username: String!
      password: String!
    ): Token
   }

`

const resolvers = {
  Query: {
    bookCount: () => Book.collection.countDocuments(),
    authorCount: () => Author.collection.countDocuments(),
    me: (root, args, context) => {
      return context.currentUser
    },
    allBooks: async (root, args) => {
      if (args.author) {
        const author = await Author.findOne({ name: args.author })
        return await Book.find({author: author._id}).populate('author')
      } 
      if (args.genre) {
        return await Book.find({genres: args.genre}).populate('author', {name: 1})
      } 
      return await Book.find({}).populate('author', { name: 1 })
    },
    allAuthors: async () => {
      const authors = await Author.find({})
      const books = await Book.find({})
      const updatedAuthors = [...authors].map((author) => {
        let bookCount = 0
        books.forEach((book) => {
          if (book.author._id.toString() == author._id.toString()) {
            bookCount += 1
          } 
        })
        author["bookCount"] = bookCount
        return author
      })
      return updatedAuthors
    }
   },
   Author: {
    name: (root) => root.name,
    bookCount: async (root) => {
     return await Book.find({author: book.author}).length
    }
   },
   Mutation: {
    addBook: async (root, args, context) => {
      const currentUser = context.currentUser

      if (!currentUser) {
        throw new AuthenticationError("not authenticated")
      }
      let isAuthorInSystem = await Author.findOne({name: args.author}) 
      if (!isAuthorInSystem) {
        let newAuthor = new Author({name: args.author, born: null})
        isAuthorInSystem = newAuthor
        try {
          await newAuthor.save()
        } catch(error) {
          throw new UserInputError(error.message, {
            invalidArgs: args,
          })
        }
      }
      let newBook = new Book({title: args.title, genres: args.genres, published: args.published, author: isAuthorInSystem})
      try {
        await newBook.save()
      } catch(error) {
        throw new UserInputError(error.message, {
          invalidArgs: args,
        })
      } 
      return newBook
    },
    editAuthor: async (root, args, context) => {
      const currentUser = context.currentUser

      if (!currentUser) {
        throw new AuthenticationError("not authenticated")
      }
      let author = await Author.findOne({ name: args.name })
      author.born = args.setBornTo
      try {
        await author.save()
      } catch(error) {
        throw new UserInputError(error.message, {
          invalidArgs: args,
        })
      }
      return author
    },
    createUser: async (root, args) => {
      const user = new User({ username: args.username, favouriteGenre: args.favouriteGenre })
  
      return user.save()
        .catch(error => {
          throw new UserInputError(error.message, {
            invalidArgs: args,
          })
        })
    },
    login: async (root, args) => {
      const user = await User.findOne({ username: args.username })
  
      if ( !user || args.password !== 'secret' ) {
        throw new UserInputError("wrong credentials")
      }
  
      const userForToken = {
        username: user.username,
        id: user._id,
      }

      return { value: jwt.sign(userForToken, JWT_SECRET) }
    },
  }
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    const auth = req ? req.headers.authorization : null
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
      const decodedToken = jwt.verify(
        auth.substring(7), JWT_SECRET
      )
      const currentUser = await User.findById(decodedToken.id)
      return { currentUser }
    }
  }
 })
 
 server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`)
 })