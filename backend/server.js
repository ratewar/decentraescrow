const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');
const pinataSDK = require('@pinata/sdk');
const multer = require('multer');
const streamifier = require('streamifier');
const cors=require("cors"); 
const dotenv = require('dotenv');

dotenv.config();


const pinata = pinataSDK(process.env.PINATAAPIID, process.env.PINATAAPIKEY);
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const ipfsuri = "https://ipfs.io/ipfs/";

app.use(cors({
	credentials: true,
	origin: "http://localhost:8080"
  }));

const dirname = path.resolve();

app.use(express.static(path.join(dirname, '/frontend/')));

app.get('*',function(req, res) {
    res.sendFile(path.join(dirname, '/frontend/index.html'));
});


app.post('/nftwrite', upload.single('image'), function (req, res, next) {
    const mystream = streamifier.createReadStream(req.file.buffer);

    //file more than 1MB? Drop and exit!
    if (Buffer.byteLength(req.file.buffer)>= 1000000){
        res.status(500).send('Too big. Please keep to files below 1MB.');
        return;
    }
    
    mystream.path = req.file.originalname;
    const options = {
        pinataMetadata: {
            name: req.file.originalname,
        },
        pinataOptions: {
            cidVersion: 0
        }
    };

    //pin the picture
    pinata.pinFileToIPFS(mystream, options).then((result) => {
        //construct the metadata
        const body = {
            "model": req.body.model,
            "manufactured-date": req.body.manufactureddate,
            "serial-number": req.body.serialnumber,
            "photo": ipfsuri + result.IpfsHash
        };
        const options = {
            pinataMetadata: {
                name: req.body.serialnumber,
            },
            pinataOptions: {
                cidVersion: 0
            }
        };
        
        console.log(result);

        //pin the metadata
        pinata.pinJSONToIPFS(body, options).then((result) => {
            //ok done, return the hash to caller
            console.log(result);
            res.json({ IpfsHash: result.IpfsHash });
        }).catch((err) => {
            //handle error here
            res.status(500).send('Something broke!')
            console.log(err);
            return;
        });
    }).catch((err) => {
        res.status(500).send('Something broke!')
        console.log(err);
        return;
    });
  });

io.sockets.on('connection', function(socket){
	socket.userData = { x:0, y:0, z:0, heading:0 };//Default values;
 
	console.log(`${socket.id} connected`);
	socket.emit('setId', { id:socket.id });
	
    socket.on('disconnect', function(){
		socket.broadcast.emit('deletePlayer', { id: socket.id });
    });	
	
	socket.on('init', function(data){
		console.log(`socket.init ${data.model}`);
		socket.userData.model = data.model;
		socket.userData.colour = data.colour;
		socket.userData.x = data.x;
		socket.userData.y = data.y;
		socket.userData.z = data.z;
		socket.userData.heading = data.h;
		socket.userData.pb = data.pb,
		socket.userData.action = "Idle";
	});
	
	socket.on('update', function(data){
		socket.userData.x = data.x;
		socket.userData.y = data.y;
		socket.userData.z = data.z;
		socket.userData.heading = data.h;
		socket.userData.pb = data.pb,
		socket.userData.action = data.action;
	});
	
	socket.on('chat message', function(data){
		console.log(`chat message:${data.id} ${data.message}`);
		io.to(data.id).emit('chat message', { id: socket.id, message: data.message });
	})
});

const port = process.env.PORT || 2002;

http.listen(process.env.PORT || 2002, function(){
  console.log(`Serve at http://localhost:${port}`);
});

setInterval(function(){
	const nsp = io.of('/');
    let pack = [];
	
    for(let id in io.sockets.sockets){
        const socket = nsp.connected[id];
		//Only push sockets that have been initialised
		if (socket.userData.model!==undefined){
			pack.push({
				id: socket.id,
				model: socket.userData.model,
				colour: socket.userData.colour,
				x: socket.userData.x,
				y: socket.userData.y,
				z: socket.userData.z,
				heading: socket.userData.heading,
				pb: socket.userData.pb,
				action: socket.userData.action
			});    
		}
    }
	if (pack.length>0) {io.emit('remoteData', pack)};
}, 40);