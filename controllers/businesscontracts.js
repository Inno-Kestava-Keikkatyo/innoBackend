const businesscontractsRouter = require("express").Router()
const authenticateToken = require("../utils/auhenticateToken")
const BusinessContract = require("../models/BusinessContract")
const { businessContractExists, needsToBeAgency } = require("../utils/middleware")
const utils = require("../utils/common")
const businessContractsApiPath = "api/businesscontracts/"
const logger = require("../utils/logger")
const domainUrl = "http://localhost:3000/"
const Agency = require("../models/Agency")
const User = require("../models/User")
const Business = require("../models/Business")

/**
 * Route for getting one specific businessContract
 * body requirements: body.role = "agency" / "business" / "worker"
 * The logged in Agency / Business / Worker needs to be a participant in this contract.
 */
businesscontractsRouter.get("/:businessContractId", authenticateToken, businessContractExists, async (request, response, next) => {
  try {
    if (!request.body.role) {
      return response
        .status(400)
        .json({ message: "This route requires request to have body.role = agency / business / worker " })
    }

    const role = request.body.role
    const contract = request.businessContract
    const loggedId = response.locals.decoded.id

    logger.info("Contract info: " + contract.user, contract.agency, contract.business)
    if(contract.user) {
      logger.info("Undefined is enough to be true")
    }


    if (role.toString() === "agency") {
      // Check if the Agency is part of this contract
      if (contract.agency && (contract.agency.toString() === loggedId)) {
        return response
          .status(200)
          .json({ businessContract: contract })
      } else {
        return response
          .status(401)
          .json({ message: "Not authorized to view BusinessContract ID " + request.params.businessContractId })
      }
    } else if (role.toString() === "business") {
      // Check if the Business is part of this contract
      if (contract.business && (contract.business.toString() === loggedId)) {
        return response
          .status(200)
          .json({ businessContract: contract })
      } else {
        return response
          .status(401)
          .json({ message: "Not authorized to view BusinessContract ID " + request.params.businessContractId })
      }

    } else if (role.toString() === "worker") {
      // Check if the Worker is part of this contract
      if (contract.user && (contract.user.toString() === loggedId)) {
        return response
          .status(200)
          .json({ businessContract: contract })
      } else {
        return response
          .status(401)
          .json({ message: "Not authorized to view BusinessContract ID " + request.params.businessContractId })
      }

    } else {
      return response
        .status(400)
        .json({ message: "Request body.role needs to be agency / business / worker." })
    }
  } catch (exception) {
    console.log(exception.message)
    next(exception)
  }
})

/**
 * Route for initiating a connection between Agency and Business or Worker.
 * The BusinessContract is created and the url to the contract resource is returned so that it can be sent to the Business or Worker.
 * body: {businessId: "businessId" OR workerId: "workerId"}
 * agencyId from jwt-token
 * Successful response.body: The created businessContract object
 * response.header.Location: created businesscontract url api/businesscontracts/:businessContractId
 */
businesscontractsRouter.post("/", authenticateToken, needsToBeAgency, async (request, response, next) => {
  try {
    if (request.body.businessId && request.body.workerId) {
      response
        .status(400)
        .json({ message: "A BusinessContract can only have EITHER a businessId or a workerId, not both." })
    }

    const agencyId = request.agency._id
    const businessId = request.body.businessId
    const workerId = request.body.workerId
    let contractToCreate = null

    if (workerId) {
      const worker = await utils.workerExists(workerId)
      if (!worker) {
        return response
          .status(400)
          .json({ message: "Could not find given Worker (ID " + workerId + ")." })
      } else {
        logger.info("Worker with ID " + worker._id + " found.")
        contractToCreate = {
          agency: agencyId,
          user: workerId,
        }
      }
    } else if (businessId) {
      const business = await utils.businessExists(businessId)

      if (!business) {
        return response
          .status(400)
          .json({ message: "Could not find given Business (ID " + businessId + "." })
      } else {
        contractToCreate = {
          agency: agencyId,
          business: businessId,
        }
      }

    } else {
      return response
        .status(400)
        .json({ message: "No workerId or businessId in request body." })
    }

    if (contractToCreate !== null && request.agency.businessContracts) {
      logger.info("Agency has previous BusinessContracts. Agency: " + request.agency)

      // Check if businessContract between this Agency and the Business/Worker already exists
      if (contractToCreate.user) {
        const commonContractsArray = await BusinessContract.find({ agency: contractToCreate.agency, user: contractToCreate.user })
        if (commonContractsArray[0]) {  // The Agency already has a businessContract with the Worker
          return response.status(400)
            .json({ message: "Agency (ID " + agencyId + ") already has a BusinessContract with Worker (ID " + workerId + ").",
              existingContract: commonContractsArray[0] })
        }
      } else if (contractToCreate.business) {
        const commonContractsArray = await BusinessContract.find({ agency: agencyId, business: businessId })
        if (commonContractsArray[0]) { // The Agency already has a businessContract with the Business
          return response.status(400)
            .json({ message: "Agency (ID " + agencyId + ") already has a BusinessContract with Business (ID " + businessId + ").",
              existingContract: commonContractsArray[0] })
        }
      }

      // If there was no BusinessContract between this Agency and the Business, create a new one
      createBusinessContract(contractToCreate, response, createBusinessContractCallBack)

    } else if (contractToCreate !== null && request.agency.businessContracts.length === 0) { // Agency had no BusinessContracts yet
      logger.info("Agency has NO previous BusinessContracts. Agency: " + request.agency)
      createBusinessContract(contractToCreate, response, createBusinessContractCallBack)
    }
  } catch (exception) {
    console.log(exception.message)
    next(exception)
  }
})

