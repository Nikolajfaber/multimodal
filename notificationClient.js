//Reading files
const fs = require('fs');
const readline = require('readline');

//Google api stuff
const {google} = require('googleapis');
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = 'token.json';

//Firebase
var firebase = require('firebase-admin');
var serviceAccount = require("./serviceAccountKey.json");

firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  databaseURL: "https://multimodalnotification.firebaseio.com"
});
var dbRef = firebase.database().ref("user");

//Requests
var axios = require('axios');
var espIp = '192.168.137.174';

//Settings
const notficationUpdateInterval = 2000;


//Storing
var storedUnreadEmails = [];
var importantKeywords = ['important', 'answer fast', 'answer quick']; //standard if non is sendt from database
var importantList = [];
var ignoreList = [];
var specialColor = 'undefined';

//Transducer
var player = require('play-sound')(opts = {})
var interval = 1000;
var isPlaying = false;
var automaticPlayer;



getFirebaseInformation();


function getFirebaseInformation(){
  dbRef.once("value", function(snapshot) {
    //NOTE! Shitty way of doing it. Check if the console.log matches. This is depended on the database setup and in which order the data is coming in.
    var arraySnapshot = snapshotToArray(snapshot);
    ignoreList = arraySnapshot[0];
    importantKeywords = arraySnapshot[1];
    importantList = arraySnapshot[2];
    console.log("Received from firebase");
    console.log("Ignoring list:");
    console.log(arraySnapshot[0]);
    console.log("");
    console.log("Important keywords:");
    console.log(arraySnapshot[1]);
    console.log("");
    console.log("Important persons:");
    console.log(arraySnapshot[2]);
    console.log("");
  });
}

function snapshotToArray(snapshot) {
  var returnArr = [];

  snapshot.forEach(function(childSnapshot) {
      var item = childSnapshot.val();
      //item.key = childSnapshot.key;

      returnArr.push(item);
  });

  return returnArr;
};

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
  gmail.users.messages.list({auth: auth, userId: 'me', maxResults: 15, q: 'is:unread'}, function(err, response) {
    if (err) {
    console.log('The API returned an error: ' + err);
    return;
    }
    //console.log("getList was called. It costs 1 quota units.");

    // Get the emails                                    
    var responseData = response['data'];      
    var unreadEmailsTemp = responseData['messages'];   
    var isNewValue = true;

    //Avoid undefined object when there are no unread mails.
    if(unreadEmailsTemp != undefined){
      //console.log("New received emails");
      updateNewEmails(unreadEmailsTemp, isNewValue);
      //console.log(storedUnreadEmails);
      removeReadEmails(unreadEmailsTemp, isNewValue);
      //console.log("After removing emails");
      //console.log(storedUnreadEmails);

      for(var i = 0; i < storedUnreadEmails.length; i++){
        if(storedUnreadEmails[i].fromEmail == 'undefined'){
          updateEmailInformation(i, auth);
        }
      }
    }
  });
}

function updateNewEmails(unreadEmailsTemp, isNewValue){
  for (var a = 0; a < unreadEmailsTemp.length; a++){
    //Clean up the json file for the needed values
    unreadEmailsTemp[a]['fromEmail'] = 'undefined';
    unreadEmailsTemp[a]['important'] = false;
    unreadEmailsTemp[a]['ignoringPerson'] = false;
    unreadEmailsTemp[a]['importantPerson'] = false;
    unreadEmailsTemp[a]['specialColor'] = 'undefined';
    delete  unreadEmailsTemp[a]['threadId'];

    //Compares the stored
    for(var b = 0; b < storedUnreadEmails.length; b++){
      if(unreadEmailsTemp[a]['id'] == storedUnreadEmails[b]['id'] ){
        //console.log("Value is already stored");
        isNewValue = false;
        break;
      }else{
        isNewValue = true;
        //console.log(isNewValue);
      }
    }
    
    //Adds new values to the list if they do not allready exist
    if(isNewValue){
      storedUnreadEmails.push(unreadEmailsTemp[a]);        
    }
  }
}

function removeReadEmails(unreadEmailsTemp, isNewValue){
  for (var a = 0; a < storedUnreadEmails.length; a++){
    //Compares the stored
    for(var b = 0; b < unreadEmailsTemp.length; b++){
      //console.log(b);
      if(unreadEmailsTemp[b]['id'] == storedUnreadEmails[a]['id'] ){
        //console.log("Value is already stored");
        isNewValue = false;
        break;
      }else{
        isNewValue = true;
        //console.log(isNewValue);
      }
    }
    
    //Removes values from list if they are no longer being sent
    if(isNewValue){
      console.log("An email has been read and removed: ");
      console.log(storedUnreadEmails[a]);
      storedUnreadEmails.splice(a,1);
      console.log("Total number of unread mail is : " + storedUnreadEmails.length);
    }
  }
}

