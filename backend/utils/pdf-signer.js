const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

/**
 * Signs a PDF document by embedding an image (signature).
 * @param {Buffer} pdfBytes - The original PDF document as a Buffer.
 * @param {string} imageDataUrl - Base64 encoded image data URL (e.g., from canvas.toDataURL()).
 * @param {number} x - X coordinate for placing the signature.
 * @param {number} y - Y coordinate for placing the signature.
 * @param {number} pageNumber - The page number to add the signature to (1-indexed).
 * @returns {Promise<Buffer>} - The signed PDF document as a Buffer.
 */
async function signPdfWithImage(pdfBytes, imageDataUrl, x, y, pageNumber) {
  console.log('=== signPdfWithImage called ===');
  console.log('Input coordinates:', { x, y, pageNumber });
  console.log('Image data URL length:', imageDataUrl.length);
  
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    console.log('PDF loaded, pages:', pages.length);

    if (pageNumber < 1 || pageNumber > pages.length) {
      throw new Error(`Page number ${pageNumber} is out of bounds. PDF has ${pages.length} pages.`);
    }

    const page = pages[pageNumber - 1]; // pdf-lib pages are 0-indexed
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    console.log('Target page dimensions:', { width: pageWidth, height: pageHeight });

    // Validate coordinates
    if (x < 0 || y < 0 || x > pageWidth || y > pageHeight) {
      console.warn(`Coordinates (${x}, ${y}) may be outside page bounds (${pageWidth}x${pageHeight})`);
    }

    // Embed the image
    const imageBytes = Buffer.from(imageDataUrl.split(',')[1], 'base64');
    let image;
    if (imageDataUrl.startsWith('data:image/png')) {
      image = await pdfDoc.embedPng(imageBytes);
    } else if (imageDataUrl.startsWith('data:image/jpeg')) {
      image = await pdfDoc.embedJpg(imageBytes);
    } else {
      throw new Error('Unsupported image format. Only PNG and JPEG are supported.');
    }

    const imageDims = image.scale(0.2); // Scale the image down, adjust as needed
    console.log('Image dimensions after scaling:', imageDims);

    page.drawImage(image, {
      x: x,
      y: y,
      width: imageDims.width,
      height: imageDims.height,
    });

    console.log('Image drawn at coordinates:', { x, y, width: imageDims.width, height: imageDims.height });
    
    const result = await pdfDoc.save();
    console.log('PDF saved, result size:', result.length, 'bytes');
    return result;
  } catch (error) {
    console.error('Error in signPdfWithImage:', error);
    throw error;
  }
}

/**
 * Signs a PDF document by adding text (typed signature).
 * @param {Buffer} pdfBytes - The original PDF document as a Buffer.
 * @param {string} text - The signature text.
 * @param {number} x - X coordinate for placing the signature.
 * @param {number} y - Y coordinate for placing the signature.
 * @param {number} pageNumber - The page number to add the signature to (1-indexed).
 * @param {string} fontName - The name of the font (e.g., 'Helvetica', 'TimesRoman').
 * @param {number} fontSize - The font size.
 * @param {string} colorHex - The color of the text in hex format (e.g., '#000000').
 * @returns {Promise<Buffer>} - The signed PDF document as a Buffer.
 */
async function signPdfWithText(pdfBytes, text, x, y, pageNumber, fontName, fontSize, colorHex) {
  console.log('=== signPdfWithText called ===');
  console.log('Input parameters:', { text, x, y, pageNumber, fontName, fontSize, colorHex });
  
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    console.log('PDF loaded, pages:', pages.length);

    if (pageNumber < 1 || pageNumber > pages.length) {
      throw new Error(`Page number ${pageNumber} is out of bounds. PDF has ${pages.length} pages.`);
    }

    const page = pages[pageNumber - 1]; // pdf-lib pages are 0-indexed
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    console.log('Target page dimensions:', { width: pageWidth, height: pageHeight });

    // Validate coordinates
    if (x < 0 || y < 0 || x > pageWidth || y > pageHeight) {
      console.warn(`Coordinates (${x}, ${y}) may be outside page bounds (${pageWidth}x${pageHeight})`);
    }

    let font;
    try {
      // Attempt to embed a standard font based on common names
      switch (fontName.toLowerCase()) {
        case 'helvetica':
          font = await pdfDoc.embedFont(StandardFonts.Helvetica);
          break;
        case 'helvetica-bold':
          font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
          break;
        case 'times-roman':
          font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
          break;
        case 'courier':
          font = await pdfDoc.embedFont(StandardFonts.Courier);
          break;
        // Add more standard fonts as needed or consider custom font embedding
        default:
          // Fallback to Helvetica if the requested font is not a standard one
          console.warn(`Font "${fontName}" not found as a standard PDF font. Using Helvetica as fallback.`);
          font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      }
    } catch (e) {
      console.error(`Error embedding font ${fontName}:`, e);
      font = await pdfDoc.embedFont(StandardFonts.Helvetica); // Fallback
    }

    // Convert hex color to RGB
    const hexToRgb = (hex) => {
      const r = parseInt(hex.substring(1, 3), 16) / 255;
      const g = parseInt(hex.substring(3, 5), 16) / 255;
      const b = parseInt(hex.substring(5, 7), 16) / 255;
      return rgb(r, g, b);
    };

    const color = hexToRgb(colorHex);
    console.log('Text drawing parameters:', { x, y, fontSize, color });

    page.drawText(text, {
      x: x,
      y: y,
      font: font,
      size: fontSize,
      color: color,
    });

    console.log('Text drawn successfully');
    
    const result = await pdfDoc.save();
    console.log('PDF saved, result size:', result.length, 'bytes');
    return result;
  } catch (error) {
    console.error('Error in signPdfWithText:', error);
    throw error;
  }
}

module.exports = {
  signPdfWithImage,
  signPdfWithText,
};
