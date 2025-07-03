import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

async function testAPI() {
  try {
    console.log('Testing API endpoints...');
    
    // Test 1: Upload PDF
    console.log('\n1. Testing upload-pdf endpoint...');
    const formData = new FormData();
    formData.append('pdfFile', fs.createReadStream('uploads/CCE-Arjun Dubey.pdf'));
    
    const uploadResponse = await fetch('http://localhost:5000/api/upload-pdf', {
      method: 'POST',
      body: formData
    });
    
    if (uploadResponse.ok) {
      const uploadResult = await uploadResponse.json();
      console.log('Upload successful:', uploadResult);
    } else {
      console.error('Upload failed:', uploadResponse.status, uploadResponse.statusText);
      return;
    }
    
    // Test 2: Apply signatures
    console.log('\n2. Testing apply-signatures endpoint...');
    const signatures = [
      {
        type: 'text',
        data: 'Test Signature',
        x: 100,
        y: 100,
        pageNumber: 1,
        font: 'Helvetica',
        fontSize: 24,
        color: '#000000'
      }
    ];
    
    const signFormData = new FormData();
    signFormData.append('pdfFile', fs.createReadStream('uploads/CCE-Arjun Dubey.pdf'));
    signFormData.append('signatures', JSON.stringify(signatures));
    
    const signResponse = await fetch('http://localhost:5000/api/apply-signatures', {
      method: 'POST',
      body: signFormData
    });
    
    if (signResponse.ok) {
      const signedPdfBuffer = await signResponse.buffer();
      console.log('Signing successful! Signed PDF size:', signedPdfBuffer.length, 'bytes');
      
      // Save the signed PDF for inspection
      fs.writeFileSync('test-signed-output.pdf', signedPdfBuffer);
      console.log('Signed PDF saved as test-signed-output.pdf');
    } else {
      const errorText = await signResponse.text();
      console.error('Signing failed:', signResponse.status, errorText);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testAPI(); 