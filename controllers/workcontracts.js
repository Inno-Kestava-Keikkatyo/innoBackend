const workcontractsRouter = require("express").Router()
const { body } = require("express-validator")
const Agency = require("../models/Agency")
const Business = require("../models/Business")
const WorkContract = require("../models/WorkContract")
const User = require("../models/User")
const authenticateToken = require("../utils/auhenticateToken")
const { needsToBeAgency, bodyBusinessExists } = require("../utils/middleware")
const { workerExists, deleteTracesOfFailedWorkContract } = require("../utils/common")
const logger = require("../utils/logger")

const domainUrl = "http://localhost:8000/"
const workContractsApiPath = "workcontracts/"

workcontractsRouter.get("/:contractId", authenticateToken, (request, response, next) => {
  // TODO: Validate the id, check that the logged in user is authored for this
  try {
    WorkContract.findById({ _id: request.params.contractId }, (error, result) => {
      if (!result || error) {
        response.status(400).send(error || { success: false, error: "Could not find WorkContract with id " + request.params.contractId })
      } else {
        return response.status(200).send(result)
      }
    })
  } catch (exception) {
    next(exception)
  }
})

/**
 * Agency creates a new WorkContract between a Business and a Worker.
 * The WorkContract id is then saved to lists in: Worker, Agency, Business
 * Body mandatory: { businessId: "businessId", workerId: "workerId", validityPeriod: "valid end date" }
 * Body optional: { processStatus: "integer" } has a default of "1"
 */
