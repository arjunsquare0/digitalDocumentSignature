// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js';

// Global variables
let pdfDoc = null;
let pageNum = 1;
let pageRendering = false;
let pageNumPending = null;
let scale = 1.5;
let pdfCanvas = null; // PDF.js canvas for rendering
let pdfCtx = null;
let fabricCanvas = null; // Fabric.js canvas for signatures
let signatureCanvas = null; // Signature pad canvas
let signed = false;
let selectedFont = 'Brush Script MT, cursive';
let selectedColor = '#000000';
let currentPdfFile = null;
let currentPdfPage = null;
let signaturesAdded = false; // Track if signatures have been added to canvas

// Backend API URL
const BACKEND_API_URL = 'http://localhost:5000/api';

// Helper function to safely get Alpine.js data
function getAlpineData() {
  const alpineElement = document.querySelector('[x-data]');
  if (alpineElement && alpineElement.__x && alpineElement.__x.$data) {
    return alpineElement.__x.$data;
  }
  return null;
}

// Helper function to safely update Alpine.js state
function updateAlpineState(updates) {
  console.log('=== Alpine State Update ===');
  console.log('Updates requested:', updates);
  
  const alpineData = getAlpineData();
  if (alpineData) {
    console.log('Alpine data found, current state:', {
      activeTab: alpineData.activeTab,
      pdfLoaded: alpineData.pdfLoaded,
      documentSigned: alpineData.documentSigned
    });
    
    Object.assign(alpineData, updates);
    
    console.log('Alpine state updated, new state:', {
      activeTab: alpineData.activeTab,
      pdfLoaded: alpineData.pdfLoaded,
      documentSigned: alpineData.documentSigned
    });
    
    // Force Alpine.js to re-render
    if (window.Alpine && window.Alpine.nextTick) {
      window.Alpine.nextTick(() => {
        console.log('Alpine nextTick executed');
      });
    }
  } else {
    console.error('Alpine data not available, using fallback');
    // Fallback: try to manually trigger tab switching
    fallbackTabSwitch(updates);
  }
}

// Fallback function for tab switching if Alpine.js fails
function fallbackTabSwitch(updates) {
  console.log('Using fallback tab switching');
  
  if (updates.activeTab === 'sign') {
    // Hide upload tab, show sign tab
    const uploadTab = document.querySelector('[x-show="activeTab === \'upload\'"]');
    const signTab = document.querySelector('[x-show="activeTab === \'sign\'"]');
    const downloadTab = document.querySelector('[x-show="activeTab === \'download\'"]');
    
    if (uploadTab) uploadTab.style.display = 'none';
    if (signTab) signTab.style.display = 'block';
    if (downloadTab) downloadTab.style.display = 'none';
    
    // Update tab button states
    const uploadBtn = document.querySelector('button[onclick*="upload"]');
    const signBtn = document.querySelector('button[onclick*="sign"]');
    const downloadBtn = document.querySelector('button[onclick*="download"]');
    
    if (uploadBtn) uploadBtn.classList.remove('bg-blue-100', 'text-blue-700');
    if (signBtn) signBtn.classList.add('bg-blue-100', 'text-blue-700');
    if (downloadBtn) downloadBtn.classList.remove('bg-blue-100', 'text-blue-700');
  }
  
  if (updates.documentSigned) {
    // Enable download tab
    const downloadBtn = document.querySelector('button[onclick*="download"]');
    if (downloadBtn) downloadBtn.disabled = false;
  }
}

// Initialize canvas references
function initializeCanvasReferences() {
  console.log('Initializing canvas references...');
  
  // PDF.js canvas for rendering
  pdfCanvas = document.getElementById('pdf-render-canvas');
  if (pdfCanvas) {
    pdfCtx = pdfCanvas.getContext('2d');
    console.log('PDF canvas initialized');
  } else {
    console.log('PDF canvas not found yet');
  }
  
  // Signature pad canvas
  const signaturePadCanvas = document.getElementById('signature-pad');
  if (signaturePadCanvas && !signatureCanvas) {
    signatureCanvas = new fabric.Canvas('signature-pad');
    signatureCanvas.backgroundColor = '#f8fafc';
    signatureCanvas.isDrawingMode = true;
    signatureCanvas.freeDrawingBrush.color = '#000000';
    signatureCanvas.freeDrawingBrush.width = 2;
    console.log('Signature canvas initialized');
  }
}

