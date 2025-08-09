const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const app = express(); // Use express app, not router
const upload = multer({ dest: 'uploads/' });

// Load environment variables from .env file
require('dotenv').config();

// Debug environment variables
console.log('=== ENVIRONMENT CHECK ===');
console.log('CLIENT_ID:', process.env.CLIENT_ID ? 'Present' : 'Missing');
console.log('CLIENT_SECRET:', process.env.CLIENT_SECRET ? 'Present' : 'Missing');
console.log('REDIRECT_URI:', process.env.REDIRECT_URI);
console.log('========================');

// Configuration
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const redirectUri = process.env.REDIRECT_URI;
const scopes = ['https://www.googleapis.com/auth/drive'];

// Validate required environment variables
if (!clientId || !clientSecret || !redirectUri) {
  console.error('Missing required environment variables!');
  console.error('Required: CLIENT_ID, CLIENT_SECRET, REDIRECT_URI');
  process.exit(1);
}

// Create an OAuth2 client
const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

// Debug OAuth2Client after creation
console.log('OAuth2Client created:');
console.log('- Client ID set:', !!oAuth2Client._clientId);
console.log('- Client Secret set:', !!oAuth2Client._clientSecret);
console.log('- Redirect URI set:', !!oAuth2Client.redirectUri);

// Generate the authentication URL
const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
  include_granted_scopes: true
});

// Get the authentication URL
app.get('/auth/google', (req, res) => {
  res.redirect(authUrl); // Redirect instead of sending URL as text
});

// Handle the callback from the authentication flow
app.get('/auth/google/callback', async (req, res) => {
  console.log('=== CALLBACK DEBUG ===');
  const code = req.query.code;
  console.log('Authorization code received:', !!code);
  
  if (!code) {
    console.log('No authorization code in callback');
    return res.status(400).send('No authorization code received');
  }

  // Debug OAuth2Client state before getToken
  console.log('OAuth2Client state before getToken:');
  console.log('- _clientId:', oAuth2Client._clientId);
  console.log('- _clientSecret:', !!oAuth2Client._clientSecret);
  console.log('- redirectUri:', oAuth2Client.redirectUri);

  try {
    console.log('Calling getToken...');
    // Exchange the authorization code for access and refresh tokens
    const { tokens } = await oAuth2Client.getToken(code);
    console.log('Tokens received:', !!tokens);
    
    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;
    
    oAuth2Client.setCredentials({ 
      refresh_token: refreshToken, 
      access_token: accessToken 
    });

    console.log('Credentials set successfully');
    res.send('Authentication successful!');
  } catch (error) {
    console.error('=== ERROR DETAILS ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('OAuth2Client state during error:');
    console.error('- _clientId:', oAuth2Client._clientId);
    console.error('- _clientSecret:', !!oAuth2Client._clientSecret);
    
    res.status(500).send(`Authentication failed: ${error.message}`);
  }
});

// Create Drive instance after OAuth2Client is configured
var drive = google.drive({
  version: "v3",
  auth: oAuth2Client,
});

// Test route to verify server is working
app.get('/', (req, res) => {
  res.send('Server is running! <a href="/auth/google">Login with Google</a>');
});

app.get('/files', async (req, res) => {
  try {
    const response = await drive.files.list({
      pageSize: 10, // Set the desired number of files to retrieve
      fields: 'files(name, id)', // Specify the fields to include in the response
    });
    const files = response.data.files;
    res.json(files);
  } catch (err) {
    console.error('Error listing files:', err);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const response = await drive.files.create({
 
      resource: {
        name: req.file.originalname, // Use the original filename for the uploaded file
        mimeType: req.file.mimetype, // Set the MIME type of the file
      },
      media: {
        mimeType: req.file.mimetype,
        body: req.file.stream, // Use the file stream as the body of the request
      },
    });
    res.json({ fileId: response.data.id });
  } catch (err) {
    console.error('Error uploading file:', err);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Visit http://localhost:${PORT}/auth/google to start authentication`);
});