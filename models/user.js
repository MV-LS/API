const mongoose = require('mongoose')
const Schema = mongoose.Schema
const bcrypt = require('bcryptjs')

const schema = new Schema({
    access: { type: Number, default: 0 },
    name: {
      first: { type: String, required: true },
      last: { type: String }
    },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true},
    credit: { type: Number, default: 0 }
})

schema.methods.comparePassword = (hash, password) => {
  bcrypt.compare(password, hash)
  .then((res) => {
    return res
  })
  .catch((error) => {
    return false
  })
}

module.exports = mongoose.model('User', schema)
