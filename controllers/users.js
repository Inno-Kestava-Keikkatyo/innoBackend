const usersRouter = require("express").Router()
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const logger = require("../utils/logger")
const authenticateToken = require("../utils/auhenticateToken")

const User = require("../models/User")
const Agency = require("../models/Agency")
const BusinessContract = require("../models/BusinessContract")
const { needsToBeWorker } = require("../utils/middleware")

/**
 * User registration.
 * Returns a token that is used for user log in.
 */
usersRouter.post("/", async (request, response, next) => {
  try {
    const body = request.body
    const passwordLength = body.password ? body.password.length : 0
    if (passwordLength < 3) {
      return response
        .status(400)
        .json({ error: "Password length less than 3 characters" })
    }
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(body.password, saltRounds)
    const userToCreate = new User({
      name: body.name,
      email: body.email,
      passwordHash,
    })
    const user = await userToCreate.save()

    const userForToken = {
      email: user.email,
      id: userToCreate._id,
    }

    const token = jwt.sign(userForToken, process.env.SECRET)

    response
      .status(200)
      .send({ token, name: user.name, email: user.email, role: "worker" })
  } catch (exception) {
    next(exception)
  }
})

usersRouter.get("/me", authenticateToken, async (request, response, next) => {
  try {
    //Decodatun tokenin arvo haetaan middlewarelta
    const decoded = response.locals.decoded
    //Tokeni pitää sisällään userid jolla etsitään oikean käyttäjän tiedot
    User.findById({ _id: decoded.id }, (error, result) => {
      //Jos ei resultia niin käyttäjän tokenilla ei löydy käyttäjää
      if (!result || error) {
        response.status(401).send(error || { message: "Not authorized" })
      } else {
        response.status(200).send(result)
      }
    })
  } catch (exception) {
    next(exception)
  }
})

usersRouter.put("/", authenticateToken, async (request, response, next) => {
  const body = request.body
  const decoded = response.locals.decoded
  let passwordHash

  try {
    // Salataan uusi salasana
    if (request.body.password) {
      const passwordLength = body.password ? body.password.length : 0
      if (passwordLength < 3) {
        return response
          .status(400)
          .json({ error: "password length less than 3 characters" })
      }
      const saltRounds = 10
      passwordHash = await bcrypt.hash(body.password, saltRounds)
    }

    // Poistetaan passwordHash bodysta
    // (muuten uusi salasana menee sellaisenaan tietokantaan).
    // Salattu salasana luodaan ylempänä.
    delete body.passwordHash

    // päivitetään bodyn kentät (mitä pystytään päivittämään, eli name ja phonenumber).
    // lisätään passwordHash päivitykseen, jos annetaan uusi salasana.
    const updateFields = {
      ...body,
      passwordHash
    }

    // https://mongoosejs.com/docs/tutorials/findoneandupdate.html
    // https://mongoosejs.com/docs/api.html#model_Model.findByIdAndUpdate
    const updatedUser = await User.findByIdAndUpdate(decoded.id, updateFields,
      { new: true, omitUndefined: true, runValidators: true })

    if (!updatedUser) {
      return response.status(400).json({ error: "User not found" })
    }
    return response.status(200).json(updatedUser)

  } catch (exception) {
    return next(exception)
  }
})

/**
 * Retrieves all workers that have a matching name pattern.
 * @example
 * http://localhost:3001/api/users?name=jarmo
 */
usersRouter.get("/", authenticateToken, async (request, response, next) => {
  const decoded = response.locals.decoded
  const name = request.query.name

  try {
    const agency = await Agency.findById(decoded.id)
    if (agency && name) {
      // Työntekijät haetaan SQL:n LIKE operaattorin tapaisesti
      // Työpassit jätetään hausta pois
      const users = await User.find({ name: { $regex: name, $options: "i" } }, { licenses: 0 })
      if (users) {
        return response.status(200).json(users)
      }
    }
    return response.status(400).json({ error: "Users not found" })
  } catch (exception) {
    return next(exception)
  }
})

/**
 * Route for getting full data of all BusinessContracts that the logged in Agency has.
 * body: No requirements
 * Successful response.body: { [{businessContract1}, {businessContract2},...] }
 */
usersRouter.get("/businesscontracts", authenticateToken, needsToBeWorker, async (request, response, next) => {
  const contractIds = request.worker.businessContracts
  let contracts = []
  let temp = null
  try {
    if (contractIds) {
      logger.info("Searching database for BusinessContracts: " + contractIds)
      contractIds.forEach(async (contractId, index, contractIds) => { // Go through every contractId and, find contract data and push it to array "contracts".
        temp = await BusinessContract.findById(contractId).exec()
        if (temp) {
          contracts.push(temp)
          temp = null
        }

        if (index === contractIds.length-1) { // If this was the last contract to find, send response
          logger.info("BusinessContracts to Response: " + contracts)
          return response
            .status(200)
            .json(contracts)
        }
      })
    } else { // No contractIds in Agency, respond with empty array
      return response
        .status(200)
        .json(contracts)
    }
  } catch (exception) {
    logger.error(exception)
    next(exception)
  }
})

module.exports = usersRouter