function updateEmailInformation(valueNumber, auth){
  var fromEmail = "undefined";
  var msgInformation = storedUnreadEmails[valueNumber]['id'];
  const gmail = google.gmail({version: 'v1', auth});
  
  console.log("updateEmailInformation was called. It costs 5 quota units.");

  // Retreive the actual message using the message id
  gmail.users.messages.get({auth: auth, userId: 'me', 'id': msgInformation}, function(err, response) {
  if (err) {
    console.log('The API returned an error: ' + err);
    return;
  }
  //Parse the email message information
  var subject = response['data']['payload']['headers'][17].value; // Subject
  //console.log("Subject: " + subject);
  
  //Check to see if the subject is important
  var isImportant = isMailImportant(subject);
  //console.log(isImportant);

  //Check to see if the mail content is important if the subject is not
  if(!isImportant){
    // Get maildata
    var message_raw = response['data']['payload']['parts'][0].body.data; // Mail body 
    var buffer = new Buffer.from(message_raw, 'base64');  
    var mailBody = buffer.toString();
    //console.log("Mail: " + mailBody);
    //console.log("Check to see if the content is important");
    isImportant = isMailImportant(mailBody);
  }

  //Add the importance to the list 
  storedUnreadEmails[valueNumber].important = isImportant;

  //Parse the email sender information
  var senderEmail_raw = response['data']['payload']['headers'][7].value;
  var messageParsed = senderEmail_raw.replace('<','');
  fromEmail = messageParsed.replace('>','');

  //Add the sender to the list
  storedUnreadEmails[valueNumber].fromEmail = fromEmail;

  //Handles the incoming mails
  if(isPersonOnIgnoreList(fromEmail)){ //Checks if the person who sent the mail is on the ignoringlist
    storedUnreadEmails[valueNumber]['ignoringPerson'] = true;
    //Do nothing

  }else if(isImportant){
    if(!isPlaying){
      isPlaying = true;
      var body = {
        lightMode: 'rainBow',
        lightColor: 'white'
      }
      changeLight(body);
      automaticPlayer = setInterval(() => playRythm(), interval);
      setTimeout(stopAutomaticPlayer, 2500);
    }

  }else if(isPersonOnImportantList(fromEmail)){//Checks if the person who sent the mail is on the importantlist
    storedUnreadEmails[valueNumber]['importantPerson'] = true;
    storedUnreadEmails[valueNumber]['specialColor'] = specialColor;
    //Do something special for the important person
    if(!isPlaying){
      isPlaying = true;
      var body = {
        lightMode: 'importantPerson',
        lightColor: specialColor
      }
      changeLight(body);
      automaticPlayer = setInterval(() => playRythm(), interval);
      setTimeout(stopAutomaticPlayer, 2500);
    }

  }else{
    //Do something to the transducer and light if a mail was received
    if(!isPlaying){
      isPlaying = true;
      var body = {
        lightMode: 'whiteBlink',
        lightColor: 'white'
      }
      changeLight(body);
      automaticPlayer = setInterval(() => playRythm(), interval);
      setTimeout(stopAutomaticPlayer, 2500);
    }
  }

  console.log("A new unread email was added: ");
  console.log(storedUnreadEmails[valueNumber]);
  console.log("Total number unread is : " + storedUnreadEmails.length);
  });
}

function isMailImportant(text){
  var isImportant = false;
  for (var i = 0; i < importantKeywords.length; i++){
    isImportant = text.toLowerCase().includes(importantKeywords[i]);
    if(isImportant){break;}
  }
  return isImportant;
}

function isPersonOnIgnoreList(fromEmail){
  isOnList = false;
  for (var i = 0; i < ignoreList.length; i++){
    if(ignoreList[i].toLowerCase() == fromEmail.toLowerCase()){
      console.log("Email was ignored");
      isOnList = true;
    }
  }
  return isOnList;
}

function isPersonOnImportantList(fromEmail){
  isOnList = false;
  for (var i = 0; i < importantList.length; i++){
    if(importantList[i]['email'].toLowerCase() == fromEmail.toLowerCase()){
      console.log("Important person mailed");
      specialColor = importantList[i]['color'];
      isOnList = true;
    }
  }
  return isOnList;
}




//-----------------------------
function playRythm(){
  isPlaying = true;
  player.play('sine.wav', function(err){
      if (err) throw err
    })
}

function stopAutomaticPlayer(){
  clearInterval(automaticPlayer);
  isPlaying = false;
}


//--------------------------


function changeLight(body){
  axios.post('http://' + espIp + '/changeLight', body)
  .then(function(response){
      console.log("Something happend");
      //updateProperty("LED" + actuatorName, response.data.value);
  }).catch(function(error){
      console.log(error);
  });
}