// Set PDF container dimensions
function resizeCanvas() {
  const container = document.getElementById('signature-zone');
  if (!container || !pdfCanvas) {
    console.log('Container or PDF canvas not available for resize');
    return;
  }
  
  const width = container.clientWidth;
  const height = container.clientHeight;
  console.log('Resizing canvas to:', width, 'x', height);
  
  // Set PDF canvas dimensions
  pdfCanvas.width = width;
  pdfCanvas.height = height;
  
  // If fabricCanvas exists, resize it too
  if (fabricCanvas) {
    fabricCanvas.setWidth(width);
    fabricCanvas.setHeight(height);
    fabricCanvas.renderAll();
  }
}

// Render the PDF page
async function renderPage(num) {
  if (!pdfDoc || !pdfCanvas) {
    console.log('PDF doc or canvas not available for rendering');
    return;
  }
  
  console.log('Rendering page:', num);
  pageRendering = true;

  currentPdfPage = await pdfDoc.getPage(num);
  const viewport = currentPdfPage.getViewport({ scale: scale });
  
  // Set canvas dimensions based on PDF viewport
  pdfCanvas.height = viewport.height;
  pdfCanvas.width = viewport.width;

  const renderContext = {
    canvasContext: pdfCtx,
    viewport: viewport
  };

  const renderTask = currentPdfPage.render(renderContext);

  await renderTask.promise;
  pageRendering = false;
  console.log('Page rendered successfully');

  if (pageNumPending !== null) {
    renderPage(pageNumPending);
    pageNumPending = null;
  }

  // Initialize Fabric.js canvas on the same dimensions
  if (!fabricCanvas) {
    console.log('Initializing Fabric.js canvas');
    fabricCanvas = new fabric.Canvas('fabric-canvas', {
      width: pdfCanvas.width,
      height: pdfCanvas.height,
      selection: true
    });
  } else {
    fabricCanvas.clear();
  }

  // Set the rendered PDF as the background of the Fabric.js canvas
  const imgData = pdfCanvas.toDataURL('image/png');
  fabric.Image.fromURL(imgData, function(img) {
    img.set({
      scaleX: fabricCanvas.width / img.width,
      scaleY: fabricCanvas.height / img.height,
      selectable: false,
      evented: false,
      isBackground: true,
      originY: 'top',
      originX: 'left'
    });
    fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas));
    console.log('Fabric.js canvas background set (no flipY)');
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

// Handle PDF file selection
async function handleFileSelect(event) {
  console.log('File selected:', event.target.files[0]);
  const file = event.target.files[0];
  if (file && file.type === 'application/pdf') {
    currentPdfFile = file;
    await loadPDF(file);
  }
}

// Handle PDF drop
async function handleDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  console.log('File dropped:', event.dataTransfer.files[0]);
  const file = event.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    currentPdfFile = file;
    await loadPDF(file);
  }
  
  // Reset dragging state
  updateAlpineState({ dragging: false });
}

