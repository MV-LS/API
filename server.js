const express = require('express')
const bodyParser = require('body-parser')
const helmet = require('helmet')
const path = require('path')
const app = express()

const api = require(path.resolve('routers/api.js'))
const config = require(path.resolve('config/config.js'))

const PORT = process.env.PORT || 8181 //use port passed or 8080

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.use('/api', api)

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}!`)
})
