const mongoose = require("mongoose")
const uniqueValidator = require("mongoose-unique-validator")


const workContractSchema = mongoose.Schema({
  createdAt: {
    type: Date,
    default: Date.now(),
    immutable: true
  },
  validityPeriod: {
    type: Date,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "business",
  },
  processStatus: {
    type: Number,
    default: 1
  }
})


workContractSchema.plugin(uniqueValidator)

workContractSchema.set("toJSON", {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
    delete returnedObject.passwordHash
  }
})

const WorkContract = mongoose.model("WorkContract", workContractSchema)

module.exports = WorkContract