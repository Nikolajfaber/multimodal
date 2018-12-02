var player = require('play-sound')(opts = {})
var interval = 1000;

function playRythm(){
    player.play('sine.wav', function(err){
        if (err) throw err
      })
}

var automaticPlayer = setInterval(() => playRythm(), interval);

setTimeout(stopAutomaticPlayer, 2500);

function stopAutomaticPlayer(){
    clearInterval(automaticPlayer);
}