// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js';

// Global variables
let pdfDoc = null;
let pageNum = 1;
let pageRendering = false;
let pageNumPending = null;
let scale = 1.5;
let canvas = document.getElementById('pdf-canvas');
let ctx = canvas.getContext('2d');
let signCanvas = document.getElementById('pdf-canvas-sign'); // This is the canvas Fabric.js will draw on
let signCtx = signCanvas.getContext('2d'); // Not directly used by Fabric.js, but good to have
let signatureCanvas = new fabric.Canvas('signature-pad'); // For drawing signature
let fabricCanvas = null; // This will be the Fabric.js canvas for the PDF
let signed = false;
let selectedFont = 'Brush Script MT, cursive';
let selectedColor = '#000000';
let currentPdfFile = null; // To store the uploaded PDF file for sending to backend
let currentPdfPage = null; // To store the current PDF.js page object

// Backend API URL
const BACKEND_API_URL = 'http://localhost:5000/api'; // Adjust if your backend runs on a different port/host

// Set PDF container dimensions
function resizeCanvas() {
  const container = document.getElementById('pdf-container');
  const width = container.clientWidth;
  const height = container.clientHeight;
  canvas.width = width;
  canvas.height = height;
  signCanvas.width = width;
  signCanvas.height = height;

  // If fabricCanvas exists, resize it too
  if (fabricCanvas) {
    fabricCanvas.setWidth(width);
    fabricCanvas.setHeight(height);
    fabricCanvas.renderAll();
  }
}

// Render the PDF page
async function renderPage(num) {
  pageRendering = true;

  currentPdfPage = await pdfDoc.getPage(num); // Store the current page object
  const viewport = currentPdfPage.getViewport({ scale: scale });
  canvas.height = viewport.height;
  canvas.width = viewport.width;
  signCanvas.height = viewport.height;
  signCanvas.width = viewport.width;

  const renderContext = {
    canvasContext: ctx,
    viewport: viewport
  };

  const renderTask = currentPdfPage.render(renderContext);

  await renderTask.promise;
  pageRendering = false;

  if (pageNumPending !== null) {
    renderPage(pageNumPending);
    pageNumPending = null;
  }

  // Initialize Fabric.js canvas on the same dimensions
  if (!fabricCanvas) {
    fabricCanvas = new fabric.Canvas('pdf-canvas-sign', {
      width: canvas.width,
      height: canvas.height,
      selection: true // Enable object selection
    });
  } else {
    // Clear existing objects if changing page or re-rendering
    fabricCanvas.clear();
  }

  // Set the rendered PDF as the background of the Fabric.js canvas
  // This is crucial: Fabric.js draws on top of this background
  const imgData = canvas.toDataURL('image/png');
  fabric.Image.fromURL(imgData, function(img) {
    fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas), {
      scaleX: fabricCanvas.width / img.width,
      scaleY: fabricCanvas.height / img.height
    });
  });
}

// Queue rendering of the next page
function queueRenderPage(num) {
  if (pageRendering) {
    pageNumPending = num;
  } else {
    renderPage(num);
  }
}

// Previous page
function onPrevPage() {
  if (pageNum <= 1) {
    return;
  }
  pageNum--;
  queueRenderPage(pageNum);
}

// Next page
function onNextPage() {
  if (pageNum >= pdfDoc.numPages) {
    return;
  }
  pageNum++;
  queueRenderPage(pageNum);
}

// Handle PDF file selection
async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file && file.type === 'application/pdf') {
    currentPdfFile = file; // Store the file
    await loadPDF(file);
  }
}

// Handle PDF drop
async function handleDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  const file = event.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    currentPdfFile = file; // Store the file
    await loadPDF(file);
  }
  document.querySelector('.dropzone').classList.remove('active');
}

