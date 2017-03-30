const mongoose = require('mongoose')
const Schema = mongoose.Schema

const schema = new Schema({
    seller: { type: Schema.Types.ObjectId, ref: 'User' },
    type: {type: Number, default: 0 },
    client: { type: Schema.Types.ObjectId, ref: 'User' },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    location: {
      lat: Number,
      lng: Number
    },
    date: {type: Date, default: Date.now }
})

module.exports = mongoose.model('Sale', schema)
