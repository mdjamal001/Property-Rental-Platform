const Joi = require("joi");

module.exports.listingSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().required(),
  price: Joi.number().required().min(1),
  city: Joi.string().required(),
  country: Joi.string().required(),
  category: Joi.string().optional(),
  amenities: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),
  occupancy: Joi.object({
    guests: Joi.number().optional().min(1),
    bedrooms: Joi.number().optional().min(0),
    beds: Joi.number().optional().min(0),
    bathrooms: Joi.number().optional().min(0),
  }).optional(),
  geometry: Joi.object({
    type: Joi.string().optional(),
    coordinates: Joi.array().items(Joi.number()).length(2).optional(),
  }).optional(),
  totalUnits: Joi.number().optional().min(1),
  lat: Joi.number().optional(),
  lng: Joi.number().optional(),
  deletedImages: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),
}).unknown();

module.exports.reviewSchema = Joi.object({
  review: Joi.object({
    rating: Joi.number().required().min(1).max(5),
    review: Joi.string().required(),
  }).required(),
});

module.exports.bookingSchema = Joi.object({
  checkIn: Joi.date().required(),
  checkOut: Joi.date().greater(Joi.ref("checkIn")).required(),
  guestsCount: Joi.number().min(1).optional(),
});
