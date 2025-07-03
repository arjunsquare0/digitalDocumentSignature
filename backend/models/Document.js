// backend/models/Document.js
const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true,
    trim: true
  },
  originalFilePath: { // Path or URL to the original PDF
    type: String,
    required: true
  },
  signedFilePath: { // Path or URL to the signed PDF
    type: String,
    default: null
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  signedAt: {
    type: Date,
    default: null
  },
  signatures: [ // Array to store details of each signature applied
    {
      type: { // 'image' or 'text'
        type: String,
        enum: ['image', 'text'],
        required: true
      },
      data: { // Base64 for image, or text string for text signature
        type: String,
        required: true
      },
      pageNumber: {
        type: Number,
        required: true
      },
      x: Number,
      y: Number,
      font: String, // For text signatures
      fontSize: Number, // For text signatures
      color: String, // For text signatures
      appliedAt: {
        type: Date,
        default: Date.now
      }
    }
  ]
});

module.exports = mongoose.model('Document', DocumentSchema);
