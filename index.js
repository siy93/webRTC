'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');

var fileServer = new(nodeStatic.Server)();
var app = http.createServer(function(req, res) {
  fileServer.serve(req, res);
}).listen(3000);

var users = [];
var readyQueue = [];
var rm = [];
var roomNumber = 0;
var numClients = 1;

var io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {
  users.push({
    id:socket.id,
    readyState:false,
    calling:false
  });

  console.log("user connected : " + socket.id);
  io.to(socket.id).emit('receive id',socket.id);

  // convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }
  socket.on('user ready',function(id){
    console.log(id);
    for(var i=0;i<users.length;i++){

      if(users[i].id === id && users[i].readyState === false) {

          users[i].readyState = true;
          readyQueue.push(users.splice(i, 1));

          if(readyQueue.length>1){
              io.to(readyQueue[0][0].id).emit('join button possible',roomNumber);
              io.to(readyQueue[1][0].id).emit('join button possible',roomNumber);
              rm.push({
                id:roomNumber,
                isChannelReady : false,
                isInitiator : false,
                isStarted : false
              })
              roomNumber++;
              readyQueue.shift();
              readyQueue.shift();
          };
      }
    }
  });

    socket.on('message', function(message) {
    log('Client said: ', message);
    // for a real app, would be room-only (not broadcast)
    socket.broadcast.emit('message', message);
  });

  socket.on('create or join', function(room) {
    log('Received request to create or join room ' + room);
    console.log(numClients);
    log('Room ' + room + ' now has ' + numClients + ' client(s)');
    if (numClients === 1) {
      socket.join(rm[room]);
      log('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('created', rm[room], socket.id);
      numClients++;
    } else if (numClients === 2) {
      log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room);
      socket.join(rm[room]);
      socket.emit('joined', rm[room], socket.id);
      io.sockets.in(room).emit('ready');
      numClients = 1;
    } else { // max two clients
      socket.emit('full', room);
      for(;;){console.log("error")}
    }
  });

  socket.on('ipaddr', function() {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });

  socket.on('bye', function(){
    console.log('received bye');
  });

});
