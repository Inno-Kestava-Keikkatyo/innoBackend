const businessesRouter = require("express").Router()
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const Agency = require("../models/Agency")
const Business = require("../models/Business")
const authenticateToken = require("../utils/auhenticateToken")
const utils = require("../utils/common")
const { businessExists, needsToBeAgency } = require("../utils/middleware")

const domainUrl = "http://localhost:3000/"
const businessApiPath = "api/businesses/"
const workersPath = "workers/"

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

/**
 * Path for adding workers to a Business' list of workers
 * Example "http://www.domain.com/api/1/workers/"
 * where "1" is the id of the Business in question.
 * Request requirements: The logged in user must be an Agency who has a common BusinessContract with contractMade: true
 * with the businessId Business.
 * request.body.workers / request.body.worker
 * Workers are given as a json array of IDs: {"workers": ["id1","id2","id3"...]}
 * A single worker can also be given as json: {"worker":"id"}
 */
businessesRouter.post("/:businessId/workers", authenticateToken, businessExists, needsToBeAgency, (request, response, next) => {

  // Middleware businessExists() has populated request.business with the Business with businessId.
  const businessId = request.business._id
  const agency = request.agency
  try {
    if (!agency.businessContracts || agency.businessContracts.length === 0) {
      response.status(400).send({ message: "The logged in Agency has no BusinessContracts." })
    }

    // Go through the contracts from this agency and check if the required :businessId can be found from any of them
    let commonContractId = null
    agency.businessContracts.array.forEach(contract => {
      if (contract.business === businessId) {
        commonContractId = contract._id
      }
    })

    if (!commonContractId || commonContractId === null) {
      response.status(400).send({ message: "The logged in Agency has no BusinessContracts with Business with ID " + businessId })
    }

    // Everything fine, adding workers...

    // Adding a single worker
    if (request.body.worker) {
      const workerId = request.body.worker
      // addToSet operation adds an item to a mongoose array, if that item is not already present.
      if (utils.workerExists(request.body.worker, next)) {
        Business.findOneAndUpdate({ _id: request.business._id }, { $addToSet: { users: workerId } }, (error, result) => {
          if (error || !result) {
            response
              .status(500)
              .send(error || { message: "Could not add Worker with ID" + workerId + " into Business with ID" + businessId + "." })
          } else {
            // Added Worker to Business, return resource URL
            return response
              .status(200)
              .json({ updated: domainUrl + businessApiPath + businessId + workersPath, workersAdded: workerId })
          }
        })
      } else {
        return response
          .status(404)
          .json({ error: "Could not find Worker with ID " + workerId + "." })
      }

      // Adding several workers
    } else if (request.body.workers) {
      let workerIdsToAdd
      let workerIdsNotOk

      utils.whichWorkersExist(request.body.workers, next, (workerResult) => {
        workerIdsToAdd = workerResult.existingWorkerIds
        workerIdsNotOk = workerResult.nonExistingWorkerIds

        if (workerIdsToAdd && workerIdsToAdd.length > 0) {
          // $addToSet adds to mongoose array if the item does not already exist, thus eliminating duplicates.
          Business.findOneAndUpdate({ _id: request.business._id }, { $addToSet: { users: workerIdsToAdd } }, (error, result) => {
            if (error || !result) {
              console.log("Could not add worker array to Business. Error: " + error)
              return response
                .status(400)
                .json({ error: "Could not add all Workers to Business, so added none." })
            }
            // There were some ok worker ids to add
            return response
              .status(200)
              .json({ updated: domainUrl + businessApiPath + businessId, workersAdded: workerIdsToAdd, workersNotAdded: workerIdsNotOk })
          })
        } else {
          return response
            .status(404)
            .json({ error: "All of the sent Worker Ids were either erronous or could not be matched with an existing worker." })
        }
      } )
    }

  } catch (exception) {
    next(exception)
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

module.exports = businessesRouter
