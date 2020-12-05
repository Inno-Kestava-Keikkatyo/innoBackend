const agenciesRouter = require("express").Router()
const logger = require("../utils/logger")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const authenticateToken = require("../utils/auhenticateToken")
const utils = require("../utils/common")
const Agency = require("../models/Agency")
const { needsToBeAgency } = require("../utils/middleware")
const Promise = require("bluebird")
const User = require("../models/User")
const domainUrl = "http://localhost:3000/"
const agencyApiPath = "api/agencies/"

const workersPath = "workers/"

/**
 * Agency registration.
 * Returns a token that is used for user log in.
 * Request requirements:
 * Body.email, Body.name, Body.password
 */
agenciesRouter.post("/", async (request, response, next) => {
  try {
    const body = request.body
    const passwordLength = body.password ? body.password.length : 0
    if (passwordLength < 3) {
      return response
        .status(400)
        .json({ error: "password length less than 3 characters" })
    }
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(body.password, saltRounds)

    const agencyToCreate = new Agency({
      name: body.name,
      email: body.email,
      passwordHash,
    })
    const agency = await agencyToCreate.save()

    const agencyForToken = {
      email: agency.email,
      id: agency._id,
    }

    const token = jwt.sign(agencyForToken, process.env.SECRET)

    response
      .status(200)
      .send({ token, name: agency.name, email: agency.email, role: "agency" })
  } catch (exception) {
    next(exception)
  }
})

agenciesRouter.get("/me", authenticateToken, (request, response, next) => {
  try {
    //Decodatun tokenin arvo haetaan middlewarelta
    const decoded = response.locals.decoded
    //Tokeni pitää sisällään userid jolla etsitään oikean käyttäjän tiedot
    Agency.findById({ _id: decoded.id }, (error, result) => {
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
 * Return just an array of workerIds who belong to this Agency.
 */
agenciesRouter.get("/workerIds", authenticateToken, needsToBeAgency, (request, response, next) => {
  try {
    logger.info("Agency users: " + request.agency.users)
    return response
      .status(200)
      .json(request.agency.users)
  } catch (exception) {
    next(exception)
  }
})

/**
 * Return an array of full worker objects who belong to this Agency
 */
agenciesRouter.get("/workers", authenticateToken, needsToBeAgency, (request, response, next) => {
  try {
    let workerArray = []
    logger.info("Populating array with " + request.agency.users.length + " workers.")
    Promise.map(request.agency.users, (workerId) => {
      // Promise.map awaits for returned promises as well.
      return User.findById({ _id: workerId }, (error, result) => {
        if (!result || error) {
          response.status(500).send(error || { message: "Agency with ID " + request.agency._id + " has a Worker with ID " + result._id + " but it does not exist!" })
        } else {
          workerArray.push(result)
        }
      })
    }).then( () => {
      response
        .status(200)
        .json({ workers: workerArray })
    })
  } catch (exception) {
    next(exception)
  }
})

agenciesRouter.put("/", authenticateToken, async (request, response, next) => {
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
    const updatedAgency = await Agency.findByIdAndUpdate(decoded.id, updateFields,
      { new: true, omitUndefined: true, runValidators: true })

    if (!updatedAgency) {
      return response.status(400).json({ error: "Agency not found" })
    }
    return response.status(200).json(updatedAgency)

  } catch (exception) {
    return next(exception)
  }
})

/**
 * Route for adding workers to an Agency's list of workers
 * Example "http://www.domain.com/api/agencies/workers/" while logged in as an Agency
 * Request requirements: Body.workers / Body.worker
 * Workers are given as a json array of IDs: {"workers": ["id1","id2","id3"...]}
 * A single worker can also be given as json: {"worker":"id"}
 * Successful response.body: { success: true, workersAdded: [workerId1, id2...], workersNotAdded: [workerId1, id2...] }
 * response.header.Location: Url to this agency's workers resource
 */
agenciesRouter.post("/workers", authenticateToken, needsToBeAgency, (request, response, next) => {
  // needsToBeAgency middleware saves Agency object to request.agency
  let agencyId = request.agency._id

  try {
    // Adding a single worker
    if (request.body.worker) {
      let workerId = request.body.worker
      // addToSet operation adds an item to a mongoose array, if that item is not already present.
      if (utils.workerExists(workerId, next)) {
        Agency.findOneAndUpdate({ _id: agencyId }, { $addToSet: { users: [workerId] } }, (error, result) => {
          if (error || !result) {
            return response
              .status(400)
              .json({ error: "Could not add Worker with ID" + workerId + " into Agency with ID" + agencyId + "." })
          } else {
            // Added Worker to Agency, return resource URL
            return response
              .status(200)
              .json({ updated: domainUrl + agencyApiPath + agencyId, workersAdded: workerId })
          }
        })
      } else {
        return response
          .status(400)
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
          Agency.findOneAndUpdate({ _id: response.locals.decoded.id }, { $addToSet: { users: workerIdsToAdd } }, (error, result) => {
            if (error || !result) {
              return response
                .status(400)
                .json({ error: "Could not add all Workers to Agency, so added none." })
            }
            // There were some ok worker ids to add
            return response
              .status(200)
              .header({ Location: domainUrl + agencyApiPath + agencyId + workersPath })
              .json({ success: true, workersAdded: workerIdsToAdd, workersNotAdded: workerIdsNotOk })
          })
        } else {
          return response
            .status(400)
            .json({ error: "All of the sent Worker Ids were either erronous or could not be matched with an existing worker." })
        }
      } )
    }
  } catch (exception) {
    next(exception)
  }
})

/**
 * Route for getting a list of BusinessContracts that the logged in Agency has.
 * body: No requirements
 * Successful response.body: { businesscontracts: [businessContractId1, businessContractId2...] }
 */
agenciesRouter.get("/businesscontracts", authenticateToken, needsToBeAgency, async (request, response, next) => {
  try {
    if (request.agency.businessContracts) {
      response
        .status(200)
        .json(request.agency.businessContracts)
    }
  } catch (exception) {
    logger.error(exception.message)
    next(exception)
  }
})

/**
 * Pop the last added businessContract from Agency
 */
agenciesRouter.put("/businesscontracts", authenticateToken, needsToBeAgency, async (request, response, next) => {
  try {
    if (request.agency.businessContracts) {
      request.agency.businessContracts.pop()
      request.agency.save((error, result) => {
        if (error || !result) {
          return response
            .status(500)
            .json({ message: "Unable to save Agency object." })
        } else {
          return response
            .status(200)
            .json({ message: "Last businessContract popped." })
        }
      })
    }

  } catch (exception) {
    logger.error(exception.message)
    next(exception)
  }
})

module.exports = agenciesRouter
