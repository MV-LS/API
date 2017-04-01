const express = require('express')
const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const path = require('path')
const bcrypt = require('bcryptjs')
const router = express.Router()

const User = require(path.resolve('models/user.js'))
const Sale = require(path.resolve('models/sale.js'))
const Product = require(path.resolve('models/product.js'))

const config = require(path.resolve('config/config.js'))

const ObjectId = require('mongodb').ObjectID

mongoose.connect(config.database)

/*

  AUTHENTICATION

*/

router.route('/authenticate')
.get((req, res) => {
  const token = req.headers.token

  if (!token)
    return res.status(403).json({ error: { message: 'No token provided' } })

  jwt.verify(token, config.secret, (error, decoded) => {
    if (error)
      return res.status(403).json({ error })

    res.status(200).json({ message: 'Valid token' })
  })
})
.post((req, res) => {

  const { username, email, password } = req.body

  if (!(username || email) || !password )
    return res.status(400).json({ error: { message: 'Some parameters are missing' } })

  User.findOne({ $or: [{ email }, { username }] })
  .exec((error, user) => {
    if (error)
      res.status(500).json({ error })

    if (user.comparePassword(user.password, password+config.secret) || !user)
      return res.status(401).json({ error: { message: 'Wrong user or password' }})

    const _id = user._id
    const token = jwt.sign({ _id }, config.secret, { expiresIn: 604800000 })

    user.password = undefined //Remove password

    res.status(200).json({ message: 'Authenticated', token, user })
  })
})

/*

  USERS

*/

router.route('/users')
.post((req, res) => {
  const { name, email, username, access } = req.body.user
  let password = req.body.user.password

  if (!name || !password || !email || !username)
    return res.status(400).json({ error: { message: 'Some parameters are missing' } })

  bcrypt.hash(password + config.secret, 10)
  .then((hash) => {
    password = hash

    new User({
      password,
      name,
      email,
      username,
      access
    })
    .save((error, user) => {
      if (error) return res.status(500).json({ error })

      const token = jwt.sign({ _id: user._id }, config.secret, { expiresIn: 604800000 })
      res.status(201).json({ message: 'User created!', user, token })
    })
  })
  .catch((error) => {
    res.status(500).json({ error })
  })
})

/*

  MIDDLEWARE

*/

router.use((req, res, next) => {
  const token = req.headers.token

  if (!token)
    return res.status(403).json({ error: { message: 'No token provided' } })

  jwt.verify(token, config.secret, (error, decoded) => {
    if (error) {
      console.log(error)
      return res.status(401).json({error,  message: 'Failed to authenticate token'})
    } //End next requests and send a 401 (unauthorized)}

    req.U_ID = decoded._id
    next()

  })
})

router.route('/users')
.get((req, res) => {
  User.find()
  .exec((error, users) => {
    if (error) return res.status(500).json({ error })
    res.status(201).json({ users })
  })
})

router.route('/users/self')
.get((req, res) => {
  User.findById(req.U_ID, '-password')
  .exec((error, user) => {
    if (error) return res.status(500).json({ error })
    res.status(201).json({ user })
  })
})


/*

  SALES

*/

const getProductPrice = (id, errorCallback, callback) => {
    Product.findById(id)
    .exec((error, product) => {
      if (error) return errorCallback(error)
      return callback(product.price)
    })
}

router.route('/sales')
.get((req, res) => {
  Sale.find()
  .populate('seller product client', '-password -__v -access -description')
  .exec((error, sales) => {
    if (error) return res.status(500).json({ error })
    res.status(201).json({ sales })
  })
})
.post((req, res) => {
  const { product, quantity, location, type, client } = req.body.sale
  let { seller } = req.body.sale

  if (!client || !product || !quantity || !location)
    return res.status(400).json({ error: { message: 'Some paramteres are missing' } })

  if (type === 1) {
    seller = req.U_ID
    // Setup seller commision and stuff
    getProductPrice(product, (error) => {
      return res.status(500).json({ error })
    }, (price) => {
      User.findByIdAndUpdate(seller, { $inc: { credit:  price*quantity*0.1}}, { new: true })
      .exec((error, user) => {
        if (error) return res.status(500).json({ error })
      })
    })
  }


  new Sale({
    client,
    seller,
    product,
    quantity,
    location,
    type
  })
  .save((error, sale) => {
    if (error) return res.status(500).json({ error })
    Product.findByIdAndUpdate(product, { $inc: { stock: -quantity }}, { new: true })
    .exec((error, product) => {
      if (error) return res.status(500).json({ error })
      res.status(201).json({ message: 'Sale created', sale })
    })
  })
})

const objectIdWithTimestamp = (timestamp) => {
    const hexSeconds = Math.floor(timestamp/1000).toString(16) // Convert date object to hex seconds since Unix epoch
    return ObjectId(`${hexSeconds}0000000000000000`) // Create an ObjectId with that hex timestamp
}

router.route('/sales/year=:year?&month=:month?')
.get((req, res) => {
  const { year, month } = req.params

  const start = objectIdWithTimestamp(new Date(2017, month, 0))
  const end = objectIdWithTimestamp(new Date(2017, month, 31))

  Sale.find({_id: {$gte: start, $lt: end}})
  .populate('seller product client', '-password -__v -access -description')
  .exec((error, sales) => {
    if (error) return res.status(500).json({ error })
    res.status(201).json({ sales })
  })
})

router.route('/sales/:sale_id')
.get((req, res) => {
  const sale_id = req.params.sale_id

  Sale.findById(sale_id)
  .populate('seller product client', '-password -__v -access')
  .exec((error, sale) => {
    if (error) return res.status(500).json({ error })
    res.status(201).json({ sale })
  })
})
.delete((req, res) => {
  const sale_id = req.params.sale_id

  Product.findById(sale_id)
  .remove()
  .exec((error) => {
    if (error) return res.status(500).json({ error })
    res.status(200).json({ message: 'Succesfully deleted'})
  })
})

/*

  PRODUCTS

*/

router.route('/products')
.get((req, res) => {
  Product.find()
  .exec((error, products) => {
    if (error) return res.status(500).json({ error: error })
    res.status(201).json({ products })
  })
})
.post((req, res) => {
  const { name, description, price, stock, img } = req.body.product
  if (!name || !description || !price || !img)
    return res.status(400).json({ error: { message: 'Some paramteres are missing' } })

  new Product({
    name,
    description,
    price,
    stock,
    img
  })
  .save((error, product) => {
    if (error) return res.status(500).json({ error })
    res.status(201).json({ message: 'Product created!', product })
  })
})

router.route('/products/:product_id')
.get((req, res) => {
  const product_id = req.params.product_id

  Product.findById(product_id)
  .exec((error, product) => {
    if (error) return res.status(500).json({ error })
    res.status(201).json({ product })
  })

})
.delete((req, res) => {
  const product_id = req.params.product_id

  Product.findById(product_id)
  .remove()
  .exec((error) => {
    if (error) return res.status(500).json({ error })
    res.status(200).json({ message: 'Succesfully deleted'})
  })
})

module.exports = router
