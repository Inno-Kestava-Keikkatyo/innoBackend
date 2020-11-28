const express = require("express")
const app = express()
const bodyParser = require("body-parser")
const cors = require("cors")
const mongoose = require("mongoose")
const config = require("./utils/config")
const usersRouter = require("./controllers/users")
const businessRouter = require("./controllers/businesses")
const agencyRouter = require("./controllers/agencies")
const loginRouter = require("./controllers/login")
const businesscontractsRouter = require("./controllers/businesscontracts")
const workcontractsRouter = require("./controllers/workcontracts")
const middleware = require("./utils/middleware")
const logger = require("./utils/logger")


logger.info("connecting to", config.MONGODB_URI)

mongoose.set("useCreateIndex", true)
mongoose.set("useFindAndModify", false)

mongoose.connect(config.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    logger.info("connected to MongoDB")
  })
  .catch((error) => {
    logger.error("error connection to MongoDB:", error.message)
  })

app.use(cors())
app.use(bodyParser.json())
app.use(middleware.requestLogger)

app.use("/api/users", usersRouter)
app.use("/api/businesses", businessRouter)
app.use("/api/agencies", agencyRouter)
app.use("/api/login", loginRouter)
app.use("/api/businesscontracts", businesscontractsRouter)
app.use("/api/workcontracts", workcontractsRouter)

app.use(middleware.unknownEndpoint)
app.use(middleware.errorHandler)

module.exports = app