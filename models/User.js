const mongoose = require("mongoose")
const uniqueValidator = require("mongoose-unique-validator")

//https://mongoosejs.com/docs/validation.html
//email validator tarkistettava toimiiko halutulla tavalla, samoin phonenumber validator
const userSchema = mongoose.Schema({
  name: {
    type: String,
    minlength: 3,
    required: true
  },
  email: {
    type: String,
    unique: true,
    required: true,
    immutable: true,
    validate: {
      validator: value => {
        return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)
      },
      message: props => `${props.value} is not a valid email address`
    }
  },
  passwordHash: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now(),
    immutable: true
  },
  phonenumber: {
    type: String,
    validate: {
      validator: value => {
        // https://regexr.com/3c53v
        return /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s./0-9]*$/g.test(value)
      },
      message: props => `${props.value} is not a valid phone number`
    }
  },
  licenses: [{
    type: String,
    minlength: 3
  }],
  businessContracts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "BusinessContract",
  }],
  workContracts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "WorkContract",
  }],
})

userSchema.plugin(uniqueValidator)

userSchema.set("toJSON", {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
    delete returnedObject.passwordHash
  }
})

const User = mongoose.model("User", userSchema)

module.exports = User