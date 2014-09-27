var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var rootDir = __dirname;

app.set('views', rootDir + '/views');
app.set('view engine', 'ejs');
app.set("view options", {layout: false});

// parse application/x-www-form-urlencoded
// app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
// app.use(bodyParser.json());

// Serve static content from "public" directory
app.use(express.static(rootDir +'/public'));

app.get('/',function(req,res){
	res.render('index');
});

app.listen(3000);