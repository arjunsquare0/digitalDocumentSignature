const express = require('express');
const router = express.Router();
const multer = require('multer'); // For handling file uploads
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs').promises; // For file system operations
const path = require('path');
const Document = require('../models/Document');

// Import the PDF Signer utility
const { signPdfWithImage, signPdfWithText } = require('../utils/pdf-signer');

// Setup Multer for file uploads
const storage = multer.memoryStorage(); // Store file in memory
const upload = multer({ storage: storage });

// Store signatures temporarily (in production, use a proper database)
let signatureQueue = [];

// @route   POST /api/upload-pdf
// @desc    Uploads a PDF document
// @access  Public
router.post('/upload-pdf', upload.single('pdfFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ msg: 'No PDF file uploaded' });
      }

      // Clear any previous signature queue
      signatureQueue = [];

      // In a real app, you'd save the PDF to a storage (e.g., 'uploads' folder or S3)
      // For demonstration, let's assume it's saved and you get a path/URL
      const tempFilePath = path.join(__dirname, '../uploads', req.file.originalname);
      await fs.writeFile(tempFilePath, req.file.buffer); // Save to a temporary uploads folder

      const newDocument = new Document({
        fileName: req.file.originalname,
        originalFilePath: tempFilePath, // Store the path where it's saved
      });

      await newDocument.save();

      res.status(200).json({
        msg: 'PDF uploaded successfully',
        fileName: req.file.originalname,
        documentId: newDocument._id
      });

    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  });

// @route   POST /api/sign-pdf
// @desc    Applies a signature (image or text) to a PDF
// @access  Public
router.post('/sign-pdf', upload.single('pdfFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No PDF file provided for signing' });
    }

    const { signatureType, signatureData, x, y, pageNumber, font, fontSize, color } = req.body;
    
    // Add signature to queue
    signatureQueue.push({
      type: signatureType,
      data: signatureData,
      x: parseFloat(x),
      y: parseFloat(y),
      pageNumber: parseInt(pageNumber),
      font: font,
      fontSize: parseInt(fontSize),
      color: color
    });

    // If this is the first signature, store the PDF
    if (signatureQueue.length === 1) {
      signatureQueue.pdfBytes = req.file.buffer;
    }

    // Process all signatures in the queue
    let signedPdfBytes = signatureQueue.pdfBytes;

    for (const signature of signatureQueue) {
      if (signature.type === 'image') {
        signedPdfBytes = await signPdfWithImage(signedPdfBytes, signature.data, signature.x, signature.y, signature.pageNumber);
      } else if (signature.type === 'text') {
        signedPdfBytes = await signPdfWithText(signedPdfBytes, signature.data, signature.x, signature.y, signature.pageNumber, signature.font, signature.fontSize, signature.color);
      }
    }

    // Clear the signature queue after processing
    signatureQueue = [];

    // Send the signed PDF back to the client
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=signed_document.pdf');
    res.send(Buffer.from(signedPdfBytes));

  } catch (err) {
    console.error('Error signing PDF:', err.message);
    res.status(500).send('Server Error during PDF signing');
  }
});

// @route   POST /api/apply-signatures
// @desc    Applies multiple signatures to a PDF at once
// @access  Public
router.post('/apply-signatures', upload.single('pdfFile'), async (req, res) => {
  try {
    console.log('=== Backend: apply-signatures route called ===');
    
    if (!req.file) {
      console.error('No PDF file provided');
      return res.status(400).json({ msg: 'No PDF file provided' });
    }

    console.log('PDF file received:', req.file.originalname, req.file.size, 'bytes');

    const { signatures } = req.body;
    let pdfBytes = req.file.buffer;

    if (!signatures) {
      console.error('No signatures provided');
      return res.status(400).json({ msg: 'No signatures provided' });
    }

    console.log('Signatures data received:', signatures);

    const signaturesArray = JSON.parse(signatures);
    console.log('Parsed signatures array:', signaturesArray);
    console.log('Number of signatures to apply:', signaturesArray.length);
    console.log('Initial PDF size:', pdfBytes.length, 'bytes');

    if (signaturesArray.length === 0) {
      console.error('No signatures in array');
      return res.status(400).json({ msg: 'No signatures provided. Please add at least one signature before downloading.' });
    }

    // Apply each signature to the PDF
    for (let i = 0; i < signaturesArray.length; i++) {
      const signature = signaturesArray[i];
      console.log(`Applying signature ${i + 1}:`, signature);
      console.log('Signature coordinates:', { x: signature.x, y: signature.y, pageNumber: signature.pageNumber });
      console.log('PDF size before applying signature:', pdfBytes.length, 'bytes');
      try {
        if (signature.type === 'image') {
          console.log('Processing image signature...');
          pdfBytes = await signPdfWithImage(pdfBytes, signature.data, signature.x, signature.y, signature.pageNumber);
          console.log('Image signature applied successfully');
        } else if (signature.type === 'text') {
          console.log('Processing text signature...');
          pdfBytes = await signPdfWithText(pdfBytes, signature.data, signature.x, signature.y, signature.pageNumber, signature.font, signature.fontSize, signature.color);
          console.log('Text signature applied successfully');
        } else {
          console.warn(`Unknown signature type: ${signature.type}`);
        }
        console.log('PDF size after applying signature:', pdfBytes.length, 'bytes');
      } catch (signatureError) {
        console.error(`Error applying signature ${i + 1}:`, signatureError);
        throw new Error(`Failed to apply signature ${i + 1}: ${signatureError.message}`);
      }
    }

    console.log('All signatures applied. Final PDF size:', pdfBytes.length, 'bytes');

    // Send the signed PDF back to the client
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=signed_document.pdf');
    res.send(Buffer.from(pdfBytes));
    
    console.log('Signed PDF sent to client successfully');

  } catch (err) {
    console.error('Error applying signatures:', err.message);
    console.error('Error stack:', err.stack);
    res.status(500).json({ 
      error: 'Server Error during signature application',
      details: err.message 
    });
  }
});

module.exports = router;