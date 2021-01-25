/** Express router providing Business-related routes
 * @module controllers/businesses
 * @requires express
 */

/**
 * Express router to mount Business-related functions on.
 * @type {object}
 * @const
 * @namespace businessesRouter
*/
const businessesRouter = require("express").Router()

const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const logger = require("../utils/logger")
const Agency = require("../models/Agency")
const Business = require("../models/Business")
const BusinessContract = require("../models/BusinessContract")
const authenticateToken = require("../utils/auhenticateToken")
const { needsToBeBusiness } = require("../utils/middleware")

/**
 * Returns response.body: { token, name: savedBusiness.name, email: savedBusiness.email, role: "business" }
 * request.body requirements: {name: "name", email: "email", password: "password"}
 * Route to create a new Business account.
 * @name POST /businesses
 * @function
 * @memberof module:controllers/businesses~businessesRouter
 * @inner
 */
businessesRouter.post("/", async (request, response, next) => {
  try {
    const body = request.body
    // This could be separated into a validation middleware
    const passwordLength = body.password ? body.password.length : 0
    if (passwordLength < 3) {
      return response
        .status(400)
        .json({ error: "password length less than 3 characters" })
    }
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(body.password, saltRounds)

    const business = new Business({
      name: body.name,
      email: body.email,
      passwordHash,
    })

    const savedBusiness = await business.save()

    const businessForToken = {
      email: savedBusiness.email,
      id: savedBusiness._id,
    }

    const token = jwt.sign(businessForToken, process.env.SECRET)

    console.log("jwt token: " + token)
    //response.json(savedBusiness);
    response
      .status(200)
      .send({ token, name: savedBusiness.name, email: savedBusiness.email, role: "business" })
  } catch (exception) {
    next(exception)
  }
})

/**
 * Returns response.body: { The found Business object }
 * Requires user logged in as a Business
 * Route to get Business information
 * @name GET /businesses/me
 * @function
 * @memberof module:controllers/businesses~businessesRouter
 * @inner
 */
businessesRouter.get("/me", authenticateToken, (request, response, next) => {
  try {
    //Decodatun tokenin arvo haetaan middlewarelta
    const decoded = response.locals.decoded
    //Tokeni pitää sisällään userid jolla etsitään oikean käyttäjän tiedot
    Business.findById({ _id: decoded.id }, (error, result) => {
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

/**
 * Returns response.body: { The updated Business object }
 * Requires user must be logged in as Business. request.body OPTIONAL: {property: "value", ....}. Properties need to match those of Business model in database.
 * Route to update Business information.
 * @name PUT /businesses/
 * @function
 * @memberof module:controllers/businesses~businessesRouter
 * @inner
 */
businessesRouter.put("/", authenticateToken, async (request, response, next) => {
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
          .json({ error: "Password length less than 3 characters" })
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
    const updatedAgency = await Business.findByIdAndUpdate(decoded.id, updateFields,
      { new: true, omitUndefined: true, runValidators: true })

    if (!updatedAgency) {
      return response.status(400).json({ error: "Business not found" })
    }
    return response.status(200).json(updatedAgency)

  } catch (exception) {
    return next(exception)
  }
})


businessesRouter.get("/", authenticateToken, async (request, response, next) => {
  const decoded = response.locals.decoded
  const name = request.query.name

  try {
    const agency = await Agency.findById(decoded.id)
    if (agency && name) {
      // Työntekijät haetaan SQL:n LIKE operaattorin tapaisesti
      // Työpassit jätetään hausta pois
      const users = await Business.find({ name: { $regex: name, $options: "i" } }, { licenses: 0 })
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
 * Returns response.body: { [{businessContract1}, {businessContract2},...] }
 * Route for getting full data of all BusinessContracts that the logged in Business has.
 * @name GET /businesses/businesscontracts
 * @function
 * @memberof module:controllers/businesses~businessesRouter
 * @inner
 */
businessesRouter.get("/businesscontracts", authenticateToken, needsToBeBusiness, async (request, response, next) => {
  const contractIds = request.business.businessContracts
  logger.info("ContractIds of this Business: " + contractIds)
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
    } else { // No contractIds in Business, respond with empty array
      return response
        .status(200)
        .json(contracts)
    }
  } catch (exception) {
    logger.error(exception)
    next(exception)
  }
})

module.exports = businessesRouter
