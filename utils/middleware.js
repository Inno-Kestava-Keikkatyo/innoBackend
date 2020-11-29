const logger = require("./logger")
const Business = require("../models/Business")
const Agency = require("../models/Agency")
const BusinessContract = require("../models/BusinessContract")

const requestLogger = (request, response, next) => {
  logger.info("Method:", request.method)
  logger.info("Path:  ", request.path)
  logger.info("Body:  ", request.body)
  logger.info("---")
  next()
}

const unknownEndpoint = (request, response) => {
  response.status(404).send({ error: "unknown endpoint" })
}

const errorHandler = (error, request, response, next) => {
  logger.error(error.message)

  if (error.name === "CastError" && error.kind === "ObjectId") {
    return response.status(400).send({ error: "malformatted id" })
  } else if (error.name === "ValidationError") {
    return response.status(400).json({ error: error.message })
  }

  next(error)
}

/**
 * Checks if a Business with request.body.businessId exists.
*/
const bodyBusinessExists = (request, response, next) => {
  try {
    if (request.body.businessId) {
      return Business.findById({ _id: request.body.businessId }, (error, result) => {
        if (error || !result) {
          response.status(404).send({ error: "No business found with the request businessId." })
        } else {
          return next()
        }
      })
    } else {
      response.status(400).send({ error: "No businessId in request body." })
    }
  } catch (exception) {
    next(exception)
  }
}

/**
 * Checks if an Agency with url param :agencyId exists.
 * Returned Agency object from database is put to request.agency
*/
const agencyExists = (request, response, next) => {
  try {
    if (request.params.agencyId) {
      return Agency.findById({ _id: request.params.agencyId }, (error, result) => {
        if (error || !result) {
          response.status(404).send({ error: "No Agency found with the request :agencyId." })
        } else {
          request.agency = result
          return next()
        }
      })
    } else {
      response.status(400).send({ error: "No :agencyId in url." })
    }
  } catch (exception) {
    next(exception)
  }
}

/**
 * Checks if an Business with url param :businessId exists.
 * Returned Business object from database is put to request.business
*/
const businessInParamExists = (request, response, next) => {
  try {
    if (request.params.businessId) {
      return Business.findById({ _id: request.params.businessId }, (error, result) => {
        if (error || !result) {
          response.status(404).send({ error: "No Business found with the request :businessId." })
        } else {
          request.business = result
          return next()
        }
      })
    } else {
      response.status(400).send({ error: "No :businessId in url." })
    }
  } catch (exception) {
    next(exception)
  }
}

/**
 * Checks if a BusinessContract with url param :businessContractId exists.
*/
const businessContractExists = (request, response, next) => {
  try {
    if (request.params.businessContractId) {
      return BusinessContract.findById({ _id: request.params.businessContractId }, (error, result) => {
        if (error || !result) {
          response.status(404).send({ error: "No BusinessContract found with the request :businessContractId." })
        } else {
          request.businessContract = result
          return next()
        }
      })
    } else {
      response.status(400).send({ error: "No :businessContractId in url." })
    }
  } catch (exception) {
    next(exception)
  }
}

/**
 * Checks if the logged in user is an Agency.
 * Agency object from database is populated to request.agency
*/
const needsToBeAgency = (request, response, next) => {
  Agency.findById({ _id: response.locals.decoded.id }, (error, result) => {
    if (error || !result) {
      response.status(401).send(error || { message: "This route only available to Agency users. The logged in user with ID " + request.locals.decoded.id + " is not one." })
    } else {
      request.agency = result
      return next()
    }
  })
}

/**
 * Checks if the logged in user is a Business.
 * Business object from database is populated to request.business
*/
const needsToBeBusiness = (request, response, next) => {
  Business.findById({ _id: response.locals.decoded.id }, (error, result) => {
    if (error || !result) {
      response.status(401).send(error || { message: "This route only available to Business users. The logged in user with ID " + request.locals.decoded.id + " is not one." })
    } else {
      request.business = result
      return next()
    }
  })
}


module.exports = {
  requestLogger,
  unknownEndpoint,
  errorHandler,
  bodyBusinessExists,
  businessInParamExists,
  agencyExists,
  businessContractExists,
  needsToBeAgency,
  needsToBeBusiness
}