const createBusinessContractCallBack = (error, contract, response) => {
  logger.info("In createBusinessContractCallBack...")
  if (error || !contract) {
    return response
      .status(500)
      .json({ error: "Could not save BusinessContract instance to database. Possible error message: " + error })
  } else {
    // add to participants
    logger.info("Adding created contract to participants...")
    logger.info(contract)
    addBusinessContractToParticipants(contract, (error, result) => {
      if (error || !result) { // Couldn't add the contract to a participant, rollback everything
        // check error.needToBeCleanedUp to see which participants need have the contract id removed.
        return response
          .status(500)
          .json({ message: "Unable to add created BusinessContract to participants. Possible Error message: " + error })
      } else {
        // Create-operation successful
        // Return a response with the created BusinessContract resource uri
        return response
          .status(201)
          .header({ Location: domainUrl + businessContractsApiPath + contract._id })
          .json({ contract })
      }
    })
  }
}

/**
 * Route for a Business/Worker to accept a BusinessContract created by an Agency
 * businessContractId is read from url param and the matching BusinessContract is put to request.businessContract
 */
businesscontractsRouter.put("/:businessContractId", authenticateToken, businessContractExists, async (request, response, next) => {
  try {
    const business = await Business.findById({ _id: response.locals.decoded.id })
    const worker = await User.findById({ _id: response.locals.decoded.id })

    if (business) {
      logger.info("Business: " + business)
      request.business = business

      if (request.businessContract.business.toString() !== request.business._id.toString()) {
        return response
          .status(401)
          .json({ message: "Business with ID " + request.business._id + " not authorized to accept this BusinessContract. Required: " + request.businessContract.business })
      } else {
        BusinessContract.findByIdAndUpdate(request.businessContract._id, { contractMade: true },
          { new: true }, (error, result) => {
            if (error || !result) {
              return response
                .status(400)
                .send(error || { message: "Could not find and update BusinessContract with ID " + request.businessContract._id })
            } else {
              response
                .header({ Location: businessContractsApiPath + request.businessContract._id })
                .status(200)
                .json({ businessContract: request.businessContract })
            }
          })
      }
    } else if (worker) {
      BusinessContract.findByIdAndUpdate(request.businessContract._id, { contractMade: true },
        { new: true }, (error, result) => {
          if (error || !result) {
            return response
              .status(400)
              .send(error || { message: "Could not find and update BusinessContract with ID " + request.businessContract._id })
          } else {
            response
              .header({ Location: businessContractsApiPath + request.businessContract._id })
              .status(200)
              .json({ businessContract: request.businessContract })
          }
        })
    } else {
      return response
        .status(400)
        .send({ message: "Logged in user must be Worker or Business." })
    }
  } catch (exception) {
    next(exception)
  }
})

/**
 * Route for an Agency to delete an existing BusinessContract and remove its references from its participants
 * businessContractId is read from url param and the matching BusinessContract is put to request.businessContract by businessContractExists-middleware
 * The logged in Agency object is in request.agency by needsToBeAgency-middleware
 */