workcontractsRouter.post("/", authenticateToken, needsToBeAgency, bodyBusinessExists, async (request, response, next) => {
  try {
    // TODO: Validate body objects for malicious code, and the validate the validityPeriod date object and processStatus for correctness
    const businessId = request.body.businessId
    console.log("businessId" + businessId)
    const workerId = request.body.workerId
    const validityPeriod = new Date(request.body.validityPeriod)
    const processStatus = request.body.processStatus
    const agencyId = request.agencyId


    // Check contract between business and agency
    if (!request.agency.businessContracts || request.agency.businessContracts.length <= 0) {
      response.status(400).send({ message: "The logged in Agency has no BusinessContracts." })
    }
    // request.agency.businessContracts
    const arr = ["jeejee", "joojoo", "5fa88f86e4763b5ed8ea105e"]
    // Go through the contracts from this agency and check if the required :businessId can be found from any of them
    let commonContractIndex = -1
    if (request.agency.businessContracts || request.agency.businessContracts.length > 0) {
      
      
        commonContractIndex = request.agency.businessContracts.findIndex((contract) => {
        return contract.toString() === businessId.toString()
      })
    }
    // If a common contract is found,
    let commonContractId = null
    console.log("commoncontractindex: " + commonContractIndex)
    if (commonContractIndex === -1) {
      response.status(400).send({ message: "The logged in Agency has no BusinessContracts with Business with ID " + businessId })
    } else {
      commonContractId = arr[commonContractIndex]
    }

    if (!workerExists(body.workerId)) {
      response.status(404).json({ success: false, message: "Couldn't find Worker with ID " + body.workerId })
    }

    let createFields = {
      business: businessId,
      user: workerId,
      validityPeriod: validityPeriod,
      processStatus: processStatus
    }
    if (body.processStatus) {
      createFields.processStatus = body.processStatus
    }

    const contractToCreate = new WorkContract(createFields)

    // Add the contract id to the business, agency and worker
    await Business.findOneAndUpdate({ _id: businessId }, { $addToSet: { workcontracts: contractToCreate._id } }, (error, result) => {
      if (!result || error) {
        // Adding the WorkContract to Business failed, no contract saved
        response
          .status(500)
          .send(error || { message: "Could not add WorkContract to Business  with ID" + businessId + ". No WorkContract created." })
      }
    })

    let errorInDelete = null

    await Agency.findOneAndUpdate({ _id: agencyId }, { $addToSet: { workcontracts: contractToCreate._id } }, (error, result) => {
      if (!result || error) {
        console.log("Adding the WorkContract to Agency failed, no contract saved. Running deleteTracesOfFailedWorkContract()")
        // Adding the WorkContract to Agency failed, no contract saved
        errorInDelete = deleteTracesOfFailedWorkContract(workerId, businessId, agencyId, contractToCreate._id, next)

        // Deleting the id of the new WorkContract from agency, business, worker was successful
        if (!errorInDelete) {
          logger.error("Could not add WorkContract to Agency  with ID" + agencyId + ". No WorkContract created.")
          response
            .status(500)
            .send(error || { message: "Could not add WorkContract to Agency  with ID" + agencyId + ". No WorkContract created." })
        } else if (errorInDelete) {
          // Deleting the id references for the nonexisting WorkContract was not successful, log the result.
          logger.error("Could not add WorkContract to Agency  with ID" + agencyId + ". No WorkContract created, but references to the nonexisting workContract ID " + contractToCreate._id+" could not be removed. \n"
            + "Check Agency with ID " + agencyId + " and Business with ID " + businessId + ".")
          response
            .status(500)
            .send(error || { message: "Could not add WorkContract to Agency  with ID" + agencyId + ". No WorkContract created." })
        }
      }
    })

    errorInDelete = null
    await User.findOneAndUpdate({ _id: workerId }, { $addToSet: { workcontracts: contractToCreate._id } }, (error, result) => {
      if (!result || error) {
        // Adding the WorkContract to Worker failed, no contract saved
        errorInDelete = deleteTracesOfFailedWorkContract(workerId, businessId, agencyId, contractToCreate._id, next)

        if (!errorInDelete) {   // Deleting the id of the new WorkContract from agency, business, worker was successful
          logger.error("Could not add WorkContract to Worker  with ID" + workerId + ". No WorkContract created.")
          response
            .status(500)
            .send(error || { message: "Could not add WorkContract to Worker  with ID" + workerId + ". No WorkContract created." })
        } else if (errorInDelete) {
          // Deleting the id references for the nonexisting WorkContract was not successful, log the result.
          logger.error("Could not add WorkContract to Worker  with ID" + workerId + ". No WorkContract created, but references to the nonexisting workContract ID " + contractToCreate._id+" could not be removed. \n"
            + "Check  with ID " + agencyId + " and Business with ID " + businessId + " and Worker with ID " + workerId + ".")
          response
            .status(500)
            .send(error || { message: "Could not add WorkContract to Worker  with ID" + agencyId + ". No WorkContract created, but references to the nonexisting workContract ID " + contractToCreate._id+" could not be removed. \n"
                + "Check  with ID " + agencyId + " and Business with ID " + businessId + " and Worker with ID " + workerId + "." })
        }
      }
    })

    // Updating Agency, Business, Worker successful
    const contract = await contractToCreate.save()
    console.log(contract.toString)
    if (!contract) {
      errorInDelete = deleteTracesOfFailedWorkContract(workerId, businessId, agencyId, contractToCreate._id, next)
      // Deleting the id of the new WorkContract from agency, business, worker was successful
      if (!errorInDelete) {
        logger.error("Could not save WorkContract with ID" + contractToCreate._id + ". No WorkContract created.")
        response
          .status(500)
          .send( { message: "Could not save WorkContract with ID" + contractToCreate._id + ". No WorkContract created." })
      } else if (errorInDelete) {
        // Deleting the id references for the nonexisting WorkContract was not successful, log the result.
        logger.error("Could not save WorkContract with ID" + contractToCreate._id + ". No WorkContract created, but references to the nonexisting workContract could not be removed. \n"
            + "Check  with ID " + agencyId + " and Business with ID " + businessId + " and Worker with ID " + workerId + ".")
        response
          .status(500)
          .send( { message: "Could not save WorkContract with ID" + contractToCreate._id + ". No WorkContract created, but references to the nonexisting workContract could not be removed. \n"
                + "Check  with ID " + agencyId + " and Business with ID " + businessId + " and Worker with ID " + workerId + "." })
      }
    } else {
      return response
        .status(201)
        .json({ created: domainUrl + workContractsApiPath + contract._id })

    }
  } catch (exception) {
    next(exception)
  }

})

/**
 * Update a WorkContract
 * Body can contain one or more of the following:
 * { businessId: "businessId", workerId: "workerId", validityPeriod: "valid end date", processStatus: "integer"}
 */
workcontractsRouter.put("/:contractId", authenticateToken, (request, response, next) => {
  // TODO: Validate the id, check that the logged in user is authored for this
  // TODO: What form the end date need to be?
  try {
    const updateFields = {
      ...request.body
    }

    WorkContract.findByIdAndUpdate(request.params.contractId, updateFields, { new: false, omitUndefined: true, runValidators: true }, (error, result) => {
      if (!result || error) {
        response.status(400).send(error || { success: false, error: "Could not update WorkContract with id " + request.params.contractId })
      } else {
        return response.status(200).send(result)
      }
    })
  } catch (exception) {
    next(exception)
  }
})

module.exports = workcontractsRouter