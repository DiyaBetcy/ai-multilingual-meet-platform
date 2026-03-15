const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

io.on("connection", (socket) => {

    console.log("User connected");

    socket.on("audio-chunk", (chunk) => {

        console.log("Audio chunk received");

        // Temporary caption response
        socket.emit("caption", "Processing speech...");

    });

});

server.listen(5000, () => {
    console.log("Server running on port 5000");
});