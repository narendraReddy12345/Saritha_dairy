const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'dmu3tqxgb',  // Your cloud name from the logo URL you shared
  api_key: process.env.CLOUDINARY_API_KEY || '342286483387765',
  api_secret: process.env.CLOUDINARY_API_SECRET || '4xcgwRnRM3m6VJHXupnXzummQaU'
});

module.exports = cloudinary;