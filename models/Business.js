const mongoose = require("mongoose")
const uniqueValidator = require("mongoose-unique-validator")

const businessSchema = mongoose.Schema({
  name: {
    type: String,
    minlength: 3,
    required: true
  },
  email: {
    type: String,
    unique: true,
    required: true,
    validate: {
      validator: value => {
        return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)
      },
      message: props => `${props.value} is not a valid email address`
    }
  },
  city: {
    type: String,
  },
  postnumber: {
    type: String,
  },
  address: {
    type: String,
  },
  phonenumber: {
    type: String,
  },
  passwordHash: String,
  createdAt: {
    type: Date,
    default: Date.now(),
  },
  users: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  forms: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Form",
    },
  ],
})

businessSchema.plugin(uniqueValidator)

businessSchema.set("toJSON", {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
    delete returnedObject.passwordHash
  },
})

const Business = mongoose.model("Business", businessSchema)

module.exports = Business
