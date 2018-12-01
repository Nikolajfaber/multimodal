const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

const notficationUpdateInterval = 5000;

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Gmail API.
  //authorize(JSON.parse(content), listLabels);
  authorize(JSON.parse(content), startGettingNotifications);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    //console.log(credentials);
    //console.log("DIS ------- " + credentials["web"].client_secret);
    //const client_secret = credentials["web"].client_secret,
    //    client_id = credentials["web"].client_id,
    //    redirect_uris = credentials["web"].redirect_uris;

    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

//Calls per second 190    -> 190*60sek*60min*60hour*24day = 984960000 -> maximum: 1,000,000,000
/**
 * Get the recent email from your Gmail account
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */


function startGettingNotifications(auth) {
  //Timer
  let timerId = setInterval(() => getRecentEmail(auth), notficationUpdateInterval);
}


function getRecentEmail(auth){
   //Authenticated gmail object
   const gmail = google.gmail({version: 'v1', auth});

   // Only get the unread emails and at most 10
   gmail.users.messages.list({auth: auth, userId: 'me', maxResults: 10, q: 'is:unread'}, function(err, response) {
     if (err) {
       console.log('The API returned an error: ' + err);
       return;
     }
 
     // Get the emails                                    
     var unreadEmails = response['data'];         
     console.log(unreadEmails);
     
     // Amount of unread emails
     var emailsAmount = unreadEmails['resultSizeEstimate'];
     console.log("Amount: " + emailsAmount);
 
     var mail1 = unreadEmails['messages'][0]['id'];
     console.log(mail1);
 
     // Retreive the actual message using the message id
     gmail.users.messages.get({auth: auth, userId: 'me', 'id': mail1}, function(err, response) {
       if (err) {
           console.log('The API returned an error: ' + err);
           return;
       }

       //Parse the sender information
       var senderEmail_raw = response['data']['payload']['headers'][7].value;
       var messageParsed = senderEmail_raw.replace('<','');
       var senderEmail = messageParsed.replace('>','');

       console.log(senderEmail);
     });
   });
}





/**
 * Lists the labels in the user's account.
 *
 * param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
/*
function listLabels(auth) {
  const gmail = google.gmail({version: 'v1', auth});
  gmail.users.labels.list({
    userId: 'me',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const labels = res.data.labels;
    if (labels.length) {
      console.log('Labels:');
      labels.forEach((label) => {
        console.log(`- ${label.name}`);
      });
    } else {
      console.log('No labels found.');
    }
  });
}
*/







