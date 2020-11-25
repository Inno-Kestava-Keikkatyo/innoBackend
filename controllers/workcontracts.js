const workcontractsRouter = require("express").Router()
const { body } = require("express-validator")
const Agency = require("../models/Agency")
const WorkContract = require("../models/WorkContract")
const authenticateToken = require("../utils/auhenticateToken")
const { needsToBeAgency } = require("../utils/middleware")

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
workcontractsRouter.post("/", authenticateToken, needsToBeAgency, async (request, response, next) => {
  try {
    // TODO: Check that worker, business exist and the validate the validityPeriod date object
    const body = request.body
    const contractToCreate = new WorkContract({
      name: body.businessId,
      email: body.workerId,
      validityPeriod: body.validityPeriod
    })

    if (body.processStatus) {
      contractToCreate.processStatus = body.processStatus
    }

    const contract = await contractToCreate.save()

    // TODO: add the contract id to the business, agency and worker

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