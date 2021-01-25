const mongoose = require("mongoose")
const uniqueValidator = require("mongoose-unique-validator")

//https://mongoosejs.com/docs/validation.html
//email validator tarkistettava toimiiko halutulla tavalla
const agencySchema = mongoose.Schema({
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
    validate: {
      validator: value => {
        // https://regexr.com/3c53v
        return /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s./0-9]*$/g.test(value)
      },
      message: props => `${props.value} is not a valid phone number`
    }
  },
  securityOfficer: {
    type: String,
  },
  passwordHash: {
    type: String,
    required: true
  },
  createdAt: {
    immutable: true,
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
  businessContracts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "BusinessContract",
  }],
  workContracts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "WorkContract",
  }]

})

agencySchema.plugin(uniqueValidator)

agencySchema.set("toJSON", {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
    delete returnedObject.passwordHash
  },
})

const Agency = mongoose.model("Agency", agencySchema)

module.exports = Agency
