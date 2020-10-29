const businessesRouter = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const Business = require('../models/Business')
const authenticateToken = require('../utils/auhenticateToken')

businessesRouter.post('/', async (request, response, next) => {
  try {
    const body = request.body
    // This could be separated into a validation middleware
    const passwordLength = body.password ? body.password.length : 0
    if (passwordLength < 3) {
      return response
        .status(400)
        .json({ error: 'password length less than 3 characters' })
    }
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(body.password, saltRounds)

    const business = new Business({
      name: body.name,
      email: body.email,
      passwordHash,
    })

    const savedBusiness = await business.save()

    const businessForToken = {
      email: savedBusiness.email,
      id: savedBusiness._id,
    }

    const token = jwt.sign(businessForToken, process.env.SECRET)

    console.log('jwt token: ' + token)
    //response.json(savedBusiness);
    response
      .status(200)
      .send({ token, name: savedBusiness.name, email: savedBusiness.email, role: 'business' })
  } catch (exception) {
    next(exception)
  }
})

businessesRouter.get('/me', authenticateToken, (request, response, next) => {
  try {
    //Decodatun tokenin arvo haetaan middlewarelta
    const decoded = response.locals.decoded
    //Tokeni pitää sisällään userid jolla etsitään oikean käyttäjän tiedot
    Business.findById({ _id: decoded.id }, function (error, result) {
      if (error) {
        response.send(error)
      } else {
        response.status(200).send(result)
      }
    })
  } catch (exception) {
    next(exception)
  }
})

module.exports = businessesRouter