businesscontractsRouter.delete("/:businessContractId", authenticateToken, businessContractExists, needsToBeAgency, async (request, response, next) => {
  try {
    // Check whether the logged in Agency is a participant
    if (request.businessContract.agency.toString() !== request.agency._id.toString()) {
      logger.info("Agency with ID " + request.agency._id + " is not authorized to delete BusinessContract with ID " + request.businessContract._id + ".")
      return response
        .status(401)
        .json({ message: "Agency with ID " + request.agency._id + " is not authorized to delete BusinessContract with ID " + request.businessContract._id + "." })
    }

    const businessContractId = request.businessContract._id

    // Ok to delete
    logger.info("Deleting...")
    const success = await utils.deleteTracesOfBusinessContract(request.businessContract, next)

    if (!success) {
      logger.error("Unable to delete all references to BusinessContract with ID " + businessContractId +". Check Agency ID " + request.businessContract.agency + ", Business ID " + request.businessContract.business + ", Worker ID " + request.businessContract.user + ".")
      return response
        .status(500)
        .json({ message: "Unable to delete all references to BusinessContract with ID " + businessContractId })
    } else {
      BusinessContract.findByIdAndDelete(businessContractId, (error, result) => {
        if (error||!result) {
          return response
            .status(500)
            .json({ message: "Deleted references to BusinessContract with ID " + businessContractId + " but could not remove the contract itself. Possible error: " + error })
        } else {
          return response
            .status(200)
        }
      })
    }

  } catch (exception) {
    next(exception)
  }

})
/**
 * Helper function to avoid duplicate code. Function creates the businessContract and saves it to database.
 * Note: ONLY workerId OR businessId should be present in participants. Otherwise will return an error.
 * @param {Object} participants - { agencyId, businessId || workerId }
 * @param {String} participants.agencyId - Agency to be saved to the BusinessContract
 * @param {String} participants.businessId - Business to be saved to the BusinessContract
 * @param {String} participants.workerId - Worker to be saved to the BusinessContract
 * @returns {Object|Error} Error if saving the contract was not successful or both workerId and businessId were given in parameter. A BusinessContract object if saving to database was successful. 
 */
const createBusinessContract = (contractToCreate, response, callback) => {

  if (contractToCreate.business && contractToCreate.user) {
    callback(new Error("Both businessId and workerId given to createBusinessContract(), can take only either one."))
  }

  const businessContract = new BusinessContract({
    ...contractToCreate
  })

  businessContract.save((error, contract) => {
    if (error || !contract) {
      callback(error, null, response)
    } else {
      logger.info("BusinessContract created with ID " + businessContract._id)
      callback(null, contract, response)
    }
  })
}

/**
 * After a BusinessContract is made, a reference to it needs to be added to both of its participants.
 * A BusinessContract is always between a) Agency and Worker or b) Agency and Business.
 * @param {BusinessContract} contract The created BusinessContract to be added to participants.
 * @param {Function} callback A function(error, result) which will handle the outcome of this function.
 */
const addBusinessContractToParticipants = async (contract, callback) => {
  // $addToSet adds to mongoose array if the item does not already exist, thus eliminating duplicates.
  const agency = await Agency.findOneAndUpdate({ _id: contract.agency }, { $addToSet: { businessContracts: [contract._id] } })
  if (!agency) { // No agency found or error happened.
    callback(new Error({ reason: "agency", message: "Could not add the BusinessContract to Agency with ID " + contract.agency + "." }), null)
  } else {
    if (contract.user) {
      // add to worker
      const worker = await User.findOneAndUpdate({ _id: contract.user }, { $addToSet: { businessContracts: [contract._id] } })
      if (!worker) { // No worker found or error happened
        callback(new Error({ needToCleanUp: { agency: contract.agency }, message: "Could not add created BusinessContract to Worker with ID " + contract.user + "." }), null)
      } else {
        callback(null, true)
      }
    } else if (contract.business) {
      // add to business
      const business = await Business.findOneAndUpdate({ _id: contract.business }, { $addToSet: { businessContracts: [contract._id] } })
      if (!business) { // No business found or error happened
        callback(new Error({ needToCleanUp: { agency: contract.agency, worker: contract.user }, message: "Could not add created BusinessContract to Business with ID " + contract.business + "." }), null)
      } else {
        callback(null, true)
      }
    }
  }
}

module.exports = businesscontractsRouter