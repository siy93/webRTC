'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');

var fileServer = new(nodeStatic.Server)();
var app = http.createServer(function(req, res) {
  fileServer.serve(req, res);
}).listen(8080);

var users = [];
var readyQueue = [];
var roomNumber = 0;
var numClients = 1;

var io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {
  console.log("called");
  users.push({
    id : socket.id,
    readyState : false,
    calling : false
  });

  console.log("user connected : " + socket.id);
  io.to(socket.id).emit('receive id',socket.id);

  // convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  if(readyQueue.length >= 2){
      socket.emit('video streaming possible',
          readyQueue.shift().id,
          readyQueue.shift().id,
          roomNumber++)
  }

  socket.on('user ready',function(id){
    console.log(id);
    for(var i=0;i<users.length;i++){
      if(users[i].id === id && users[i].readyState === false){
        users[i].readyState = true;
        readyQueue.push(users.splice(i,1));
      }
    }
  })

  socket.on('message', function(message) {
    log('Client said: ', message);
    // for a real app, would be room-only (not broadcast)
    socket.broadcast.emit('message', message);
  });

  socket.on('create or join', function(room) {
    log('Received request to create or join room ' + room);

    if (numClients === 1) {
      socket.join(room);
      log('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('created', room, socket.id);

    } else if (numClients === 2) {
      log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready');
    } else { // max two clients
      socket.emit('full', room);
      numClients = 1;
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
