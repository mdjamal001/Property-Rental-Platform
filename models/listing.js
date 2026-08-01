const mongoose = require("mongoose");
const Review = require("./review.js");

const listingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    price: {
      type: Number,
      required: true,
      min: 1,
    },
    images: [
      {
        url: String,
        filename: String,
      },
    ],
    geometry: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: [73.8567, 15.2993], // [lng, lat] default Goa coordinates if unassigned
      },
    },
    category: {
      type: String,
      enum: [
        "Trending",
        "Farms",
        "Pools",
        "Mountains",
        "Castles",
        "Lakes",
        "Views",
        "Arctic",
        "Beachfront",
        "Cities",
        "Boats",
        "Skiing",
        "Towers",
      ],
      default: "Trending",
    },
    amenities: [
      {
        type: String,
      },
    ],
    occupancy: {
      guests: { type: Number, default: 2 },
      bedrooms: { type: Number, default: 1 },
      beds: { type: Number, default: 1 },
      bathrooms: { type: Number, default: 1 },
    },
    totalUnits: {
      type: Number,
      default: 1,
      min: 1,
    },
    city: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviews: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review",
      },
    ],
  },
  { toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

listingSchema.virtual("image").get(function () {
  if (this.images && this.images.length > 0) {
    return this.images[0];
  }
  return {
    url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?q=80&w=800",
    filename: "defaultimage",
  };
});

listingSchema.post("findOneAndDelete", async (listing) => {
  if (listing) {
    await Review.deleteMany({ _id: { $in: listing.reviews } });
  }
});

const Listing = mongoose.model("Listing", listingSchema);

module.exports = Listing;
