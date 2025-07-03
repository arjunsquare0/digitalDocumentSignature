# Digital Document Signature Application

A full-stack web application for digitally signing PDF documents with both hand-drawn and typed signatures.

## Features

- **PDF Upload**: Drag and drop or browse to upload PDF files
- **Hand-drawn Signatures**: Draw signatures using a canvas interface
- **Typed Signatures**: Add text signatures with various fonts and colors
- **Real-time Preview**: See signatures on the PDF before applying
- **Backend Processing**: Server-side PDF signing using pdf-lib
- **MongoDB Storage**: Document tracking and signature history
- **Modern UI**: Responsive design with Tailwind CSS and Alpine.js

## Project Structure

```
digitalDocumentSignature/
├── backend/
│   ├── models/
│   │   └── Document.js          # MongoDB schema for documents
│   ├── routes/
│   │   └── api.js              # API endpoints
│   ├── utils/
│   │   └── pdf-signer.js       # PDF signing utilities
│   ├── uploads/                # Temporary file storage
│   ├── server.js               # Express server
│   └── package.json
├── frontend/
│   ├── assests/
│   │   ├── css/
│   │   │   └── main.css        # Custom styles
│   │   ├── js/
│   │   │   └── main.js         # Frontend JavaScript
│   │   └── images/
│   │       └── icon.jpg        # App icon
│   └── views/
│       └── index.ejs           # Main HTML template
└── README.md
```

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (running locally or cloud instance)
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd digitalDocumentSignature
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the `backend` directory:
   ```env
   MONGO_URI=mongodb://localhost:27017/digitalDocumentSignature
   PORT=5000
   ```

4. **Start MongoDB**
   Make sure MongoDB is running on your system. If using a cloud instance, update the MONGO_URI in the .env file.

## Running the Application

1. **Start the backend server**
   ```bash
   cd backend
   npm start
   ```
   The server will start on `http://localhost:5000`

2. **Access the application**
   Open your browser and navigate to `http://localhost:5000`

## How to Use

1. **Upload a PDF**
   - Click the "Upload" tab
   - Drag and drop a PDF file or click "Browse Files"
   - The PDF will be uploaded to the server and displayed

2. **Add Signatures**
   - Click the "Sign" tab
   - Choose between hand-drawn or typed signatures:
     - **Hand-drawn**: Use the signature pad to draw your signature
     - **Typed**: Enter text and select font style and color
   - Click "Apply Signature" to add it to the document

3. **Download Signed Document**
   - Click the "Download" tab
   - Click "Download Signed Document" to get the signed PDF

## API Endpoints

- `POST /api/upload-pdf` - Upload a PDF file
- `POST /api/sign-pdf` - Apply signatures to a PDF

## Technologies Used

### Frontend
- **HTML5/EJS**: Template engine
- **Tailwind CSS**: Utility-first CSS framework
- **Alpine.js**: Lightweight JavaScript framework for reactivity
- **PDF.js**: PDF rendering library
- **Fabric.js**: Canvas manipulation library

### Backend
- **Node.js**: JavaScript runtime
- **Express.js**: Web framework
- **MongoDB**: Database
- **Mongoose**: MongoDB ODM
- **pdf-lib**: PDF manipulation library
- **Multer**: File upload middleware

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check the MONGO_URI in your .env file
   - Verify network connectivity if using a cloud instance

2. **File Upload Issues**
   - Check that the uploads directory exists in the backend
   - Ensure proper file permissions

3. **Alpine.js Errors**
   - Clear browser cache
   - Check browser console for JavaScript errors

4. **PDF Rendering Issues**
   - Ensure PDF files are not corrupted
   - Check browser compatibility with PDF.js

### Development

To run in development mode with auto-restart:
```bash
cd backend
npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License. 