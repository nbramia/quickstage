const https = require('https');

const data = JSON.stringify({
  name: 'Nathan',
  email: 'nathan@quickstage.tech',
  password: 'superadmin123!'
});

const options = {
  hostname: 'quickstage-worker.nbramia.workers.dev',
  port: 443,
  path: '/admin/setup-superadmin',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('Response status:', res.statusCode);
    console.log('Response data:', responseData);
    
    if (res.statusCode === 200) {
      console.log('✅ Superadmin account created successfully!');
      console.log('Username: nathan');
      console.log('Password: superadmin123!');
      console.log('You can now log in at https://quickstage.tech/admin');
    } else {
      console.log('❌ Failed to create superadmin account');
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.write(data);
req.end();