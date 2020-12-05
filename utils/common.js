const User = require("../models/User")
const Business = require("../models/Business")
const Agency = require("../models/Agency")
const logger = require("./logger")

/**
 * Checks if a worker with param id exists.
 * @param {*} id
 * @returns True, if worker exists. False, if not.
*/
const workerExists = async (id) => {
  logger.info("Checking if Worker with ID " + id + " exists.")
  return await User.findById({ _id: id }).exec()
}

/**
 * Checks through an array of worker ids,and returns an array of ids that exist.
 * Returned list may contain duplicates, if the param array had them.
 * @param {Array} workerIdArray
 */
const whichWorkersExist = (workerIdArray, next, callback) => {
  try {
    let existingWorkerIds = []
    let nonExistingWorkerIds = []
    if (Array.isArray(workerIdArray)) {
      for (let i = 0; i < workerIdArray.length; i++) {
        User.findById(workerIdArray[i], (error, result) => {
          if (error || !result) {
            nonExistingWorkerIds.push(workerIdArray[i])
          } else {
            existingWorkerIds.push(workerIdArray[i])
          }

          if (i === workerIdArray.length-1) {
            callback({
              existingWorkerIds: existingWorkerIds,
              nonExistingWorkerIds: nonExistingWorkerIds
            })
          }
        })
      }
    }
  } catch (exception) {
    next(exception)
  }
}

/**
 * If a WorkContract fails to save, this method will remove the id references which may have been updated to Worker, Business, Agency
 */
const deleteTracesOfWorkContract = async (workerId, businessId, agencyId, workContractId, next) => {
  try {
    const options = { $pull: { workContracts: ["workContractId"] } }
    let successful = true

    await User.findByIdAndUpdate(workerId, options, (error, result) => {
      if (error) {
        logger.error("Could not remove WorkContract ID " + workContractId + " from Worker ID " + workerId + " because of  ERROR: " + error)
        successful = false
      } else if (!result) {
        successful = false
        logger.info("Could not remove WorkContract ID " + workContractId + " from Worker ID " + workerId + ". Could not find Worker.")
      }
    })

    await Agency.findByIdAndUpdate(agencyId, options, (error, result) => {
      if (error) {
        logger.error("Could not remove WorkContract ID " + workContractId + " from Agency ID " + agencyId + " because of  ERROR: " + error)
        successful = false
      } else if (!result) {
        successful = false
        logger.info("Could not remove WorkContract ID " + workContractId + " from Agency ID " + agencyId + ". Could not find Agency.")
      }
    })

    await Business.findByIdAndUpdate(businessId, options, (error, result) => {
      if (error) {
        logger.error("Could not remove WorkContract ID " + workContractId + " from Business ID " + businessId + " because of  ERROR: " + error)
        successful = false
      } else if (!result) {
        successful = false
        logger.info("Could not remove WorkContract ID " + workContractId + " from Business ID " + businessId + ". Could not find Business.")
      }
    })

    if (!successful) {
      return false
    } else {
      return true
    }
  } catch (error) {
    next(error)
  }
}

/**
 * A method for removing references to a BusinessContract from Worker, Business, Agency
 */
const deleteTracesOfBusinessContract = async (businessContract, next) => {
  try {
    let success = true
    const options = { $pull: { businessContracts: [businessContract._id] }, new: true }

    if (businessContract.user) {
      const user = await User.findByIdAndUpdate(businessContract.user, options).exec()
      logger("Deleting traces of BusinessContract ID " + businessContract._id + ". User: " + user)
      if (!user) {
        success = false
      }
    }

    if (businessContract.business) {
      const business = await Business.findByIdAndUpdate(businessContract.business, options).exec()
      logger.info("Deleting traces of BusinessContract ID " + businessContract._id + ". Business: " + business)
      if (!business) {
        logger.info("Turning success to false.")
        success = false
      }
    }

    const agency = await Agency.findByIdAndUpdate(businessContract.agency, options).exec()
    logger.info("Deleting traces of BusinessContract ID " + businessContract._id + ". Agency: " + agency)
    if (!agency) {
      logger.info("Turning success to false.")
      success = false
    }

    if (success && agency) {
      return true
    } else {
      return false
    }
  } catch (error) {
    next(error)
  }
}

/**
 * Checks if a Business with businessId exists.
*/
const businessExists = async (businessId) => {
  const business = await Business.findById({ _id: businessId })
  if (!business) {
    logger.error("Error in businessexists. ")
    return false
  } else {
    logger.info("BusinessExists: " + business)
    return true
  }
}


module.exports = {
  workerExists, whichWorkersExist, deleteTracesOfWorkContract, businessExists, deleteTracesOfBusinessContract
}
