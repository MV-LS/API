const mongoose = require('mongoose')

const schema = new mongoose.Schema({
    name: String,
    description: String,
    price: Number,
    stock: { type: Number, default: 1000000 },
    img: String
})

module.exports = mongoose.model('Product', schema)