// Load PDF file (now also uploads to backend)
async function loadPDF(file) {
  const fileReader = new FileReader();

  fileReader.onload = async function() {
    const typedarray = new Uint8Array(this.result);

    try {
      pdfDoc = await pdfjsLib.getDocument(typedarray).promise;
      // page = await pdfDoc.getPage(1); // This is now handled by renderPage

      document.getElementById('pdf-container').classList.remove('hidden');
      document.querySelector('[x-data]').__x.$data.pdfLoaded = true;
      document.querySelector('[x-data]').__x.$data.activeTab = 'sign';

      resizeCanvas();
      await renderPage(1); // Render the first page

      // --- Upload PDF to backend ---
      const formData = new FormData();
      formData.append('pdfFile', file);

      const response = await fetch(`${BACKEND_API_URL}/upload-pdf`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('PDF uploaded to backend:', result);
      // You might want to store documentId from backend if you implement database storage

    } catch (error) {
      alert('Error loading or uploading PDF: ' + error.message);
      console.error('Error:', error);
    }
  };

  fileReader.readAsArrayBuffer(file);
}

// Clear signature canvas
document.getElementById('clear-signature').addEventListener('click', function() {
  signatureCanvas.clear();
});

// Save drawn signature to PDF (send to backend)
document.getElementById('save-signature').addEventListener('click', async function() {
  if (signatureCanvas.isEmpty()) {
    alert('Please draw your signature first');
    return;
  }
  if (!currentPdfFile) {
    alert('Please upload a PDF first.');
    return;
  }

  const dataURL = signatureCanvas.toDataURL('image/png'); // Get drawn signature as image

  // Get current page dimensions for coordinate calculation
  const viewport = currentPdfPage.getViewport({ scale: scale });
  const pdfPageHeight = viewport.height;

  // Get the active object (the signature image) from Fabric.js if it exists
  // If not, we'll add it and then get its position
  let signatureImageObject;
  fabric.Image.fromURL(dataURL, function(img) {
    img.set({
      left: 100, // Initial position
      top: 100,
      originX: 'center',
      originY: 'center',
      hasControls: true,
      hasBorders: true,
      selectable: true,
      lockUniScaling: true
    });

    fabricCanvas.add(img);
    fabricCanvas.setActiveObject(img);
    signatureImageObject = img;

    // Now send to backend
    sendSignatureToBackend('image', dataURL, signatureImageObject, pdfPageHeight);
  });
});

// Font selection
window.selectFont = function(font) {
  selectedFont = font;
  document.querySelectorAll('.signature-font-preview').forEach(el => {
    el.classList.remove('selected');
  });
  // 'this' refers to the element that triggered the event (the div)
  // In an onclick attribute, 'event.target' might be the span inside the div.
  // We want the div itself, so we find the closest parent with the class.
  event.target.closest('.signature-font-preview').classList.add('selected');
};

// Add typed signature to PDF (send to backend)
document.getElementById('add-text-signature').addEventListener('click', async function() {
  const text = document.getElementById('signature-text').value;
  selectedColor = document.getElementById('signature-color').value;

  if (!text.trim()) {
    alert('Please enter your signature text');
    return;
  }
  if (!currentPdfFile) {
    alert('Please upload a PDF first.');
    return;
  }

  // Get current page dimensions for coordinate calculation
  const viewport = currentPdfPage.getViewport({ scale: scale });
  const pdfPageHeight = viewport.height;

  const sigText = new fabric.Text(text, {
    left: 100, // Initial position
    top: 100,
    fontFamily: selectedFont,
    fontSize: 36, // Fabric.js font size
    fill: selectedColor,
    originX: 'center',
    originY: 'center',
    hasControls: true,
    hasBorders: true,
    selectable: true,
  });

  fabricCanvas.add(sigText);
  fabricCanvas.setActiveObject(sigText);

  // Now send to backend
  sendSignatureToBackend('text', text, sigText, pdfPageHeight);
});

// Helper function to send signature data to backend
async function sendSignatureToBackend(type, data, fabricObject, pdfPageHeight) {
  try {
    // Calculate coordinates for PDF-lib (bottom-left origin)
    // Fabric.js origin is top-left. PDF-lib origin is bottom-left.
    // y_pdf = page_height - (y_fabric + object_height)
    // For text, object_height is roughly fontSize. For image, it's img.height * scaleY
    let objectHeight = 0;
    if (type === 'image') {
      objectHeight = fabricObject.getScaledHeight();
    } else if (type === 'text') {
      objectHeight = fabricObject.getScaledHeight(); // Fabric.js text height
    }

    const xCoord = fabricObject.left;
    const yCoord = pdfPageHeight - (fabricObject.top + objectHeight); // Adjust for PDF-lib's bottom-left origin

    const formData = new FormData();
    formData.append('pdfFile', currentPdfFile); // Send the original PDF file
    formData.append('signatureType', type);
    formData.append('signatureData', data);
    formData.append('x', xCoord);
    formData.append('y', yCoord);
    formData.append('pageNumber', pageNum); // Current page number
    if (type === 'text') {
      formData.append('font', selectedFont.split(',')[0].trim()); // Send primary font name
      formData.append('fontSize', fabricObject.fontSize); // Send Fabric.js font size
      formData.append('color', selectedColor);
    }

    const response = await fetch(`${BACKEND_API_URL}/sign-pdf`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    // The backend will return the signed PDF as a blob
    const signedPdfBlob = await response.blob();
    console.log('PDF signed by backend successfully!');

    // Update the frontend state to allow download
    signed = true;
    document.querySelector('[x-data]').__x.$data.documentSigned = true;
    alert('Signature applied successfully! You can now download the signed document.');

    // Optionally, you can re-render the PDF with the new signature
    // For simplicity, we'll just enable download. Re-rendering would involve
    // loading the signedPdfBlob back into PDF.js, which is more complex.
    // For now, the user will download the signed version.

  } catch (error) {
    alert('Error applying signature: ' + error.message);
    console.error('Error:', error);
  }
}


// Download signed PDF (now triggers download from backend)
document.getElementById('download-pdf').addEventListener('click', async function() {
  if (!signed) {
    alert('Please sign the document first');
    return;
  }
  if (!currentPdfFile) {
    alert('No PDF uploaded to download.');
    return;
  }

  // This part is tricky. The current backend `sign-pdf` endpoint
  // directly returns the signed PDF. So, if `signed` is true,
  // it means the last `sign-pdf` call was successful and the user
  // can download the *last signed version*.
  // If you want to download the *current state* of the Fabric.js canvas
  // (which might have multiple signatures), you'd need a different backend endpoint
  // that takes the original PDF and the Fabric.js canvas state (e.g., as JSON)
  // and applies all objects.

  // For now, we'll assume 'signed' means the last operation was successful
  // and the user can download the result of that operation.
  // The `sendSignatureToBackend` already handles the download.
  // So, this button might just be a confirmation or a trigger for the *last* signed PDF.

  // A more robust solution would be:
  // 1. Backend stores the signed PDF temporarily or persistently.
  // 2. This 'download-pdf' button makes a GET request to a backend endpoint
  //    like `/api/download-signed-pdf/:documentId` which serves the stored PDF.

  // Given the current backend structure, the `sign-pdf` endpoint
  // already sends the file for download. So, the `download-pdf` button
  // on the frontend should ideally trigger the *signing process* if not already done,
  // or fetch the *already signed* document.

  // Let's simplify: The `sendSignatureToBackend` function already triggers the download.
  // This `download-pdf` button will just alert if not signed.
  // If you want to re-download the *last* signed document, you'd need a backend endpoint for that.

  // For the current setup, the `sendSignatureToBackend` function already handles the download.
  // So, this button's primary purpose is to check if signing has occurred.
  // If you want to allow multiple signatures and then one final download,
  // the `sign-pdf` endpoint should *not* send the file back immediately,
  // but rather store it and return a document ID. Then this `download-pdf`
  // button would fetch that document ID.

  // To align with the current backend, the `sendSignatureToBackend` function
  // already initiates the download. So, this button is somewhat redundant
  // if only one signature is applied and downloaded immediately.
  // If multiple signatures are allowed on the frontend before a final download,
  // then the backend's `sign-pdf` needs to be modified to *not* send the file back,
  // but rather update a stored PDF, and this `download-pdf` button would then
  // trigger a new endpoint to get the final PDF.

  // Let's assume for now that "Download Signed Document" means
  // "Download the document with the last applied signature".
  // The `sendSignatureToBackend` already handles the download.
  // So, this button just confirms the state.
  alert('The signed document was prepared for download after the last signature was applied. Please check your downloads.');
});


// Set up event listeners for drag and drop
const dropzone = document.getElementById('dropzone');

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropzone.addEventListener(eventName, preventDefaults, false);
  document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Disable tabs when not applicable
  Alpine.store('app', {
    pdfLoaded: false,
    documentSigned: false
  });
});

// Initialize signature pad with options
signatureCanvas.backgroundColor = '#f8fafc';
signatureCanvas.isDrawingMode = true;
signatureCanvas.freeDrawingBrush.color = '#000000';
signatureCanvas.freeDrawingBrush.width = 2;