// Load PDF file
async function loadPDF(file) {
  console.log('Loading PDF:', file.name);
  const fileReader = new FileReader();

  fileReader.onload = async function() {
    const typedarray = new Uint8Array(this.result);

    try {
      pdfDoc = await pdfjsLib.getDocument(typedarray).promise;
      console.log('PDF loaded successfully, pages:', pdfDoc.numPages);

      // Update Alpine.js state immediately
      updateAlpineState({
        pdfLoaded: true,
        activeTab: 'sign'
      });

      // Fallback: If Alpine.js state did not update, manually enable the Sign tab and switch to it
      setTimeout(() => {
        // Enable the Sign tab button directly
        const signTabBtn = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent && btn.textContent.trim().startsWith('Sign'));
        if (signTabBtn) {
          signTabBtn.disabled = false;
          signTabBtn.classList.add('bg-blue-100', 'text-blue-700');
        }
        // Try to switch to the sign tab
        const signTab = document.querySelector('[x-show="activeTab === \'sign\'"]');
        if (signTab) {
          signTab.style.display = 'block';
        }
        // Hide upload tab
        const uploadTab = document.querySelector('[x-show="activeTab === \'upload\'"]');
        if (uploadTab) {
          uploadTab.style.display = 'none';
        }
      }, 300);

      console.log('Alpine state updated, waiting for DOM...');

      // Wait a bit for the DOM to update before rendering
      setTimeout(async () => {
        console.log('Starting canvas initialization...');
        initializeCanvasReferences();
        resizeCanvas();
        await renderPage(1);
        console.log('PDF rendering completed');
      }, 200);

      // Upload PDF to backend
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

    } catch (error) {
      alert('Error loading or uploading PDF: ' + error.message);
      console.error('Error:', error);
    }
  };

  fileReader.readAsArrayBuffer(file);
}

// Clear signature canvas
function clearSignature() {
  if (signatureCanvas) {
    signatureCanvas.clear();
  }
}

// Save drawn signature to PDF canvas (not to backend yet)
async function saveSignature() {
  if (!signatureCanvas || signatureCanvas.isEmpty()) {
    alert('Please draw your signature first');
    return;
  }
  if (!currentPdfFile) {
    alert('Please upload a PDF first.');
    return;
  }

  const dataURL = signatureCanvas.toDataURL('image/png');

  // Add the signature to the Fabric.js canvas for positioning
  fabric.Image.fromURL(dataURL, function(img) {
    img.set({
      left: 100,
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
    fabricCanvas.renderAll();
    
    // Clear the signature pad
    signatureCanvas.clear();
    
    // Mark that signatures have been added
    signaturesAdded = true;
    
    // Update state to allow download
    updateAlpineState({ documentSigned: true });

    // Fallback: Enable the Download tab button directly
    setTimeout(() => {
      const downloadTabBtn = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent && btn.textContent.trim().startsWith('Download'));
      if (downloadTabBtn) {
        downloadTabBtn.disabled = false;
        downloadTabBtn.classList.add('bg-blue-100', 'text-blue-700');
      }
    }, 300);
    
    alert('Signature added to document! You can now drag it to position it. When ready, go to the Download tab to get your signed PDF.');
  });
}

// Font selection
function selectFont(font) {
  selectedFont = font;
  document.querySelectorAll('.signature-font-preview').forEach(el => {
    el.classList.remove('selected');
  });
  event.target.closest('.signature-font-preview').classList.add('selected');
}

// Add typed signature to PDF canvas (not to backend yet)
async function addTextSignature() {
  const textInput = document.getElementById('signature-text');
  const colorInput = document.getElementById('signature-color');
  
  if (!textInput || !colorInput) return;
  
  const text = textInput.value;
  selectedColor = colorInput.value;

  if (!text.trim()) {
    alert('Please enter your signature text');
    return;
  }
  if (!currentPdfFile) {
    alert('Please upload a PDF first.');
    return;
  }

  const sigText = new fabric.Text(text, {
    left: 100,
    top: 100,
    fontFamily: selectedFont,
    fontSize: 36,
    fill: selectedColor,
    originX: 'center',
    originY: 'center',
    hasControls: true,
    hasBorders: true,
    selectable: true,
  });

  fabricCanvas.add(sigText);
  fabricCanvas.setActiveObject(sigText);
  fabricCanvas.renderAll();
  
  // Clear the text input
  textInput.value = '';
  
  // Mark that signatures have been added
  signaturesAdded = true;
  
  // Update state to allow download
  updateAlpineState({ documentSigned: true });

  // Fallback: Enable the Download tab button directly
  setTimeout(() => {
    const downloadTabBtn = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent && btn.textContent.trim().startsWith('Download'));
    if (downloadTabBtn) {
      downloadTabBtn.disabled = false;
      downloadTabBtn.classList.add('bg-blue-100', 'text-blue-700');
    }
  }, 300);
  
  alert('Text signature added to document! You can now drag it to position it. When ready, go to the Download tab to get your signed PDF.');
}

