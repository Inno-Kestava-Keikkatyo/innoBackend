const User = require("../models/User")
const Business = require("../models/Business")
const Agency = require("../models/Agency")
const logger = require("./logger")

/**
 * Checks if a worker with param id exists.
 * @param {*} id
 * @returns True, if worker exists. False, if not.
*/
const workerExists = (id, next) => {
  try {
    return User.findById({ _id: id }, (error, result) => {
      if (error || !result) {
        return
      } else {
        return result
      }
    })
  } catch (exception) {
    next(exception)
  }
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
const deleteTracesOfFailedWorkContract = async (workerId, businessId, agencyId, workContractId, next) => {
  try {
    const options = { $pull: { workContracts: ["workContractId"] } }
    let errorHappened = false
    await User.findByIdAndUpdate(workerId, options )
      .then((result, error) => {
        if (error) {
          logger.error("Could not remove WorkContract ID " + workContractId + " from Worker ID " + workerId + " because of  ERROR: " + error)
          errorHappened = true
        } else if (!result) {
          logger.info("Could not remove WorkContract ID " + workContractId + " from Worker ID " + workerId + ". Could not find Worker.")
        }
      })

    await Agency.findByIdAndUpdate(agencyId, options )
      .then((result, error) => {
        if (error) {
          logger.error("Could not remove WorkContract ID " + workContractId + " from Agency ID " + agencyId + " because of  ERROR: " + error)
          errorHappened = true
        } else if (!result) {
          logger.info("Could not remove WorkContract ID " + workContractId + " from Agency ID " + agencyId + ". Could not find Agency.")
        }
      })

    await Business.findByIdAndUpdate(businessId, options )
      .then((result, error) => {
        if (error) {
          logger.error("Could not remove WorkContract ID " + workContractId + " from Business ID " + businessId + " because of  ERROR: " + error)
          errorHappened = true
        } else if (!result) {
          logger.info("Could not remove WorkContract ID " + workContractId + " from Business ID " + businessId + ". Could not find Business.")
        }
      })

    if (errorHappened) {
      return false
    } else {
      return true
    }
  } catch (error) {
    next(error)
  }
}

module.exports = {
  workerExists, whichWorkersExist, deleteTracesOfFailedWorkContract
}