// Helper function to send signature data to backend
async function sendSignatureToBackend(type, data, fabricObject, pdfPageHeight) {
  try {
    // Calculate coordinates for PDF-lib (bottom-left origin)
    let objectHeight = 0;
    if (type === 'image') {
      objectHeight = fabricObject.getScaledHeight();
    } else if (type === 'text') {
      objectHeight = fabricObject.getScaledHeight();
    }

    const xCoord = fabricObject.left;
    const yCoord = pdfPageHeight - (fabricObject.top + objectHeight);

    const formData = new FormData();
    formData.append('pdfFile', currentPdfFile);
    formData.append('signatureType', type);
    formData.append('signatureData', data);
    formData.append('x', xCoord);
    formData.append('y', yCoord);
    formData.append('pageNumber', pageNum);
    if (type === 'text') {
      formData.append('font', selectedFont.split(',')[0].trim());
      formData.append('fontSize', fabricObject.fontSize);
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

    // Create download link
    const url = window.URL.createObjectURL(signedPdfBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'signed_document.pdf';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    // Update the frontend state
    signed = true;
    alert('Signed document downloaded successfully!');

  } catch (error) {
    alert('Error applying signature: ' + error.message);
    console.error('Error:', error);
  }
}

// Download signed PDF - now processes all signatures on the canvas
async function downloadPdf() {
  if (!signaturesAdded) {
    alert('Please add at least one signature to the document first');
    return;
  }
  if (!currentPdfFile) {
    alert('No PDF uploaded to download.');
    return;
  }

  try {
    console.log('=== Starting PDF Download Process ===');
    
    // Get all objects from the Fabric.js canvas
    const objects = fabricCanvas.getObjects();
    console.log('Fabric.js objects found:', objects.length);
    console.log('Objects:', objects);
    
    if (objects.length === 0) {
      alert('No signatures found on the document. Please add signatures first.');
      console.error('No signatures found, aborting download.');
      return;
    }

    // Collect all signatures data
    const signatures = [];
    const viewport = currentPdfPage.getViewport({ scale: scale });
    const pdfPageWidth = viewport.width;
    const pdfPageHeight = viewport.height;
    const nativePageWidth = currentPdfPage.view[2];  // PDF native width
    const nativePageHeight = currentPdfPage.view[3]; // PDF native height
    const scaleX = nativePageWidth / pdfPageWidth;
    const scaleY = nativePageHeight / pdfPageHeight;
    const pdfPageNumber = pageNum;
    
    console.log('PDF page height:', pdfPageHeight);
    console.log('Current page number:', pdfPageNumber);
    console.log('PDF native size:', nativePageWidth, nativePageHeight);
    console.log('Scale factors:', scaleX, scaleY);

    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      console.log(`Processing object ${i}:`, obj.type, obj);
      if (obj.type === 'image' && obj.isBackground) continue;
      if (obj.type === 'image') {
        const dataURL = obj.toDataURL('image/png');
        const signatureData = {
          type: 'image',
          data: dataURL,
          x: Math.round(obj.left * scaleX),
          y: Math.round((pdfPageHeight - (obj.top + obj.getScaledHeight())) * scaleY),
          pageNumber: pdfPageNumber
        };
        signatures.push(signatureData);
        console.log('Added image signature:', signatureData);
      } else if (obj.type === 'text') {
        const signatureData = {
          type: 'text',
          data: obj.text,
          x: Math.round(obj.left * scaleX),
          y: Math.round((pdfPageHeight - (obj.top + obj.getScaledHeight())) * scaleY),
          pageNumber: pdfPageNumber,
          font: selectedFont.split(',')[0].trim(),
          fontSize: obj.fontSize * scaleY,
          color: obj.fill
        };
        signatures.push(signatureData);
        console.log('Added text signature:', signatureData);
      }
    }

    console.log('Total signatures to apply:', signatures.length);
    console.log('Signatures being sent to backend:', signatures);

    if (signatures.length === 0) {
      alert('No valid signatures found. Please add signatures to the document.');
      console.error('No signatures found, aborting download.');
      return;
    }

    // Send all signatures to backend at once
    const formData = new FormData();
    formData.append('pdfFile', currentPdfFile);
    formData.append('signatures', JSON.stringify(signatures));
    
    console.log('Sending request to backend...');
    console.log('PDF file being sent:', currentPdfFile.name, currentPdfFile.size);

    const response = await fetch(`${BACKEND_API_URL}/apply-signatures`, {
      method: 'POST',
      body: formData,
    });

    console.log('Backend response status:', response.status);
    console.log('Backend response headers:', response.headers);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error response:', errorText);
      alert('Failed to generate signed PDF. Server response: ' + errorText);
      return;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('pdf')) {
      const errorText = await response.text();
      alert('Failed to generate signed PDF. Server response: ' + errorText);
      console.error('Server did not return a PDF:', errorText);
      return;
    }

    // The backend will return the signed PDF as a blob
    const signedPdfBlob = await response.blob();
    console.log('Received signed PDF blob:', signedPdfBlob.size, 'bytes');
    console.log('PDF signed by backend successfully!');

    // Create download link
    const url = window.URL.createObjectURL(signedPdfBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'signed_document.pdf';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    // Update the frontend state
    signed = true;
    alert('All signatures have been applied! Your signed document has been downloaded.');

  } catch (error) {
    console.error('Error in downloadPdf:', error);
    alert('Error processing signatures: ' + error.message);
  }
}

// Set up event listeners for drag and drop
function setupEventListeners() {
  console.log('Setting up event listeners...');
  
  const dropzone = document.getElementById('dropzone');
  if (dropzone) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, preventDefaults, false);
      document.body.addEventListener(eventName, preventDefaults, false);
    });
    console.log('Dropzone event listeners added');
  }

  // Clear signature button
  const clearSignatureBtn = document.getElementById('clear-signature');
  if (clearSignatureBtn) {
    clearSignatureBtn.addEventListener('click', clearSignature);
  }

  // Save signature button
  const saveSignatureBtn = document.getElementById('save-signature');
  if (saveSignatureBtn) {
    saveSignatureBtn.addEventListener('click', saveSignature);
  }

  // Add text signature button
  const addTextSignatureBtn = document.getElementById('add-text-signature');
  if (addTextSignatureBtn) {
    addTextSignatureBtn.addEventListener('click', addTextSignature);
  }

  // Download PDF button
  const downloadPdfBtn = document.getElementById('download-pdf');
  if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener('click', downloadPdf);
  }

  // File input
  const fileInput = document.getElementById('file-input');
  if (fileInput) {
    fileInput.addEventListener('change', handleFileSelect);
  }
  
  console.log('All event listeners set up');
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

// Make functions globally available for Alpine.js
window.handleFileSelect = handleFileSelect;
window.handleDrop = handleDrop;
window.selectFont = selectFont;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, waiting for Alpine.js...');
  
  // Wait for Alpine.js to be ready
  const waitForAlpine = () => {
    if (window.Alpine) {
      console.log('Alpine.js ready, initializing app...');
      initializeCanvasReferences();
      setupEventListeners();
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      console.log('App initialization complete');
    } else {
      console.log('Alpine.js not ready yet, waiting...');
      setTimeout(waitForAlpine, 100);
    }
  };
  
  waitForAlpine();
});
